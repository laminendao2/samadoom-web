import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';
import { activatePaydunyaPayment } from '@/lib/subscription';

/**
 * Appelée par la page de succès : confirme le paiement auprès de PayDunya et
 * active l'abonnement si le webhook ne l'a pas déjà fait.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyRequestUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { token } = await req.json().catch(() => ({ token: null }));
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token requis' }, { status: 400 });
    }

    const paymentDoc = await adminDb.collection('payments').doc(token).get();
    if (!paymentDoc.exists) {
      return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });
    }
    // Sécurité : l'utilisateur ne peut vérifier que son propre paiement
    if (paymentDoc.data()!.userId !== authUser.uid) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const outcome = await activatePaydunyaPayment(token);

    switch (outcome.result) {
      case 'activated':
        return NextResponse.json({
          status: 'activated',
          message: 'Abonnement activé avec succès',
          planExpiresAt: outcome.expiresAt.toISOString(),
        });
      case 'already':
        return NextResponse.json({ status: 'already_activated', message: 'Abonnement déjà activé' });
      case 'not_paid':
        return NextResponse.json({
          status: outcome.status === 'cancelled' || outcome.status === 'failed' ? outcome.status : 'pending',
          message: 'Paiement non confirmé par PayDunya',
        });
      case 'unreachable':
        return NextResponse.json({ status: 'pending', message: 'Confirmation PayDunya momentanément indisponible' });
      case 'mismatch':
        return NextResponse.json({ status: 'error', message: 'Montant payé incohérent — contactez le support' });
      default:
        return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });
    }
  } catch (err) {
    console.error('verify-and-activate error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
