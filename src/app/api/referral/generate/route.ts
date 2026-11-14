import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';

/**
 * POST /api/referral/generate
 * Auth: Firebase ID token (Authorization: Bearer …)
 *
 * Génère (ou retourne l'existant) un code de parrainage pour un utilisateur.
 * Format: PRÉNOM + 4 chiffres aléatoires — ex: CHEIKH4821
 */
export async function POST(req: NextRequest) {
  try {
    // Un utilisateur ne peut créer un code que pour lui-même
    const authUser = await verifyRequestUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const userId = authUser.uid;
    const userEmail = authUser.email || '';

    const body = await req.json().catch(() => ({}));
    const profileSnap = await adminDb.collection('users').doc(userId).get();
    const userName = String(profileSnap.data()?.name || body.userName || userEmail || 'Utilisateur')
      .trim()
      .slice(0, 60);

    // Vérifier si l'utilisateur a déjà un code
    const existingSnap = await adminDb
      .collection('referralCodes')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0].data();
      return NextResponse.json({
        code: existing.code,
        balance: existing.balance ?? 0,
        totalEarned: existing.totalEarned ?? 0,
        usageCount: existing.usageCount ?? 0,
        referralUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/abonnement?ref=${existing.code}`,
      });
    }

    // Générer un nouveau code unique
    const firstName = (userName
      .split(' ')[0]
      .normalize('NFD')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 10)) || 'SAMA';

    let code: string;
    let attempts = 0;

    do {
      const digits = Math.floor(1000 + Math.random() * 9000);
      code = `${firstName}${digits}`;
      const exists = await adminDb.collection('referralCodes').doc(code).get();
      if (!exists.exists) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return NextResponse.json({ error: 'Impossible de générer un code unique' }, { status: 500 });
    }

    await adminDb.collection('referralCodes').doc(code).set({
      code,
      userId,
      userEmail: userEmail || '',
      userName,
      balance: 0,
      totalEarned: 0,
      usageCount: 0,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      code,
      balance: 0,
      totalEarned: 0,
      usageCount: 0,
      referralUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/abonnement?ref=${code}`,
    });
  } catch (err) {
    console.error('Referral generate error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * GET /api/referral/generate?userId=xxx
 * Récupère le code et les stats d'un utilisateur (sans en créer un nouveau).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // Chacun ne peut lire que son propre code et son propre solde
    const authUser = await verifyRequestUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const requested = searchParams.get('userId');
    if (requested && requested !== authUser.uid) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }
    const userId = authUser.uid;

    const snap = await adminDb
      .collection('referralCodes')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ code: null });
    }

    const data = snap.docs[0].data();
    return NextResponse.json({
      code: data.code,
      balance: data.balance ?? 0,
      totalEarned: data.totalEarned ?? 0,
      usageCount: data.usageCount ?? 0,
      referralUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/abonnement?ref=${data.code}`,
    });
  } catch (err) {
    console.error('Referral get error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
