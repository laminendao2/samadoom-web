import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';

/**
 * GET /api/referral/referred
 * Retourne la liste des utilisateurs qui ont payé avec le code de parrainage
 * de l'utilisateur connecté (payments où referrerId == uid, status == completed).
 * Croise avec referralEarnings pour la commission gagnée par paiement.
 */
export async function GET(req: NextRequest) {
  const authUser = await verifyRequestUser(req);
  if (!authUser) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const uid = authUser.uid;

  try {
    // Paiements complétés grâce à ce parrain
    const paymentsSnap = await adminDb
      .collection('payments')
      .where('referrerId', '==', uid)
      .where('status', '==', 'completed')
      .orderBy('completedAt', 'desc')
      .limit(100)
      .get();

    if (paymentsSnap.empty) {
      return NextResponse.json({ referred: [] });
    }

    // Gains correspondants (clé = pay_{paymentToken})
    const earningIds = paymentsSnap.docs.map(d => `pay_${d.id}`);
    // Firestore limite les `in` à 30 — on splitte si besoin
    const earningsMap: Record<string, number> = {};
    for (let i = 0; i < earningIds.length; i += 30) {
      const chunk = earningIds.slice(i, i + 30);
      const earSnap = await adminDb
        .collection('referralEarnings')
        .where('__name__', 'in', chunk)
        .get();
      earSnap.forEach(doc => {
        earningsMap[doc.id] = doc.data().commission ?? 0;
      });
    }

    const referred = paymentsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        paymentToken: doc.id,
        userEmail: d.userEmail ?? '',
        userId: d.userId ?? '',
        plan: d.plan ?? '',
        amount: d.amount ?? 0,
        currency: d.currency ?? 'XOF',
        completedAt: d.completedAt ?? d.createdAt ?? '',
        commission: earningsMap[`pay_${doc.id}`] ?? 0,
        commissionPaid: Boolean(earningsMap[`pay_${doc.id}`]),
      };
    });

    return NextResponse.json({ referred });
  } catch (err) {
    console.error('Referral referred error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
