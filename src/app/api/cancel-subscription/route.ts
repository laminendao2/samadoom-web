import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    // Vérifier l'authentification via le token Firebase
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
    }

    // Vérifier que l'utilisateur a bien un abonnement actif
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    const userData = userDoc.data()!;
    if (!userData.isPro) {
      return NextResponse.json({ error: 'Aucun abonnement actif' }, { status: 400 });
    }

    if (userData.cancelAtPeriodEnd) {
      return NextResponse.json({ error: 'Abonnement déjà en cours d\'annulation' }, { status: 400 });
    }

    // Marquer pour annulation à la fin de la période — accès Pro maintenu jusqu'à planExpiresAt
    await adminDb.collection('users').doc(uid).update({
      cancelAtPeriodEnd: true,
      planCancelledAt: new Date().toISOString(),
    });

    console.log(`⏳ Annulation programmée pour ${uid} (plan: ${userData.plan}, expire: ${userData.planExpiresAt})`);

    return NextResponse.json({
      success: true,
      planExpiresAt: userData.planExpiresAt ?? null,
    });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
