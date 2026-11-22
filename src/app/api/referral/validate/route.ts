import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/referral/validate?code=CHEIKH4821&userId=xxx
 *
 * Valide un code de parrainage.
 * - Vérifie que le code existe
 * - Vérifie que l'utilisateur n'utilise pas son propre code
 * - Vérifie que l'utilisateur n'essaie pas de changer son parrain existant
 * Retourne: { valid, discountPercent, referrerName, ownerId }
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
        error: "Code introuvable. Votre ami doit d'abord activer son code sur samadoom.com/referral",
      });
    }

    const referral = snap.data()!;

    // Bloquer l'auto-parrainage
    if (userId && referral.userId === userId) {
      return NextResponse.json({ valid: false, error: 'Vous ne pouvez pas utiliser votre propre code de parrainage' });
    }

    // Bloquer le changement de parrain : si l'utilisateur a déjà un savedReferralCode, il ne peut pas en utiliser un autre
    if (userId) {
      const userSnap = await adminDb.collection('users').doc(userId).get();
      const savedCode = userSnap.data()?.savedReferralCode as string | undefined;
      if (savedCode && savedCode !== code) {
        return NextResponse.json({
          valid: false,
          error: 'Vous avez déjà un parrain enregistré. Contactez le support pour tout changement.',
        });
      }
    }

    return NextResponse.json({
      valid: true,
      discountPercent: 5,
      referrerName: referral.userName,
      code: referral.code,
      ownerId: referral.userId, // permet au client de bloquer l'auto-parrainage si userId manquait
    });
  } catch (err) {
    console.error('Referral validate error:', err);
    return NextResponse.json({ valid: false, error: 'Erreur serveur' });
  }
}
