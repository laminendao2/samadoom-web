import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';

/**
 * Marque un paiement PayDunya comme "cancelled" dans Firestore.
 * Appelé quand l'utilisateur revient sur /abonnement?status=cancel
 * après avoir abandonné le checkout PayDunya.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyRequestUser(req);
    if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { token } = await req.json().catch(() => ({ token: null }));
    if (!token || typeof token !== 'string' || !/^[A-Za-z0-9_-]{6,80}$/.test(token)) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 400 });
    }

    const paymentRef = adminDb.collection('payments').doc(token);
    const snap = await paymentRef.get();
    if (!snap.exists) return NextResponse.json({ ok: true }); // déjà absent

    const data = snap.data()!;
    // Sécurité : seul le propriétaire peut annuler son propre paiement
    if (data.userId !== authUser.uid) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }
    // Ne pas écraser un paiement déjà complété
    if (data.status === 'completed') {
      return NextResponse.json({ ok: true, skipped: 'completed' });
    }
    if (data.status !== 'pending') {
      return NextResponse.json({ ok: true, skipped: data.status });
    }

    await paymentRef.update({ status: 'cancelled', updatedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('cancel-invoice error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
