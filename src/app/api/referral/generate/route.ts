import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * POST /api/referral/generate
 * Body: { userId, userName, userEmail }
 *
 * Génère (ou retourne l'existant) un code de parrainage pour un utilisateur.
 * Format: PRÉNOM + 4 chiffres aléatoires — ex: CHEIKH4821
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, userName, userEmail } = await req.json();

    if (!userId || !userName) {
      return NextResponse.json({ error: 'userId et userName requis' }, { status: 400 });
    }

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
    const firstName = userName
      .split(' ')[0]
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 10);

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
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    }

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
