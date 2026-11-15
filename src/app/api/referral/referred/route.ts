import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';

/**
 * GET /api/referral/referred
 * Retourne la liste des filleuls ayant payé grâce au code du parrain.
 * Source principale : referralEarnings (créé lors de chaque paiement avec parrainage actif).
 * Fallback : payments avec referrerId == uid (paiements sans commission car parrain non-Pro).
 */
export async function GET(req: NextRequest) {
  const authUser = await verifyRequestUser(req);
  if (!authUser) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const uid = authUser.uid;

  try {
    // 1. Chercher dans referralEarnings (filleuls avec commission confirmée)
    const earningsSnap = await adminDb
      .collection('referralEarnings')
      .where('referrerId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    // 2. Chercher dans payments les filleuls sans commission (parrain non-Pro au moment du paiement)
    const paymentsSnap = await adminDb
      .collection('payments')
      .where('referrerId', '==', uid)
      .where('status', '==', 'completed')
      .limit(100)
      .get();

    // Construire une map pour dédupliquer par paymentToken
    const referredMap: Record<string, {
      paymentToken: string;
      userEmail: string;
      userId: string;
      plan: string;
      amount: number;
      currency: string;
      completedAt: string;
      commission: number;
      commissionPaid: boolean;
    }> = {};

    // D'abord les payments (base)
    paymentsSnap.forEach(doc => {
      const d = doc.data();
      const token = doc.id;
      referredMap[token] = {
        paymentToken: token,
        userEmail: d.userEmail ?? '',
        userId: d.userId ?? '',
        plan: d.plan ?? '',
        amount: d.amount ?? 0,
        currency: d.currency ?? 'XOF',
        completedAt: d.completedAt ?? d.createdAt ?? '',
        commission: 0,
        commissionPaid: false,
      };
    });

    // Ensuite les referralEarnings (enrichissent ou créent l'entrée)
    earningsSnap.forEach(doc => {
      const d = doc.data();
      const token = d.paymentToken ?? doc.id.replace(/^pay_/, '');
      const existing = referredMap[token];
      referredMap[token] = {
        paymentToken: token,
        userEmail: d.referredEmail ?? existing?.userEmail ?? '',
        userId: d.referredId ?? existing?.userId ?? '',
        plan: d.plan ?? existing?.plan ?? '',
        amount: d.amountPaid ?? existing?.amount ?? 0,
        currency: d.currency ?? existing?.currency ?? 'XOF',
        completedAt: d.createdAt ?? existing?.completedAt ?? '',
        commission: d.commission ?? 0,
        commissionPaid: true,
      };
    });

    // Trier par date décroissante
    const referred = Object.values(referredMap).sort((a, b) => {
      return (b.completedAt > a.completedAt ? 1 : -1);
    });

    return NextResponse.json({ referred });
  } catch (err) {
    console.error('Referral referred error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
