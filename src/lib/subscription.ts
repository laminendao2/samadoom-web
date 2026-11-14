import { createHash, timingSafeEqual } from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { computePlanExpiry } from '@/lib/plans';

const REFERRAL_COMMISSION = 0.10; // 10 % du montant payé pour le parrain

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
 * Tout se passe dans une transaction : deux notifications simultanées (webhook +
 * page de succès, ou un webhook rejoué) ne peuvent ni activer deux fois ni
 * créditer deux commissions.
 * À n'appeler qu'APRÈS avoir prouvé le paiement auprès du prestataire.
 */
export async function finalizePaidPayment(
  paymentId: string,
  extraPaymentFields: Record<string, unknown> = {},
): Promise<FinalizeResult> {
  const paymentRef = adminDb.collection('payments').doc(paymentId);

  return adminDb.runTransaction(async (tx) => {
    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists) return { result: 'not_found' as const };
    const payment = paymentSnap.data()!;
    if (payment.status === 'completed') return { result: 'already' as const };

    const userRef = adminDb.collection('users').doc(payment.userId);
    const userSnap = await tx.get(userRef);

    const hasReferral = Boolean(payment.referralCode && payment.referrerId)
      && payment.referrerId !== payment.userId;
    const referrerSnap = hasReferral
      ? await tx.get(adminDb.collection('users').doc(payment.referrerId))
      : null;
    const codeRef = hasReferral
      ? adminDb.collection('referralCodes').doc(payment.referralCode)
      : null;
    const codeSnap = codeRef ? await tx.get(codeRef) : null;

    const now = new Date();
    const nowIso = now.toISOString();

    // Un renouvellement anticipé s'ajoute au temps restant au lieu de l'écraser
    const accessEnd = currentAccessEnd(userSnap.data());
    const base = accessEnd && accessEnd > now ? accessEnd : now;
    const expiresAt = computePlanExpiry(payment.plan, base);

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
    if (payment.referralCode) userUpdate.savedReferralCode = payment.referralCode;
    tx.set(userRef, userUpdate, { merge: true });

    // Commission du parrain : seulement s'il a lui-même un abonnement actif
    if (hasReferral && codeRef && codeSnap?.exists
        && codeSnap.data()?.userId === payment.referrerId
        && isUserPro(referrerSnap?.data(), now)) {
      const commission = Math.round(payment.amount * REFERRAL_COMMISSION);
      // Id déterministe : un paiement ne peut créer qu'une seule ligne de gain
      tx.set(adminDb.collection('referralEarnings').doc(`pay_${paymentId}`), {
        referrerId: payment.referrerId,
        referredId: payment.userId,
        referredEmail: payment.userEmail ?? '',
        referralCode: payment.referralCode,
        plan: payment.plan,
        amountPaid: payment.amount,
        commission,
        currency: payment.currency ?? 'XOF',
        provider: payment.provider ?? 'paydunya',
        paymentToken: paymentId,
        status: 'confirmed',
        createdAt: nowIso,
      });
      const code = codeSnap.data()!;
      tx.update(codeRef, {
        balance: (code.balance ?? 0) + commission,
        totalEarned: (code.totalEarned ?? 0) + commission,
        usageCount: (code.usageCount ?? 0) + 1,
      });
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

  // La facture confirmée doit être la nôtre, en mode réel, et au bon montant
  const paidAmount = Math.round(Number(invoice.total_amount));
  const liveExpected = process.env.PAYDUNYA_MODE === 'live';
  const modeOk = !liveExpected || String(confirm.mode ?? 'live').toLowerCase() === 'live';
  const tokenOk = !invoice.token || invoice.token === token;
  if (!modeOk || !tokenOk || !Number.isFinite(paidAmount) || paidAmount < Number(payment.amount)) {
    console.error(`PayDunya mismatch for ${token}: paid=${invoice.total_amount} expected=${payment.amount} mode=${confirm.mode}`);
    return { result: 'mismatch' };
  }

  const done = await finalizePaidPayment(token, {
    paidAmount,
    receiptUrl: typeof confirm.receipt_url === 'string' ? confirm.receipt_url : null,
  });
  if (done.result === 'activated') {
    console.log(`✅ Plan ${payment.plan} activé pour ${payment.userId} (jusqu'au ${done.expiresAt.toISOString()})`);
  }
  return done;
}
