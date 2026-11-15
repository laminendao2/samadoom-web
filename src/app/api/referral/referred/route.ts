import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const authUser = await verifyRequestUser(req);
  if (!authUser) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const uid = authUser.uid;

  try {
    // 1. Trouver le code de parrainage
    const codesSnap = await adminDb
      .collection('referralCodes')
      .where('userId', '==', uid)
      .limit(1)
      .get();

    if (codesSnap.empty) {
      return NextResponse.json({ referred: [] });
    }

    const userCode = codesSnap.docs[0].data().code ?? codesSnap.docs[0].id;

    // 2. Source A : referralEarnings (avec commission)
    const earningsSnap = await adminDb
      .collection('referralEarnings')
      .where('referralCode', '==', userCode)
      .limit(100)
      .get();

    // 3. Source B : payments avec ce code (fallback si referralEarnings vide)
    const paymentsSnap = await adminDb
      .collection('payments')
      .where('referralCode', '==', userCode)
      .where('status', '==', 'completed')
      .limit(100)
      .get();

    // Fusionner les deux sources — dédupliquer par userId+plan+date
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

    // Source B d'abord (payments)
    paymentsSnap.forEach(doc => {
      const d = doc.data();
      referredMap[doc.id] = {
        paymentToken: doc.id,
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

    // Source A enrichit (referralEarnings)
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

    // 4. Récupérer les noms
    const userIds = [...new Set(
      Object.values(referredMap).map(r => r.userId).filter(Boolean) as string[]
    )];
    if (userIds.length > 0) {
      for (let i = 0; i < userIds.length; i += 30) {
        const chunk = userIds.slice(i, i + 30);
        const usersSnap = await adminDb.collection('users').where('__name__', 'in', chunk).get();
        usersSnap.forEach(doc => {
          const name = doc.data().name ?? '';
          Object.values(referredMap).forEach(r => {
            if (r.userId === doc.id) r.userName = name;
          });
        });
      }
    }

    const referred = Object.values(referredMap)
      .sort((a, b) => (b.completedAt > a.completedAt ? 1 : -1));

    // Debug temporaire
    // Chercher aussi par referrerId directement dans referralEarnings
    const earningsByReferrer = await adminDb
      .collection('referralEarnings')
      .where('referrerId', '==', uid)
      .limit(10)
      .get();

    const debug = {
      userCode,
      uid,
      earningsCount: earningsSnap.size,
      paymentsCount: paymentsSnap.size,
      earningsByReferrerCount: earningsByReferrer.size,
      sampleEarningByReferrer: earningsByReferrer.docs[0]?.data() ?? null,
      sampleEarningByCode: earningsSnap.docs[0]?.data() ?? null,
      samplePayment: paymentsSnap.docs[0]?.data() ?? null,
    };

    return NextResponse.json({ referred, debug });
  } catch (err) {
    console.error('Referral referred error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
