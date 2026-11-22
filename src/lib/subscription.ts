import { createHash, timingSafeEqual } from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { computePlanExpiry } from '@/lib/plans';
import { stripeCentsToXof } from '@/lib/fx';

/** Taux de commission par niveau (web uniquement — PayDunya / Stripe) */
export const REFERRAL_RATES = [0.10, 0.035, 0.015] as const; // 10% · 3,5% · 1,5% = 15%
/** @deprecated utiliser REFERRAL_RATES[0] */
export const REFERRAL_COMMISSION = REFERRAL_RATES[0];

/**
 * L'acheteur a-t-il réellement bénéficié de la réduction parrainage sur ce paiement ?
 * Si oui, la commission du parrain est due — qu'il soit abonné Pro ou non.
 * (Les anciennes factures PayDunya n'ont pas `discountApplied` : on compare les montants.)
 */
export function referralDiscountGranted(payment: FirebaseFirestore.DocumentData): boolean {
  if (payment.discountApplied === true) return true;
  return typeof payment.amount === 'number'
    && typeof payment.originalAmount === 'number'
    && payment.amount < payment.originalAmount;
}

const PAYDUNYA_V1 = process.env.PAYDUNYA_MODE === 'live'
  ? 'https://app.paydunya.com/api/v1'
  : 'https://app.paydunya.com/sandbox-api/v1';

export function paydunyaHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'PAYDUNYA-MASTER-KEY': process.env.PAYDUNYA_MASTER_KEY!,
    'PAYDUNYA-PRIVATE-KEY': process.env.PAYDUNYA_PRIVATE_KEY!,
    'PAYDUNYA-TOKEN': process.env.PAYDUNYA_TOKEN!,
  };
}

/** Le hash envoyé par PayDunya dans ses notifications est le SHA-512 de la MasterKey. */
export function isValidPaydunyaHash(hash: unknown): boolean {
  const masterKey = process.env.PAYDUNYA_MASTER_KEY;
  if (!masterKey || typeof hash !== 'string') return false;
  const expected = Buffer.from(createHash('sha512').update(masterKey).digest('hex'));
  const received = Buffer.from(hash.trim().toLowerCase());
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Lit le corps d'une notification PayDunya.
 * Les IPN de paiement arrivent en x-www-form-urlencoded sous la clé `data`
 * (data[invoice][token]=… ou data=<json>) ; on accepte aussi du JSON.
 * Retourne un dictionnaire à plat : "invoice.token" → valeur.
 */
export function parsePaydunyaBody(raw: string): Record<string, string> {
  const flat: Record<string, string> = {};
  const flatten = (value: unknown, prefix: string) => {
    if (value === null || value === undefined) return;
    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        flatten(v, prefix ? `${prefix}.${k}` : k);
      }
    } else if (prefix) {
      flat[prefix] = String(value);
    }
  };
  const unwrap = (obj: unknown) => {
    const o = obj as Record<string, unknown> | null;
    flatten(o && typeof o === 'object' && o.data && typeof o.data === 'object' ? o.data : o, '');
  };

  const text = raw.trim();
  if (!text) return flat;
  if (text.startsWith('{')) {
    try { unwrap(JSON.parse(text)); return flat; } catch { /* pas du JSON */ }
  }
  const params = new URLSearchParams(text);
  for (const [key, value] of params) {
    if (key === 'data') {
      try { unwrap(JSON.parse(value)); } catch { /* ignoré */ }
      continue;
    }
    // data[invoice][token] → invoice.token
    const path = key.replace(/\]/g, '').split('[');
    if (path[0] === 'data') path.shift();
    if (path.length) flat[path.join('.')] = value;
  }
  return flat;
}

const toDate = (val: unknown): Date | null => {
  if (!val) return null;
  if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate();
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/** Fin d'accès actuelle (la plus lointaine entre planExpiresAt et subscriptionEnd), ou null. */
function currentAccessEnd(userData: FirebaseFirestore.DocumentData | undefined): Date | null {
  const dates = [toDate(userData?.planExpiresAt), toDate(userData?.subscriptionEnd)]
    .filter((d): d is Date => d !== null);
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map(d => d.getTime())));
}

function isUserPro(userData: FirebaseFirestore.DocumentData | undefined, now: Date): boolean {
  const end = currentAccessEnd(userData);
  if (end) return end > now;
  return userData?.isPro === true;
}

export type FinalizeResult =
  | { result: 'activated'; expiresAt: Date }
  | { result: 'already' }
  | { result: 'not_found' };

/**
 * Marque un paiement comme payé et active l'abonnement — une seule fois.
 *
 * IMPORTANT : tous les tx.get() (reads) sont exécutés AVANT tout tx.set()/tx.update() (writes).
 * Le SDK Admin Firestore Node.js interdit les reads après writes dans une même transaction.
 *
 * À n'appeler qu'APRÈS avoir prouvé le paiement auprès du prestataire.
 */
export async function finalizePaidPayment(
  paymentId: string,
  extraPaymentFields: Record<string, unknown> = {},
): Promise<FinalizeResult> {
  const paymentRef = adminDb.collection('payments').doc(paymentId);

  // Normalisation devise AVANT la transaction (stripeCentsToXof fait un appel réseau)
  // On lit d'abord le payment doc pour connaître la devise, sans transaction.
  const paymentSnap0 = await paymentRef.get();
  if (!paymentSnap0.exists) return { result: 'not_found' };
  const paymentData0 = paymentSnap0.data()!;
  if (paymentData0.status === 'completed') return { result: 'already' };

  const paymentCurrency = (paymentData0.currency ?? 'XOF').toUpperCase();
  const amountInXof: number = (paymentCurrency === 'USD' || paymentCurrency === 'EUR')
    ? await stripeCentsToXof(paymentData0.amount, paymentCurrency.toLowerCase() as 'usd' | 'eur')
    : Number(paymentData0.amount);

  return adminDb.runTransaction(async (tx) => {
    // ════════════════════════════════════════════════════════
    // PHASE 1 — READS UNIQUEMENT (aucun write avant la fin)
    // ════════════════════════════════════════════════════════

    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists) return { result: 'not_found' as const };
    const payment = { ...paymentSnap.data()! }; // copie mutable
    if (payment.status === 'completed') return { result: 'already' as const };

    const userRef = adminDb.collection('users').doc(payment.userId);
    const userSnap = await tx.get(userRef);

    // Auto-lookup du code de parrainage sauvegardé si le paiement n'en a pas
    const codeSnapCache = new Map<string, FirebaseFirestore.DocumentSnapshot>();

    if (!payment.referralCode) {
      const savedCode = userSnap.data()?.savedReferralCode as string | undefined;
      if (savedCode) {
        const snap = await tx.get(adminDb.collection('referralCodes').doc(savedCode));
        codeSnapCache.set(savedCode, snap);
        if (snap.exists && snap.data()?.userId !== payment.userId) {
          payment.referralCode = savedCode;
          payment.referrerId = snap.data()!.userId;
        }
      }
    } else if (!codeSnapCache.has(payment.referralCode)) {
      const snap = await tx.get(adminDb.collection('referralCodes').doc(payment.referralCode));
      codeSnapCache.set(payment.referralCode, snap);
    }

    // Construire la chaîne de parrainage (niveaux 1-3) — reads uniquement
    type ChainEntry = { code: string; referrerId: string };
    const chain: ChainEntry[] = [];

    if (payment.referralCode && payment.referrerId
        && payment.referrerId !== payment.userId) {

      chain.push({ code: payment.referralCode, referrerId: payment.referrerId });

      // Niveau 2
      const l1UserSnap = await tx.get(adminDb.collection('users').doc(payment.referrerId));
      const l1SavedCode = l1UserSnap.data()?.savedReferralCode as string | undefined;
      if (l1SavedCode && l1SavedCode !== payment.referralCode) {
        if (!codeSnapCache.has(l1SavedCode)) {
          const snap = await tx.get(adminDb.collection('referralCodes').doc(l1SavedCode));
          codeSnapCache.set(l1SavedCode, snap);
        }
        const l1CodeSnap = codeSnapCache.get(l1SavedCode)!;
        if (l1CodeSnap.exists
            && l1CodeSnap.data()?.userId !== payment.userId
            && l1CodeSnap.data()?.userId !== payment.referrerId) {
          const l2UserId = l1CodeSnap.data()!.userId as string;
          chain.push({ code: l1SavedCode, referrerId: l2UserId });

          // Niveau 3
          const l2UserSnap = await tx.get(adminDb.collection('users').doc(l2UserId));
          const l2SavedCode = l2UserSnap.data()?.savedReferralCode as string | undefined;
          if (l2SavedCode
              && l2SavedCode !== payment.referralCode
              && l2SavedCode !== l1SavedCode) {
            if (!codeSnapCache.has(l2SavedCode)) {
              const snap = await tx.get(adminDb.collection('referralCodes').doc(l2SavedCode));
              codeSnapCache.set(l2SavedCode, snap);
            }
            const l2CodeSnap = codeSnapCache.get(l2SavedCode)!;
            if (l2CodeSnap.exists
                && l2CodeSnap.data()?.userId !== payment.userId
                && l2CodeSnap.data()?.userId !== payment.referrerId
                && l2CodeSnap.data()?.userId !== l2UserId) {
              chain.push({ code: l2SavedCode, referrerId: l2CodeSnap.data()!.userId });
            }
          }
        }
      }
    }

    // Config niveaux
    const configSnap = await tx.get(adminDb.collection('config').doc('referralSettings'));
    const configLevels = (configSnap.data()?.levels ?? []) as Array<{
      enabled?: boolean; requiresPro?: boolean; rate?: number;
    }>;

    // Lire les docs users parrains si requiresPro (avant les writes)
    const referrerSnapCache = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    for (let i = 0; i < chain.length && i < REFERRAL_RATES.length; i++) {
      const lvlConfig = configLevels[i];
      if (lvlConfig?.requiresPro && !referrerSnapCache.has(chain[i].referrerId)) {
        const snap = await tx.get(adminDb.collection('users').doc(chain[i].referrerId));
        referrerSnapCache.set(chain[i].referrerId, snap);
      }
    }

    // ════════════════════════════════════════════════════════
    // PHASE 2 — CALCULS
    // ════════════════════════════════════════════════════════

    const now = new Date();
    const nowIso = now.toISOString();

    const accessEnd = currentAccessEnd(userSnap.data());
    const base = accessEnd && accessEnd > now ? accessEnd : now;
    const expiresAt = computePlanExpiry(payment.plan, base);

    // ════════════════════════════════════════════════════════
    // PHASE 3 — WRITES UNIQUEMENT (aucun read après ce point)
    // ════════════════════════════════════════════════════════

    tx.update(paymentRef, {
      ...extraPaymentFields,
      status: 'completed',
      completedAt: nowIso,
    });

    const userUpdate: Record<string, unknown> = {
      isPro: true,
      plan: payment.plan,
      planActivatedAt: nowIso,
      planExpiresAt: expiresAt.toISOString(),
      subscriptionEnd: Timestamp.fromDate(expiresAt),
      lastPaymentToken: paymentId,
      lastPaymentProvider: payment.provider ?? 'paydunya',
      cancelAtPeriodEnd: false,
    };
    const existingSavedCode = userSnap.data()?.savedReferralCode as string | undefined;
    if (payment.referralCode && !existingSavedCode) userUpdate.savedReferralCode = payment.referralCode;
    tx.set(userRef, userUpdate, { merge: true });

    // Commissions multi-niveaux
    for (let i = 0; i < chain.length && i < REFERRAL_RATES.length; i++) {
      const { code, referrerId } = chain[i];
      const rate = REFERRAL_RATES[i];
      const commission = Math.round(amountInXof * rate);
      const level = i + 1;

      const lvlConfig = configLevels[i];
      if (lvlConfig?.enabled === false) continue;

      if (lvlConfig?.requiresPro) {
        const referrerSnap = referrerSnapCache.get(referrerId);
        if (!referrerSnap || !isUserPro(referrerSnap.data(), now)) continue;
      }

      tx.set(adminDb.collection('referralEarnings').doc(`pay_${paymentId}_l${level}`), {
        level,
        referrerId,
        referredId: payment.userId,
        referredEmail: payment.userEmail ?? '',
        referralCode: code,
        plan: payment.plan,
        amountPaid: amountInXof,
        amountPaidOriginal: payment.amount,
        commission,
        rate,
        currency: 'XOF',
        provider: payment.provider ?? 'paydunya',
        paymentToken: paymentId,
        status: 'confirmed',
        createdAt: nowIso,
      });

      const codeRef = adminDb.collection('referralCodes').doc(code);
      const codeSnap = codeSnapCache.get(code);
      if (codeSnap?.exists && codeSnap.data()?.userId === referrerId) {
        const codeData = codeSnap.data()!;
        tx.update(codeRef, {
          balance: (codeData.balance ?? 0) + commission,
          totalEarned: (codeData.totalEarned ?? 0) + commission,
          ...(level === 1 ? { usageCount: (codeData.usageCount ?? 0) + 1 } : {}),
        });
      }
    }

    return { result: 'activated' as const, expiresAt };
  });
}

export type PaydunyaActivation =
  | { result: 'activated'; expiresAt: Date }
  | { result: 'already' }
  | { result: 'not_found' }
  | { result: 'not_paid'; status: string }
  | { result: 'mismatch' }
  | { result: 'unreachable' };

/**
 * Active un paiement PayDunya après l'avoir confirmé auprès de l'API PayDunya.
 * Rien de ce que le client (ou l'appelant du webhook) envoie n'est cru : seul le
 * statut renvoyé par PayDunya avec nos clés fait foi.
 */
export async function activatePaydunyaPayment(token: string): Promise<PaydunyaActivation> {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(token)) return { result: 'not_found' };

  const paymentRef = adminDb.collection('payments').doc(token);
  const paymentSnap = await paymentRef.get();
  if (!paymentSnap.exists) return { result: 'not_found' };
  const payment = paymentSnap.data()!;
  if (payment.provider && payment.provider !== 'paydunya') return { result: 'not_found' };
  if (payment.status === 'completed') return { result: 'already' };

  let confirm: Record<string, unknown>;
  try {
    const res = await fetch(`${PAYDUNYA_V1}/checkout-invoice/confirm/${token}`, {
      headers: paydunyaHeaders(),
      cache: 'no-store',
    });
    const json = await res.json();
    if (!json || typeof json !== 'object') return { result: 'unreachable' };
    confirm = json as Record<string, unknown>;
  } catch (err) {
    console.error('PayDunya confirm unreachable:', err);
    return { result: 'unreachable' };
  }

  const invoice = (confirm.invoice ?? {}) as Record<string, unknown>;
  const status = String(confirm.status ?? 'pending').toLowerCase();

  if (status !== 'completed') {
    if ((status === 'cancelled' || status === 'failed') && payment.status === 'pending') {
      await paymentRef.update({ status, updatedAt: new Date().toISOString() });
    }
    return { result: 'not_paid', status };
  }

  // La facture confirmée doit être la nôtre et en mode réel.
  const rawAmount = invoice.total_amount ?? confirm.total_amount;
  const paidAmount = Math.round(Number(rawAmount));
  const liveExpected = process.env.PAYDUNYA_MODE === 'live';
  const modeOk = !liveExpected || String(confirm.mode ?? 'live').toLowerCase() === 'live';
  const tokenOk = !invoice.token || invoice.token === token;
  const expectedAmount = Number(payment.amount);
  const amountOk = Number.isFinite(paidAmount) && paidAmount > 0 && paidAmount >= Math.floor(expectedAmount * 0.9);
  if (!modeOk || !tokenOk || !amountOk) {
    console.error(`PayDunya mismatch for ${token}: paid=${rawAmount} (parsed=${paidAmount}) expected=${payment.amount} mode=${confirm.mode} invoiceKeys=${Object.keys(confirm.invoice ?? {}).join(',')}`);
    return { result: 'mismatch' };
  }

  try {
    const done = await finalizePaidPayment(token, {
      paidAmount,
      receiptUrl: typeof confirm.receipt_url === 'string' ? confirm.receipt_url : null,
    });
    if (done.result === 'activated') {
      console.log(`✅ Plan ${payment.plan} activé pour ${payment.userId} (jusqu'au ${done.expiresAt.toISOString()})`);
    }
    return done;
  } catch (err) {
    console.error(`❌ finalizePaidPayment failed for token=${token} userId=${payment.userId} plan=${payment.plan} amount=${payment.amount}:`, err);
    throw err; // re-throw pour que verify-and-activate logge le 500
  }
}
