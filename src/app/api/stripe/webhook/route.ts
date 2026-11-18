import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { finalizePaidPayment } from '@/lib/subscription';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-10-28.endive',
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  let event: Stripe.Event;

  try {
    if (!sig) throw new Error('signature absente');
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Stripe webhook signature error:', err);
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object as Stripe.Checkout.Session;

    // Une session peut se terminer sans être payée (moyens de paiement différés)
    if (session.payment_status !== 'paid') {
      console.log(`Stripe session ${session.id} terminée mais non payée (${session.payment_status})`);
      return NextResponse.json({ received: true });
    }

    try {
      // Idempotent : Stripe peut renvoyer le même événement plusieurs fois
      const outcome = await finalizePaidPayment(session.id, {
        stripeSessionId: session.id,
        stripePaymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        paidAmount: session.amount_total ?? null,
      });
      if (outcome.result === 'not_found') {
        console.error('Stripe webhook: paiement introuvable pour la session', session.id);
      } else {
        console.log(`Stripe session ${session.id}: ${outcome.result}`);
      }
    } catch (err) {
      console.error('Stripe webhook processing error:', err);
      // 500 → Stripe réessaiera
      return NextResponse.json({ error: 'Erreur de traitement' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
