import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { computePlanExpiry } from '@/lib/plans';

const PAYDUNYA_BASE_URL = process.env.PAYDUNYA_MODE === 'live'
  ? 'https://app.paydunya.com/api/v1'
  : 'https://app.paydunya.com/sandbox-api/v1';

const REFERRAL_COMMISSION = 0.10;

export async function POST(req: NextRequest) {
  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const idToken = authHeader.slice(7);
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
    }

    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: 'Token requis' }, { status: 400 });
    }

    // Vérifier le paiement dans Firestore
    const paymentRef = adminDb.collection('payments').doc(token);
    const paymentDoc = await paymentRef.get();

    if (!paymentDoc.exists) {
      return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });
    }

    const payment = paymentDoc.data()!;

    // Sécurité : l'utilisateur ne peut vérifier que son propre paiement
    if (payment.userId !== decodedToken.uid) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Déjà complété
    if (payment.status === 'completed') {
      return NextResponse.json({ status: 'already_activated', message: 'Abonnement déjà activé' });
    }

    // Vérifier le statut réel chez PayDunya
    const verifyRes = await fetch(
      `${PAYDUNYA_BASE_URL}/checkout-invoice/confirm/${token}`,
      {
        headers: {
          'PAYDUNYA-MASTER-KEY': process.env.PAYDUNYA_MASTER_KEY!,
          'PAYDUNYA-PRIVATE-KEY': process.env.PAYDUNYA_PRIVATE_KEY!,
          'PAYDUNYA-TOKEN': process.env.PAYDUNYA_TOKEN!,
          'PAYDUNYA-PUBLIC-KEY': process.env.PAYDUNYA_PUBLIC_KEY!,
        },
      }
    );

    const verifyData = await verifyRes.json();
    console.log('PayDunya verify response:', JSON.stringify(verifyData));

    const invoiceStatus = verifyData?.data?.invoice?.status ?? verifyData?.status;

    if (invoiceStatus !== 'completed') {
      return NextResponse.json({
        status: invoiceStatus ?? 'pending',
        message: 'Paiement non confirmé par PayDunya',
        raw: verifyData,
      });
    }

    // Activer l'abonnement
    const expiresAt = computePlanExpiry(payment.plan);

    await paymentRef.update({
      status: 'completed',
      completedAt: new Date().toISOString(),
      activatedManually: true,
    });

    await adminDb.collection('users').doc(payment.userId).update({
      isPro: true,
      plan: payment.plan,
      planActivatedAt: new Date().toISOString(),
      planExpiresAt: expiresAt.toISOString(),
      subscriptionEnd: Timestamp.fromDate(expiresAt),
      lastPaymentToken: token,
      lastPaymentProvider: 'paydunya',
    });

    console.log(`✅ Plan ${payment.plan} activé manuellement pour ${payment.userId}`);

    // Parrainage
    if (payment.referralCode && payment.referrerId) {
      try {
        const referrerDoc = await adminDb.collection('users').doc(payment.referrerId).get();
        const referrerData = referrerDoc.data();
        const toDate = (val: unknown): Date | null => {
          if (!val) return null;
          if (val && typeof (val as { toDate?: () => Date }).toDate === 'function') return (val as { toDate: () => Date }).toDate();
          if (typeof val === 'string' || typeof val === 'number') { const d = new Date(val as string); return isNaN(d.getTime()) ? null : d; }
          return null;
        };
        const now = new Date();
        const isReferrerPro = referrerData?.isPro === true ||
          (toDate(referrerData?.planExpiresAt) !== null && toDate(referrerData?.planExpiresAt)! > now) ||
          (toDate(referrerData?.subscriptionEnd) !== null && toDate(referrerData?.subscriptionEnd)! > now);
        if (isReferrerPro) {
          const commission = Math.round(payment.amount * REFERRAL_COMMISSION);
          await adminDb.collection('referralEarnings').add({
            referrerId: payment.referrerId,
            referredId: payment.userId,
            referredEmail: payment.userEmail,
            referralCode: payment.referralCode,
            plan: payment.plan,
            amountPaid: payment.amount,
            commission,
            paymentToken: token,
            status: 'confirmed',
            createdAt: new Date().toISOString(),
          });
          await adminDb.collection('referralCodes').doc(payment.referralCode).update({
            balance: FieldValue.increment(commission),
            totalEarned: FieldValue.increment(commission),
            usageCount: FieldValue.increment(1),
          });
        }
      } catch (refErr) {
        console.error('Referral commission error:', refErr);
      }
    }

    return NextResponse.json({
      status: 'activated',
      message: 'Abonnement activé avec succès',
      planExpiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error('verify-and-activate error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
