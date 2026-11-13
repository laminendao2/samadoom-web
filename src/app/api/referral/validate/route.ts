import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/referral/validate?code=CHEIKH4821&userId=xxx
 *
 * Valide un code de parrainage.
 * - Vérifie que le code existe
 * - Vérifie que l'utilisateur n'utilise pas son propre code
 * Retourne: { valid, discountPercent, referrerName }
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
      return NextResponse.json({ valid: false, error: 'Code invalide' });
    }

    const referral = snap.data()!;

    // Bloquer l'auto-parrainage
    if (userId && referral.userId === userId) {
      return NextResponse.json({ valid: false, error: 'Vous ne pouvez pas utiliser votre propre code' });
    }

    // Vérifier que le parrain a un abonnement actif (isPro Firestore OU planExpiresAt OU subscriptionEnd)
    const referrerDoc = await adminDb.collection('users').doc(referral.userId).get();
    const referrerData = referrerDoc.data();

    // Convertir subscriptionEnd (peut être Timestamp Firestore ou string)
    const toDate = (val: unknown): Date | null => {
      if (!val) return null;
      if (val && typeof (val as { toDate?: () => Date }).toDate === 'function') {
        return (val as { toDate: () => Date }).toDate();
      }
      if (typeof val === 'string' || typeof val === 'number') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      }
      return null;
    };

    const now = new Date();
    const isReferrerPro =
      referrerData?.isPro === true ||
      (referrerData?.planExpiresAt && toDate(referrerData.planExpiresAt) && toDate(referrerData.planExpiresAt)! > now) ||
      (referrerData?.subscriptionEnd && toDate(referrerData.subscriptionEnd) && toDate(referrerData.subscriptionEnd)! > now);

    if (!isReferrerPro) {
      return NextResponse.json({ valid: false, error: 'Ce code n\'est plus actif' });
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
