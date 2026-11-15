import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';

/**
 * GET /api/referral/referred
 * Retourne la liste des filleuls depuis referralEarnings.
 * Cherche par referralCode (depuis referralCodes/{code}.code) pour éviter
 * les problèmes d'index sur referrerId.
 */
export async function GET(req: NextRequest) {
  const authUser = await verifyRequestUser(req);
  if (!authUser) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const uid = authUser.uid;

  try {
    // 1. Trouver le code de parrainage de cet utilisateur
    const codesSnap = await adminDb
      .collection('referralCodes')
      .where('userId', '==', uid)
      .limit(1)
      .get();

    if (codesSnap.empty) {
      return NextResponse.json({ referred: [] });
    }

    const codeDoc = codesSnap.docs[0];
    const userCode = codeDoc.data().code ?? codeDoc.id;

    // 2. Chercher les gains associés à ce code
    const earningsSnap = await adminDb
      .collection('referralEarnings')
      .where('referralCode', '==', userCode)
      .limit(100)
      .get();

    if (earningsSnap.empty) {
      return NextResponse.json({ referred: [] });
    }

    // 3. Récupérer les noms des filleuls
    const userIds = [...new Set(
      earningsSnap.docs.map(d => d.data().referredId).filter(Boolean) as string[]
    )];

    const namesMap: Record<string, string> = {};
    if (userIds.length > 0) {
      for (let i = 0; i < userIds.length; i += 30) {
        const chunk = userIds.slice(i, i + 30);
        const usersSnap = await adminDb
          .collection('users')
          .where('__name__', 'in', chunk)
          .get();
        usersSnap.forEach(doc => {
          namesMap[doc.id] = doc.data().name ?? '';
        });
      }
    }

    const referred = earningsSnap.docs
      .map(doc => {
        const d = doc.data();
        return {
          paymentToken: d.paymentToken ?? doc.id,
          userEmail: d.referredEmail ?? '',
          userId: d.referredId ?? '',
          userName: namesMap[d.referredId] ?? '',
          plan: d.plan ?? '',
          amount: d.amountPaid ?? 0,
          currency: d.currency ?? 'XOF',
          completedAt: d.createdAt ?? '',
          commission: d.commission ?? 0,
          commissionPaid: true,
        };
      })
      .sort((a, b) => (b.completedAt > a.completedAt ? 1 : -1));

    return NextResponse.json({ referred });
  } catch (err) {
    console.error('Referral referred error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
