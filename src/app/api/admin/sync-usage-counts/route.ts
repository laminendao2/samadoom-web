import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { isSuperAdminUid, verifyRequestUser } from '@/lib/server-auth';

/**
 * POST /api/admin/sync-usage-counts
 * Recalcule usageCount pour chaque code depuis la vraie source :
 * count(users where savedReferralCode === code)
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyRequestUser(req);
    if (!authUser) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    if (!(await isSuperAdminUid(authUser.uid))) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const codesSnap = await adminDb.collection('referralCodes').get();
    if (codesSnap.empty) return NextResponse.json({ updated: 0, changes: [] });

    const updates: { code: string; oldCount: number; newCount: number }[] = [];

    await Promise.all(codesSnap.docs.map(async (codeDoc) => {
      const code = codeDoc.data().code as string;
      const oldCount = codeDoc.data().usageCount ?? 0;

      const usersSnap = await adminDb
        .collection('users')
        .where('savedReferralCode', '==', code)
        .get();

      const newCount = usersSnap.size;

      if (newCount !== oldCount) {
        await adminDb.collection('referralCodes').doc(codeDoc.id).update({ usageCount: newCount });
        updates.push({ code, oldCount, newCount });
      }
    }));

    return NextResponse.json({ updated: updates.length, changes: updates });
  } catch (err) {
    console.error('sync-usage-counts error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
