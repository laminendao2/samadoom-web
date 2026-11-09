import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-28.acacia',
});

const REFERRAL_COMMISSION = 0.20;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Stripe webhook signature error:', err);
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    const { userId, plan, referralCode, referrerId } = session.metadata || {};
    const amountPaid = session.amount_total ?? 0; // centimes USD
    const userEmail = session.customer_email || session.metadata?.userEmail || '';

    if (!userId || !plan) {
      console.error('Missing metadata in Stripe session:', session.id);
      return NextResponse.json({ received: true });
    }

    try {
      // Calculer expiration abonnement
      const expiresAt = new Date();
      if (plan === 'mensuel') {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else if (plan === 'annuel') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }

      // Activer l'abonnement
      await adminDb.collection('users').doc(userId).update({
        isPro: true,
        plan,
        planActivatedAt: new Date().toISOString(),
        planExpiresAt: expiresAt.toISOString(),
        lastPaymentToken: session.id,
        lastPaymentProvider: 'stripe',
      });

      // Mettre à jour le paiement
      await adminDb.collection('payments').doc(session.id).update({
        status: 'completed',
        completedAt: new Date().toISOString(),
        stripeSessionId: session.id,
        stripePaymentIntent: session.payment_intent,
      });

      console.log(`✅ Stripe — Plan ${plan} activé pour ${userId}`);

      // Parrainage
      if (referralCode && referrerId) {
        try {
          const referrerDoc = await adminDb.collection('users').doc(referrerId).get();
          if (referrerDoc.data()?.isPro) {
            const commission = Math.round(amountPaid * REFERRAL_COMMISSION);

            await adminDb.collection('referralEarnings').add({
              referrerId,
              referredId: userId,
              referredEmail: userEmail,
              referralCode,
              plan,
              amountPaid,
              commission,
              currency: 'usd',
              paymentToken: session.id,
              status: 'confirmed',
              provider: 'stripe',
              createdAt: new Date().toISOString(),
            });

            await adminDb.collection('referralCodes').doc(referralCode).update({
              balance: FieldValue.increment(commission),
              totalEarned: FieldValue.increment(commission),
              usageCount: FieldValue.increment(1),
            });

            console.log(`💰 Stripe commission ${commission}¢ créditée au parrain ${referrerId}`);
          }
        } catch (refErr) {
          console.error('Stripe referral commission error:', refErr);
        }
      }
    } catch (err) {
      console.error('Stripe webhook processing error:', err);
    }
  }

  return NextResponse.json({ received: true });
}
