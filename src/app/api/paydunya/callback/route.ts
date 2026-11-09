import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const REFERRAL_COMMISSION = 0.10; // 10% du montant payé pour le parrain

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    console.log('PayDunya callback received:', JSON.stringify(data));

    const token = data?.data?.invoice?.token;
    const status = data?.data?.invoice?.status; // 'completed', 'cancelled', 'failed'

    if (!token) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 400 });
    }

    const paymentRef = adminDb.collection('payments').doc(token);
    const paymentDoc = await paymentRef.get();

    if (!paymentDoc.exists) {
      return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });
    }

    const payment = paymentDoc.data()!;

    if (status === 'completed') {
      // Mettre à jour le paiement
      await paymentRef.update({
        status: 'completed',
        completedAt: new Date().toISOString(),
        paydunyaData: data?.data,
      });

      // Activer l'abonnement de l'utilisateur
      const expiresAt = new Date();
      if (payment.plan === 'mensuel') {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else if (payment.plan === 'annuel') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }

      await adminDb.collection('users').doc(payment.userId).update({
        isPro: true,
        plan: payment.plan,
        planActivatedAt: new Date().toISOString(),
        planExpiresAt: expiresAt.toISOString(),
        lastPaymentToken: token,
        lastPaymentProvider: 'paydunya',
      });

      console.log(`✅ Plan ${payment.plan} activé pour ${payment.userId}`);

      // --- Gestion du parrainage ---
      if (payment.referralCode && payment.referrerId) {
        try {
          // Vérifier que le parrain a toujours un abonnement actif
          const referrerDoc = await adminDb.collection('users').doc(payment.referrerId).get();
          const referrerData = referrerDoc.data();
          if (!referrerData?.isPro) {
            console.log(`⚠️ Parrain ${payment.referrerId} n'a pas d'abonnement actif — commission non créditée`);
            return NextResponse.json({ received: true });
          }

          const amountPaid = payment.amount; // montant réellement payé (après réduction)
          const commission = Math.round(amountPaid * REFERRAL_COMMISSION);

          // Enregistrer le gain
          await adminDb.collection('referralEarnings').add({
            referrerId: payment.referrerId,
            referredId: payment.userId,
            referredEmail: payment.userEmail,
            referralCode: payment.referralCode,
            plan: payment.plan,
            amountPaid,
            commission,
            paymentToken: token,
            status: 'confirmed',
            createdAt: new Date().toISOString(),
          });

          // Mettre à jour le solde et stats du parrain
          await adminDb.collection('referralCodes').doc(payment.referralCode).update({
            balance: FieldValue.increment(commission),
            totalEarned: FieldValue.increment(commission),
            usageCount: FieldValue.increment(1),
          });

          console.log(`💰 Commission ${commission} FCFA créditée au parrain ${payment.referrerId} (code: ${payment.referralCode})`);
        } catch (refErr) {
          // Ne pas bloquer le paiement si le parrainage échoue
          console.error('Referral commission error:', refErr);
        }
      }
    } else if (status === 'cancelled' || status === 'failed') {
      await paymentRef.update({
        status: status,
        updatedAt: new Date().toISOString(),
      });
      console.log(`❌ Paiement ${status} pour token ${token}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('PayDunya callback error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
