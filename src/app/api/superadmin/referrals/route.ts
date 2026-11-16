import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { isSuperAdminUid, verifyRequestUser } from '@/lib/server-auth';

/**
 * GET /api/superadmin/referrals
 * Réservé aux superadmins — retourne :
 * - Liste des codes de parrainage avec stats par prof
 * - Liste des gains individuels (referralEarnings)
 * - Totaux globaux
 */
export async function GET(req: NextRequest) {
  try {
    // L'appelant doit prouver son identité (token Firebase) ET être superadmin
    const authUser = await verifyRequestUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (!(await isSuperAdminUid(authUser.uid))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // 1. Tous les codes de parrainage (profs)
    const codesSnap = await adminDb
      .collection('referralCodes')
      .orderBy('totalEarned', 'desc')
      .get();

    const codes = codesSnap.docs.map(doc => {
      const d = doc.data();
      return {
        code: d.code,
        userId: d.userId,
        userName: d.userName,
        userEmail: d.userEmail,
        balance: d.balance ?? 0,
        totalEarned: d.totalEarned ?? 0,
        usageCount: d.usageCount ?? 0,
        createdAt: d.createdAt,
      };
    });

    // 2. Derniers gains (50 max)
    const earningsSnap = await adminDb
      .collection('referralEarnings')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const earnings = earningsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        type: d.type ?? 'commission',
        referrerId: d.referrerId,
        referrerCode: d.referralCode,
        referredEmail: d.referredEmail ?? null,
        plan: d.plan ?? null,
        amountPaid: d.amountPaid ?? null,
        commission: d.commission ?? 0,
        currency: d.currency ?? 'XOF',
        provider: d.provider ?? 'paydunya',
        status: d.status,
        createdAt: d.createdAt,
      };
    });

    // 3. Totaux globaux
    const totalCommissions = codes.reduce((sum, c) => sum + c.totalEarned, 0);
    const totalUsage = codes.reduce((sum, c) => sum + c.usageCount, 0);
    const totalBalance = codes.reduce((sum, c) => sum + c.balance, 0);

    // Calcul économies acheteurs (5 % appliqué)
    const totalSavings = earnings.reduce((sum, e) => {
      // réduction acheteur de 5 % : original = payé / 0.95
      const original = Math.round(e.amountPaid / 0.95);
      return sum + (original - e.amountPaid);
    }, 0);

    // Total des dons SuperAdmin (type: 'gift')
    const donsSnap = await adminDb
      .collection('referralEarnings')
      .where('type', '==', 'gift')
      .get();
    const totalDons = donsSnap.docs.reduce((sum, doc) => sum + (doc.data().commission ?? 0), 0);

    return NextResponse.json({
      codes,
      earnings,
      totals: {
        totalCommissions,
        totalUsage,
        totalBalance,
        totalSavings,
        totalDons,
        totalProfs: codes.length,
      },
    });
  } catch (err) {
    console.error('Superadmin referrals error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
