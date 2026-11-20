import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { activatePaydunyaPayment } from '@/lib/subscription';
import { verifyRequestUser, isSuperAdminUid } from '@/lib/server-auth';

export const preferredRegion = 'cdg1';

// Nombre d'heures au-delà desquelles un paiement "pending" est considéré abandonné
const EXPIRY_HOURS = Number(process.env.PENDING_EXPIRY_HOURS ?? '2');

/**
 * Expire les paiements PayDunya restés en attente trop longtemps.
 *
 * Mécanisme :
 *  - On cherche les paiements provider=paydunya avec status=pending créés il y a
 *    plus de EXPIRY_HOURS heures.
 *  - Pour chacun, on appelle l'API PayDunya pour connaître l'état réel.
 *  - Si PayDunya confirme que le paiement est encore pending/cancelled/failed,
 *    on met à jour Firestore.
 *  - Si PayDunya confirme que c'est completed, on active l'abonnement normalement.
 *
 * Accès : SuperAdmin uniquement (ou clé secrète interne pour un cron Vercel).
 *
 * Usage manuel (admin) :
 *   POST /api/paydunya/expire-pending
 *   Authorization: Bearer <firebase-id-token>
 *
 * Usage cron Vercel :
 *   GET  /api/paydunya/expire-pending
 *   x-cron-secret: <CRON_SECRET env var>
 */
async function runExpiry(): Promise<{ checked: number; expired: number; activated: number; errors: number }> {
  const cutoff = new Date(Date.now() - EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  const snap = await adminDb.collection('payments')
    .where('status', '==', 'pending')
    .where('provider', '==', 'paydunya')
    .where('createdAt', '<', cutoff)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  if (snap.empty) {
    return { checked: 0, expired: 0, activated: 0, errors: 0 };
  }

  let expired = 0;
  let activated = 0;
  let errors = 0;

  for (const doc of snap.docs) {
    const token = doc.id;
    try {
      const outcome = await activatePaydunyaPayment(token);
      if (outcome.result === 'activated') {
        activated++;
        console.log(`expire-pending: ✅ activated ${token}`);
      } else if (outcome.result === 'not_paid') {
        // Si status != 'completed' et != 'cancelled'/'failed', PayDunya dit encore "pending"
        // → on force à "expired" pour qu'il n'encombre plus le tableau de bord
        const status = outcome.status;
        const finalStatus = (status === 'cancelled' || status === 'failed') ? status : 'expired';
        await adminDb.collection('payments').doc(token).update({
          status: finalStatus,
          updatedAt: new Date().toISOString(),
          expiredAt: new Date().toISOString(),
        });
        expired++;
        console.log(`expire-pending: ⌛ ${finalStatus} ${token} (PayDunya status: ${status})`);
      } else if (outcome.result === 'unreachable') {
        // PayDunya indisponible → on ne touche pas au statut, on réessaiera plus tard
        errors++;
        console.warn(`expire-pending: PayDunya unreachable for ${token}`);
      }
      // 'already' et 'not_found' : rien à faire
    } catch (err) {
      errors++;
      console.error(`expire-pending: error for ${token}:`, err);
    }
  }

  return { checked: snap.size, expired, activated, errors };
}

/** Cron Vercel (GET avec header secret) */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET non configuré' }, { status: 500 });
  }
  if (req.headers.get('x-cron-secret') !== cronSecret) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const stats = await runExpiry();
  return NextResponse.json({ ok: true, ...stats });
}

/** Appel manuel SuperAdmin */
export async function POST(req: NextRequest) {
  const user = await verifyRequestUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (!(await isSuperAdminUid(user.uid))) {
    return NextResponse.json({ error: 'Réservé aux super-admins' }, { status: 403 });
  }

  const stats = await runExpiry();
  return NextResponse.json({ ok: true, ...stats });
}
