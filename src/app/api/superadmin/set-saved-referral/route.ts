import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser, isSuperAdminUid } from '@/lib/server-auth';

/**
 * SuperAdmin uniquement — modifier le parrain sauvegardé d'un utilisateur.
 * Une fois qu'un savedReferralCode est défini, seul un SuperAdmin peut le changer.
 *
 * POST { userId, referralCode }  → définit le parrain
 * POST { userId, referralCode: "" } → efface le parrain sauvegardé
 */
export async function POST(req: NextRequest) {
  const authUser = await verifyRequestUser(req);
  if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!(await isSuperAdminUid(authUser.uid))) {
    return NextResponse.json({ error: 'Accès refusé — SuperAdmin requis' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  const referralCode = typeof body?.referralCode === 'string' ? body.referralCode.trim().toUpperCase() : '';

  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 });
  if (referralCode && !/^[A-Z0-9]{3,20}$/.test(referralCode)) {
    return NextResponse.json({ error: 'Format de code invalide' }, { status: 400 });
  }

  const userRef = adminDb.collection('users').doc(userId);
  const nowIso = new Date().toISOString();

  const outcome = await adminDb.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return { status: 404, error: 'Utilisateur introuvable' };

    const prevCode = userSnap.data()?.savedReferralCode as string | undefined;

    if (referralCode) {
      // Vérifier que le code existe et n'appartient pas à l'utilisateur lui-même
      const codeSnap = await tx.get(adminDb.collection('referralCodes').doc(referralCode));
      if (!codeSnap.exists) return { status: 404, error: 'Code parrain introuvable' };
      if (codeSnap.data()?.userId === userId) return { status: 400, error: 'Auto-parrainage impossible' };

      tx.update(userRef, {
        savedReferralCode: referralCode,
        ...(prevCode && prevCode !== referralCode
          ? { savedReferralCodePrev: prevCode, savedReferralCodeChangedByAdmin: nowIso }
          : { savedReferralCodeSetByAdmin: nowIso }),
      });
    } else {
      // Effacer
      const { FieldValue } = await import('firebase-admin/firestore');
      tx.update(userRef, {
        savedReferralCode: FieldValue.delete(),
        ...(prevCode ? { savedReferralCodePrev: prevCode, savedReferralCodeRemovedByAdmin: nowIso } : {}),
      });
    }

    return { status: 200, prevCode: prevCode ?? null };
  });

  if (outcome.status !== 200) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  return NextResponse.json({
    result: referralCode ? 'set' : 'cleared',
    userId,
    referralCode: referralCode || null,
    previous: outcome.prevCode,
  });
}
