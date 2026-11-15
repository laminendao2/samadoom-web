import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { finalizePaidPayment } from '@/lib/subscription';
import { verifyRequestUser } from '@/lib/server-auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-10-28.endive',
});

/**
 * POST /api/stripe/activate-session
 *
 * Fallback d'activation côté client : appelé depuis la page /abonnement/success
 * quand provider=stripe est dans l'URL. Vérifie auprès de Stripe que la session
 * est bien payée, puis appelle finalizePaidPayment (idempotente).
 *
 * Corps : { sessionId: string }
 * Authentification : Firebase ID token dans Authorization: Bearer <token>
 */
export async function POST(req: NextRequest) {
  // 1. Vérifier l'auth Firebase
  const decoded = await verifyRequestUser(req);
  if (!decoded) {
    return NextResponse.json({ error: 'Non authentifié ou token invalide' }, { status: 401 });
  }
  const uid = decoded.uid;

  // 2. Lire le sessionId
  const body = await req.json().catch(() => ({}));
  const { sessionId } = body as { sessionId?: string };
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'sessionId manquant' }, { status: 400 });
  }

  // 3. Récupérer la session Stripe pour confirmer le paiement
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error('activate-session: stripe retrieve error', err);
    return NextResponse.json({ error: 'Session Stripe introuvable' }, { status: 404 });
  }

  if (session.payment_status !== 'paid') {
    return NextResponse.json(
      { status: 'pending', message: 'Paiement non encore confirmé par Stripe' },
      { status: 202 }
    );
  }

  // 4. Activer l'abonnement (idempotent)
  try {
    const outcome = await finalizePaidPayment(session.id, {
      stripeSessionId: session.id,
      stripePaymentIntent:
        typeof session.payment_intent === 'string' ? session.payment_intent : null,
      paidAmount: session.amount_total ?? null,
    });

    if (outcome.result === 'not_found') {
      console.error('activate-session: paiement introuvable pour', session.id, 'uid', uid);
      return NextResponse.json(
        { status: 'error', message: 'Paiement introuvable en base — contactez le support' },
        { status: 404 }
      );
    }

    console.log(`activate-session: session ${session.id} → ${outcome.result} (uid ${uid})`);
    return NextResponse.json({ status: 'activated', result: outcome.result });
  } catch (err) {
    console.error('activate-session: finalizePaidPayment error', err);
    return NextResponse.json(
      { status: 'error', message: 'Erreur interne' },
      { status: 500 }
    );
  }
}
