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

    // Annuler l'abonnement
    await adminDb.collection('users').doc(uid).update({
      isPro: false,
      plan: null,
      planCancelledAt: new Date().toISOString(),
    });

    console.log(`❌ Abonnement annulé pour ${uid} (plan: ${userData.plan})`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
