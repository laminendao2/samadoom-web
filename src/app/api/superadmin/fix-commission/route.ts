import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';
import { Timestamp } from 'firebase-admin/firestore';

const REFERRAL_COMMISSION = 0.10;

export async function POST(req: NextRequest) {
  const authUser = await verifyRequestUser(req);
  if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  // Vérifier SuperAdmin
  const callerSnap = await adminDb.collection('users').doc(authUser.uid).get();
  const callerData = callerSnap.data();
  const isSuperAdmin = callerData?.role === 'superadmin' || (Array.isArray(callerData?.roles) && callerData.roles.includes('superadmin'));
  if (!isSuperAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  const { paymentId } = await req.json();
  if (!paymentId) return NextResponse.json({ error: 'paymentId requis' }, { status: 400 });

  const paymentRef = adminDb.collection('payments').doc(paymentId);
  const paymentSnap = await paymentRef.get();
  if (!paymentSnap.exists) return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });

  const payment = paymentSnap.data()!;
  if (payment.status !== 'completed') return NextResponse.json({ error: `Statut: ${payment.status}` }, { status: 400 });
  if (!payment.referralCode || !payment.referrerId) return NextResponse.json({ error: 'Pas de code de parrainage sur ce paiement' }, { status: 400 });

  const earningRef = adminDb.collection('referralEarnings').doc(`pay_${paymentId}`);
  const earningSnap = await earningRef.get();
  if (earningSnap.exists) return NextResponse.json({ result: 'already_exists', message: 'Commission déjà enregistrée' });

  // Vérifier que le code existe et appartient bien au referrerId
  const codeSnap = await adminDb.collection('referralCodes').doc(payment.referralCode).get();
  if (!codeSnap.exists) return NextResponse.json({ error: 'Code parrain introuvable' }, { status: 404 });
  if (codeSnap.data()!.userId !== payment.referrerId) return NextResponse.json({ error: 'Code ne correspond pas au parrain' }, { status: 400 });

  const commission = Math.round(payment.amount * REFERRAL_COMMISSION);
  const nowIso = new Date().toISOString();
  const code = codeSnap.data()!;

  await adminDb.runTransaction(async (tx) => {
    // Vérifier une dernière fois l'idempotence
    const earningCheck = await tx.get(earningRef);
    if (earningCheck.exists) return;

    tx.set(earningRef, {
      referrerId: payment.referrerId,
      referredId: payment.userId,
      referredEmail: payment.userEmail ?? '',
      referralCode: payment.referralCode,
      plan: payment.plan,
      amountPaid: payment.amount,
      commission,
      currency: payment.currency ?? 'XOF',
      provider: payment.provider ?? 'stripe',
      paymentToken: paymentId,
      status: 'confirmed',
      createdAt: nowIso,
      fixedByAdmin: true,
    });

    tx.update(adminDb.collection('referralCodes').doc(payment.referralCode), {
      balance: (code.balance ?? 0) + commission,
      totalEarned: (code.totalEarned ?? 0) + commission,
      usageCount: (code.usageCount ?? 0) + 1,
    });
  });

  return NextResponse.json({
    result: 'credited',
    paymentId,
    referrerId: payment.referrerId,
    referralCode: payment.referralCode,
    commission,
    currency: payment.currency ?? 'XOF',
  });
}
