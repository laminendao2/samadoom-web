import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/referral/validate?code=CHEIKH4821&userId=xxx
 *
 * Valide un code de parrainage.
 * - Vérifie que le code existe (toute personne inscrite peut partager un code)
 * - Vérifie que l'utilisateur n'utilise pas son propre code
 * Retourne: { valid, discountPercent, referrerName }
 *
 * Note : on ne requiert PAS que le parrain soit Pro pour accepter son code.
 * Le code est valide dès qu'il est généré. La commission est créditée quand
 * quelqu'un s'abonne via ce code, que le parrain soit Pro ou non.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code')?.toUpperCase().trim();
    const userId = searchParams.get('userId');

    if (!code) {
      return NextResponse.json({ valid: false, error: 'Code manquant' });
    }

    const snap = await adminDb.collection('referralCodes').doc(code).get();

    if (!snap.exists) {
      return NextResponse.json({
        valid: false,
        error: 'Code introuvable. Votre ami doit d\'abord activer son code sur samadoom.com/referral',
      });
    }

    const referral = snap.data()!;

    // Bloquer l'auto-parrainage
    if (userId && referral.userId === userId) {
      return NextResponse.json({ valid: false, error: 'Vous ne pouvez pas utiliser votre propre code' });
    }

    return NextResponse.json({
      valid: true,
      discountPercent: 5,
      referrerName: referral.userName,
      code: referral.code,
    });
  } catch (err) {
    console.error('Referral validate error:', err);
    return NextResponse.json({ valid: false, error: 'Erreur serveur' });
  }
}
