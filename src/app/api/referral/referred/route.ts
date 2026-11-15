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
    // Pas de orderBy pour éviter un index composite — on trie côté JS
    const earningsSnap = await adminDb
      .collection('referralEarnings')
      .where('referrerId', '==', uid)
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
      userName: string;
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
        userName: '',
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
        userName: existing?.userName ?? '',
        plan: d.plan ?? existing?.plan ?? '',
        amount: d.amountPaid ?? existing?.amount ?? 0,
        currency: d.currency ?? existing?.currency ?? 'XOF',
        completedAt: d.createdAt ?? existing?.completedAt ?? '',
        commission: d.commission ?? 0,
        commissionPaid: true,
      };
    });

    // Récupérer les noms depuis users/{userId}
    const userIds = [...new Set(Object.values(referredMap).map(r => r.userId).filter(Boolean))];
    const namesMap: Record<string, string> = {};
    // Firestore limite les `in` à 30
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
    // Injecter les noms
    for (const entry of Object.values(referredMap)) {
      entry.userName = namesMap[entry.userId] ?? '';
    }

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
