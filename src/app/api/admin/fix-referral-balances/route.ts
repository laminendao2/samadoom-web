import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';
import { stripeCentsToXof } from '@/lib/fx';

// Taux fixe utilisé pour recalculer les anciens records USD (approximation historique)
const USD_TO_XOF_HISTORIC = 600;
// Taux fixe EUR→XOF officiel (pegging CFA depuis 1999)
const EUR_TO_XOF = 655.957;
const FEE_FACTOR = 0.88;
const COMMISSION_RATE = 0.10;

/**
 * POST /api/admin/fix-referral-balances
 *
 * SuperAdmin uniquement — migration des referralEarnings Stripe (USD ou EUR) mal converties.
 *
 * Pour chaque earning avec provider='stripe' (ancien format centimes bruts) :
 *   1. Recalcule amountPaid en XOF selon la devise (USD → taux historique, EUR → taux fixe)
 *   2. Recalcule commission en XOF
 *   3. Met à jour le doc earning
 *
 * Puis recalcule balance + totalEarned de chaque referralCode depuis zéro.
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

  // 1. Charger tous les referralEarnings
  const earningsSnap = await adminDb.collection('referralEarnings').get();

  const earningFixes: { id: string; oldAmount: number; newAmount: number; oldCommission: number; newCommission: number }[] = [];
  const batch = adminDb.batch();

  for (const doc of earningsSnap.docs) {
    const d = doc.data();
    const currency = (d.currency ?? 'XOF').toUpperCase();
    const provider  = d.provider ?? 'paydunya';

    // Identifier les earnings en centimes (Stripe — USD ou EUR, ancien ou nouveau format)
    const isStripeCents =
      currency === 'USD' ||
      currency === 'EUR' ||
      provider === 'stripe' ||
      d.amountPaidOriginal !== undefined;

    if (!isStripeCents) continue; // déjà en XOF (PayDunya), rien à faire

    // Montant original en centimes (USD ou EUR)
    const rawCents = d.amountPaidOriginal ?? d.amountPaid;

    let amountXof: number;
    if (currency === 'EUR') {
      // EUR → XOF fixe officiel × FEE_FACTOR
      amountXof = Math.round((rawCents / 100) * EUR_TO_XOF * FEE_FACTOR);
    } else {
      // USD → taux historique approximatif (600 × FEE_FACTOR)
      amountXof = Math.round((rawCents / 100) * USD_TO_XOF_HISTORIC * FEE_FACTOR);
    }
    const commissionXof = Math.round(amountXof * COMMISSION_RATE);

    earningFixes.push({
      id: doc.id,
      oldAmount: d.amountPaid,
      newAmount: amountXof,
      oldCommission: d.commission,
      newCommission: commissionXof,
    });

    batch.update(doc.ref, {
      amountPaid: amountXof,
      amountPaidOriginal: rawCents,
      commission: commissionXof,
      currency: 'XOF',
      _migratedAt: new Date().toISOString(),
    });
  }

  await batch.commit();

  // 2. Recalculer balance + totalEarned de chaque referralCode depuis les earnings corrigées
  const allEarningsSnap = await adminDb.collection('referralEarnings').get();

  // Regrouper par referralCode
  const byCode: Record<string, { totalEarned: number; usageCount: number }> = {};
  for (const doc of allEarningsSnap.docs) {
    const d = doc.data();
    const code = d.referralCode as string;
    if (!code) continue;
    if (!byCode[code]) byCode[code] = { totalEarned: 0, usageCount: 0 };
    byCode[code].totalEarned += (d.commission ?? 0);
    byCode[code].usageCount  += 1;
  }

  // Mettre à jour les referralCodes
  const codesSnap = await adminDb.collection('referralCodes').get();
  const codeBatch = adminDb.batch();
  const codeUpdates: { code: string; oldBalance: number; newTotalEarned: number }[] = [];

  for (const doc of codesSnap.docs) {
    const d = doc.data();
    const code = d.code as string;
    const stats = byCode[code];
    if (!stats) continue;

    // Recalculer balance = totalEarned - totalPaid (disbursements)
    // On garde la différence entre ancien totalEarned et nouveau pour ajuster balance
    const oldTotalEarned = d.totalEarned ?? 0;
    const diff = stats.totalEarned - oldTotalEarned;
    const newBalance = Math.max(0, (d.balance ?? 0) + diff);

    codeUpdates.push({ code, oldBalance: d.balance ?? 0, newTotalEarned: stats.totalEarned });

    codeBatch.update(doc.ref, {
      totalEarned: stats.totalEarned,
      usageCount: stats.usageCount,
      balance: newBalance,
    });
  }

  await codeBatch.commit();

  return NextResponse.json({
    earningsFixed: earningFixes.length,
    codesUpdated: codeUpdates.length,
    earningDetails: earningFixes,
    codeDetails: codeUpdates,
  });
}
