import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';

/**
 * POST /api/admin/revert-earnings-corruption
 *
 * SuperAdmin uniquement — corrige la corruption causée par fix-referral-balances
 * qui a traité les paiements PayDunya FCFA comme des centimes Stripe USD.
 *
 * Symptôme : amountPaid = round(amountPaidOriginal / 100 * 600 * 0.88) au lieu de = amountPaidOriginal
 * Ex : 1500 FCFA → 7920 FCFA (commission 150 → 792 FCFA)
 *
 * Correction : pour tout referralEarning PayDunya (provider !== 'stripe', currency = 'XOF')
 * qui a un amountPaidOriginal, restaurer amountPaid = amountPaidOriginal et recalculer commission.
 */
export async function POST(req: NextRequest) {
  const authUser = await verifyRequestUser(req);
  if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const userDoc = await adminDb.collection('users').doc(authUser.uid).get();
  const userData = userDoc.data();
  const isSuperAdmin =
    userData?.role === 'superadmin' ||
    (Array.isArray(userData?.roles) && userData.roles.includes('superadmin'));
  if (!isSuperAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  // 1. Trouver tous les earnings corrompus (PayDunya FCFA dont amountPaid ≠ amountPaidOriginal)
  const earningsSnap = await adminDb.collection('referralEarnings').get();

  const fixes: { id: string; wasAmount: number; correctAmount: number; wasCommission: number; correctCommission: number }[] = [];
  const batch = adminDb.batch();

  for (const doc of earningsSnap.docs) {
    const d = doc.data();
    const currency = (d.currency ?? 'XOF').toUpperCase();
    const provider = d.provider ?? 'paydunya';

    // On ne touche qu'aux earnings PayDunya/XOF qui ont un amountPaidOriginal ≠ amountPaid
    if (provider === 'stripe' || currency === 'USD' || currency === 'EUR') continue;
    if (d.amountPaidOriginal === undefined) continue;

    const originalAmount = Number(d.amountPaidOriginal);
    const currentAmount = Number(d.amountPaid);
    const rate = Number(d.rate ?? 0.10);

    // Si amountPaid ≈ amountPaidOriginal → déjà correct, skip
    if (Math.abs(currentAmount - originalAmount) < 1) continue;

    const correctCommission = Math.round(originalAmount * rate);

    fixes.push({
      id: doc.id,
      wasAmount: currentAmount,
      correctAmount: originalAmount,
      wasCommission: d.commission ?? 0,
      correctCommission,
    });

    batch.update(doc.ref, {
      amountPaid: originalAmount,
      commission: correctCommission,
      _corruptionRevertedAt: new Date().toISOString(),
    });
  }

  if (fixes.length > 0) {
    await batch.commit();
  }

  // 2. Recalculer totalEarned + balance de chaque referralCode depuis les earnings corrigées
  const allEarningsSnap = await adminDb.collection('referralEarnings').get();

  const byCode: Record<string, { totalEarned: number; usageCount: number }> = {};
  for (const doc of allEarningsSnap.docs) {
    const d = doc.data();
    const code = d.referralCode as string;
    if (!code) continue;
    if (!byCode[code]) byCode[code] = { totalEarned: 0, usageCount: 0 };
    // Après correction, utiliser le bon montant
    const correctedFix = fixes.find(f => f.id === doc.id);
    const commission = correctedFix ? correctedFix.correctCommission : (d.commission ?? 0);
    byCode[code].totalEarned += commission;
    byCode[code].usageCount += 1;
  }

  const codesSnap = await adminDb.collection('referralCodes').get();
  const codeBatch = adminDb.batch();
  const codeUpdates: { code: string; oldBalance: number; newBalance: number; oldTotalEarned: number; newTotalEarned: number }[] = [];

  for (const doc of codesSnap.docs) {
    const d = doc.data();
    const code = d.code as string;
    const stats = byCode[code];
    if (!stats) continue;

    const oldTotalEarned = d.totalEarned ?? 0;
    const diff = stats.totalEarned - oldTotalEarned;
    const newBalance = Math.max(0, (d.balance ?? 0) + diff);

    codeUpdates.push({
      code,
      oldBalance: d.balance ?? 0,
      newBalance,
      oldTotalEarned,
      newTotalEarned: stats.totalEarned,
    });

    codeBatch.update(doc.ref, {
      totalEarned: stats.totalEarned,
      usageCount: stats.usageCount,
      balance: newBalance,
    });
  }

  if (codeUpdates.length > 0) {
    await codeBatch.commit();
  }

  return NextResponse.json({
    earningsReverted: fixes.length,
    codesRecalculated: codeUpdates.length,
    earningDetails: fixes,
    codeDetails: codeUpdates,
  });
}
