import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/superadmin/referrals
 * Réservé aux superadmins — retourne :
 * - Liste des codes de parrainage avec stats par prof
 * - Liste des gains individuels (referralEarnings)
 * - Totaux globaux
 */
export async function GET(req: NextRequest) {
  try {
    // Vérifier que l'appelant est superadmin via header userId
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 403 });
    }
    const userData = userDoc.data()!;
    const isSuperAdmin =
      userData.role === 'superadmin' ||
      (Array.isArray(userData.roles) && userData.roles.includes('superadmin'));

    if (!isSuperAdmin) {
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
        referrerId: d.referrerId,
        referrerCode: d.referralCode,
        referredEmail: d.referredEmail,
        plan: d.plan,
        amountPaid: d.amountPaid,
        commission: d.commission,
        status: d.status,
        createdAt: d.createdAt,
      };
    });

    // 3. Totaux globaux
    const totalCommissions = codes.reduce((sum, c) => sum + c.totalEarned, 0);
    const totalUsage = codes.reduce((sum, c) => sum + c.usageCount, 0);
    const totalBalance = codes.reduce((sum, c) => sum + c.balance, 0);

    // Calcul économies acheteurs (10% appliqué)
    const totalSavings = earnings.reduce((sum, e) => {
      // originalAmount = amountPaid / 0.9 → économie = originalAmount * 0.1
      const original = Math.round(e.amountPaid / 0.9);
      return sum + (original - e.amountPaid);
    }, 0);

    return NextResponse.json({
      codes,
      earnings,
      totals: {
        totalCommissions,
        totalUsage,
        totalBalance,
        totalSavings,
        totalProfs: codes.length,
      },
    });
  } catch (err) {
    console.error('Superadmin referrals error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
