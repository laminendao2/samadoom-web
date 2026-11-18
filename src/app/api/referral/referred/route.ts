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

    // Map userId → { userEmail, userName, plan, completedAt, commission, commissionPaid }
    const referredMap: Record<string, {
      userEmail: string;
      userName: string;
      plan: string;
      completedAt: string;
      commission: number;
      commissionPaid: boolean;
    }> = {};

    // Source A : users ayant savedReferralCode == userCode (source la plus fiable)
    const usersWithCodeSnap = await adminDb
      .collection('users')
      .where('savedReferralCode', '==', userCode)
      .limit(200)
      .get();

    usersWithCodeSnap.forEach(doc => {
      const d = doc.data();
      referredMap[doc.id] = {
        userEmail: d.email ?? '',
        userName: d.name ?? '',
        plan: d.plan ?? '',
        completedAt: d.planActivatedAt ?? d.createdAt ?? '',
        commission: 0,
        commissionPaid: false,
      };
    });

    // Source B : referralEarnings (ajoute les commissions)
    const earningsSnap = await adminDb
      .collection('referralEarnings')
      .where('referralCode', '==', userCode)
      .limit(200)
      .get();

    earningsSnap.forEach(doc => {
      const d = doc.data();
      const userId = d.referredId ?? '';
      if (!userId) return;
      const existing = referredMap[userId];
      if (existing) {
        existing.commission = (existing.commission ?? 0) + (d.commission ?? 0);
        existing.commissionPaid = true;
        if (!existing.plan) existing.plan = d.plan ?? '';
        if (!existing.completedAt) existing.completedAt = d.createdAt ?? '';
        if (!existing.userEmail) existing.userEmail = d.referredEmail ?? '';
      } else {
        referredMap[userId] = {
          userEmail: d.referredEmail ?? '',
          userName: '',
          plan: d.plan ?? '',
          completedAt: d.createdAt ?? '',
          commission: d.commission ?? 0,
          commissionPaid: true,
        };
      }
    });

    // Source C : payments complétés avec ce code (fallback)
    const paymentsSnap = await adminDb
      .collection('payments')
      .where('referralCode', '==', userCode)
      .where('status', '==', 'completed')
      .limit(200)
      .get();

    paymentsSnap.forEach(doc => {
      const d = doc.data();
      const userId = d.userId ?? '';
      if (!userId || referredMap[userId]) return; // déjà connu
      referredMap[userId] = {
        userEmail: d.userEmail ?? '',
        userName: '',
        plan: d.plan ?? '',
        completedAt: d.completedAt ?? d.createdAt ?? '',
        commission: 0,
        commissionPaid: false,
      };
    });

    // Remplir les noms manquants depuis users
    const missingNameIds = Object.entries(referredMap)
      .filter(([, v]) => !v.userName)
      .map(([id]) => id);

    if (missingNameIds.length > 0) {
      for (let i = 0; i < missingNameIds.length; i += 30) {
        const chunk = missingNameIds.slice(i, i + 30);
        const snap = await adminDb.collection('users').where('__name__', 'in', chunk).get();
        snap.forEach(doc => {
          const r = referredMap[doc.id];
          if (r && !r.userName) {
            r.userName = doc.data().name ?? '';
            if (!r.userEmail) r.userEmail = doc.data().email ?? '';
          }
        });
      }
    }

    const referred = Object.entries(referredMap)
      .map(([userId, r]) => ({ userId, ...r }))
      .sort((a, b) => (b.completedAt > a.completedAt ? 1 : -1));

    return NextResponse.json({ referred });
  } catch (err) {
    console.error('Referral referred error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
