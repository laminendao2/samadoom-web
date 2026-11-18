import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';
import { REFERRAL_COMMISSION } from '@/lib/subscription';
import { stripeCentsToXof } from '@/lib/fx';

/**
 * SuperAdmin uniquement — rattacher après coup un paiement complété à un code parrain
 * (l'acheteur a oublié de saisir ou d'appliquer le code) et créditer la commission.
 * L'acheteur ne reçoit pas de réduction rétroactive.
 *
 * POST { paymentId, referralCode }
 */
export async function POST(req: NextRequest) {
  const authUser = await verifyRequestUser(req);
  if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const callerSnap = await adminDb.collection('users').doc(authUser.uid).get();
  const caller = callerSnap.data();
  const isSuperAdmin = caller?.role === 'superadmin'
    || (Array.isArray(caller?.roles) && caller.roles.includes('superadmin'));
  if (!isSuperAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const paymentId = typeof body?.paymentId === 'string' ? body.paymentId.trim() : '';
  const referralCode = typeof body?.referralCode === 'string' ? body.referralCode.trim().toUpperCase() : '';
  if (!paymentId || !/^[A-Z0-9]{3,20}$/.test(referralCode)) {
    return NextResponse.json({ error: 'paymentId et referralCode requis' }, { status: 400 });
  }

  const paymentRef = adminDb.collection('payments').doc(paymentId);
  const codeRef = adminDb.collection('referralCodes').doc(referralCode);
  const earningRef = adminDb.collection('referralEarnings').doc(`pay_${paymentId}`);

  // Conversion hors transaction (appel réseau possible pour l'USD)
  const pre = (await paymentRef.get()).data();
  if (!pre) return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });
  if (typeof pre.amount !== 'number' || pre.amount <= 0) {
    return NextResponse.json({ error: 'Montant du paiement invalide' }, { status: 400 });
  }
  const currency = String(pre.currency ?? 'XOF').toUpperCase();
  const amountXof = (currency === 'USD' || currency === 'EUR')
    ? await stripeCentsToXof(pre.amount, currency.toLowerCase() as 'usd' | 'eur')
    : pre.amount;
  const commission = Math.round(amountXof * REFERRAL_COMMISSION);

  const outcome = await adminDb.runTransaction(async (tx) => {
    const [paySnap, codeSnap, earningSnap] = await Promise.all([
      tx.get(paymentRef), tx.get(codeRef), tx.get(earningRef),
    ]);
    if (!paySnap.exists) return { status: 404, error: 'Paiement introuvable' };
    const p = paySnap.data()!;
    if (p.status !== 'completed') return { status: 400, error: `Paiement non complété (statut : ${p.status})` };
    if (p.amount !== pre.amount) return { status: 409, error: 'Le paiement a changé, réessayez' };
    if (p.referralCode && p.referralCode !== referralCode) {
      return { status: 400, error: `Ce paiement est déjà rattaché au code ${p.referralCode}` };
    }
    if (earningSnap.exists) return { status: 409, error: 'Commission déjà enregistrée pour ce paiement' };
    if (!codeSnap.exists) return { status: 404, error: 'Code parrain introuvable' };
    const code = codeSnap.data()!;
    if (!code.userId || code.userId === p.userId) return { status: 400, error: 'Auto-parrainage impossible' };

    const nowIso = new Date().toISOString();
    tx.update(paymentRef, {
      referralCode,
      referrerId: code.userId,
      referralAttachedByAdmin: true,
      referralAttachedAt: nowIso,
    });
    const buyerSnap = await tx.get(adminDb.collection('users').doc(p.userId));
    const prevCode = buyerSnap.data()?.savedReferralCode as string | undefined;
    tx.set(adminDb.collection('users').doc(p.userId), {
      savedReferralCode: referralCode,
      ...(prevCode && prevCode !== referralCode ? { savedReferralCodePrev: prevCode, savedReferralCodeChangedByAdmin: nowIso } : {}),
    }, { merge: true });
    tx.set(earningRef, {
      referrerId: code.userId,
      referredId: p.userId,
      referredEmail: p.userEmail ?? '',
      referralCode,
      plan: p.plan,
      amountPaid: amountXof,
      amountPaidOriginal: p.amount,
      commission,
      currency: 'XOF',
      provider: p.provider ?? 'paydunya',
      paymentToken: paymentId,
      status: 'confirmed',
      createdAt: typeof p.completedAt === 'string' ? p.completedAt : nowIso,
      fixedByAdmin: true,
      fixedAt: nowIso,
    });
    tx.update(codeRef, {
      balance: (code.balance ?? 0) + commission,
      totalEarned: (code.totalEarned ?? 0) + commission,
      usageCount: (code.usageCount ?? 0) + 1,
    });
    return { status: 200, referrerId: code.userId as string };
  });

  if (outcome.status !== 200) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  return NextResponse.json({ result: 'credited', paymentId, referralCode, commission, amountXof });
}
