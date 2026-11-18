import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/referral/use
 * Headers: Authorization: Bearer <firebase-id-token>
 * Body: { code: string }
 *
 * Enregistre l'utilisation d'un code de parrainage lors de l'inscription :
 * - Stocke referredBy sur le doc users/{newUserId}
 * - Incrémente usageCount sur referralCodes/{code}
 */
export async function POST(req: NextRequest) {
  try {
    const decoded = await verifyRequestUser(req);
    if (!decoded) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code manquant' }, { status: 400 });
    }

    const upperCode = code.toUpperCase().trim();
    const newUserId = decoded.uid;

    // Vérifier que le code existe
    const codeSnap = await adminDb.collection('referralCodes').doc(upperCode).get();
    if (!codeSnap.exists) {
      return NextResponse.json({ error: 'Code invalide' }, { status: 404 });
    }

    const codeData = codeSnap.data()!;

    // Éviter l'auto-parrainage
    if (codeData.userId === newUserId) {
      return NextResponse.json({ error: 'Auto-parrainage interdit' }, { status: 400 });
    }

    // Vérifier que l'utilisateur ne l'a pas déjà utilisé
    const userSnap = await adminDb.collection('users').doc(newUserId).get();
    if (userSnap.exists && userSnap.data()?.referredBy) {
      return NextResponse.json({ error: 'Code déjà utilisé' }, { status: 400 });
    }

    // Enregistrement en batch
    const batch = adminDb.batch();
    batch.update(adminDb.collection('users').doc(newUserId), {
      referredBy: upperCode,
      referredByUserId: codeData.userId,
    });
    batch.update(adminDb.collection('referralCodes').doc(upperCode), {
      usageCount: FieldValue.increment(1),
    });
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Referral use error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
