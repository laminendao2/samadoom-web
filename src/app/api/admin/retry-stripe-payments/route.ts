import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';
import { finalizePaidPayment } from '@/lib/subscription';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-10-28.endive',
});

/**
 * POST /api/admin/retry-stripe-payments
 *
 * SuperAdmin uniquement — parcourt tous les paiements Stripe "pending" en Firestore,
 * interroge l'API Stripe pour connaître le vrai statut, puis :
 *   - payment_status === 'paid'    → finalizePaidPayment (activation idempotente)
 *   - payment_status !== 'paid'    → marque le doc Firestore "cancelled"
 */
export async function POST(req: NextRequest) {
  const authUser = await verifyRequestUser(req);
  if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const userDoc = await adminDb.collection('users').doc(authUser.uid).get();
  const userData = userDoc.data();
  const isSuperAdmin =
    userData?.role === 'superadmin' ||
    (Array.isArray(userData?.roles) && userData.roles.includes('superadmin'));
  if (!isSuperAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  const snap = await adminDb
    .collection('payments')
    .where('status', '==', 'pending')
    .where('provider', '==', 'stripe')
    .get();

  const results: { sessionId: string; result: string }[] = [];

  for (const doc of snap.docs) {
    const sessionId = doc.id;
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === 'paid') {
        const outcome = await finalizePaidPayment(session.id, {
          stripeSessionId: session.id,
          stripePaymentIntent:
            typeof session.payment_intent === 'string' ? session.payment_intent : null,
          paidAmount: session.amount_total ?? null,
        });
        results.push({ sessionId, result: outcome.result });
      } else {
        // Pas payé → annuler proprement
        await doc.ref.update({ status: 'cancelled', cancelledAt: new Date().toISOString() });
        results.push({ sessionId, result: `cancelled (stripe status: ${session.payment_status})` });
      }
    } catch (err) {
      results.push({ sessionId, result: `error: ${String(err)}` });
    }
    await new Promise(r => setTimeout(r, 150));
  }

  const activated = results.filter(r => r.result === 'activated').length;
  const already   = results.filter(r => r.result === 'already').length;
  const cancelled = results.filter(r => r.result.startsWith('cancelled')).length;
  const errors    = results.filter(r => r.result.startsWith('error')).length;

  return NextResponse.json({ total: results.length, activated, already, cancelled, errors, details: results });
}
