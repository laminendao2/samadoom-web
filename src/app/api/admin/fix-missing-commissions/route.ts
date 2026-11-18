import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';
import { REFERRAL_COMMISSION, referralDiscountGranted } from '@/lib/subscription';
import { stripeCentsToXof } from '@/lib/fx';

/**
 * SuperAdmin uniquement — commissions de parrainage manquantes.
 *
 * Cherche les paiements complétés où l'acheteur a bénéficié de la réduction
 * parrainage mais pour lesquels aucun gain (referralEarnings/pay_{id}) n'existe.
 *
 * POST { apply: false } → liste seulement (aucune écriture)
 * POST { apply: true }  → crédite les commissions listées (idempotent)
 */
export async function POST(req: NextRequest) {
  const authUser = await verifyRequestUser(req);
  if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const callerSnap = await adminDb.collection('users').doc(authUser.uid).get();
  const caller = callerSnap.data();
  const isSuperAdmin = caller?.role === 'superadmin'
    || (Array.isArray(caller?.roles) && caller.roles.includes('superadmin'));
  if (!isSuperAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const apply = body?.apply === true;

  const paymentsSnap = await adminDb.collection('payments').where('status', '==', 'completed').get();

  interface Missing {
    paymentId: string;
    referredEmail: string;
    referralCode: string;
    referrerId: string;
    provider: string;
    amountXof: number;
    commission: number;
    paidAt: string;
    credited: boolean;
    skipped?: string;
  }
  const missing: Missing[] = [];

  for (const doc of paymentsSnap.docs) {
    const p = doc.data();
    if (!p.referralCode || !p.referrerId || p.referrerId === p.userId) continue;
    if (!referralDiscountGranted(p)) continue;
    if (typeof p.amount !== 'number' || p.amount <= 0) continue;

    const earningRef = adminDb.collection('referralEarnings').doc(`pay_${doc.id}`);
    if ((await earningRef.get()).exists) continue;

    const currency = String(p.currency ?? 'XOF').toUpperCase();
    const amountXof = (currency === 'USD' || currency === 'EUR')
      ? await stripeCentsToXof(p.amount, currency.toLowerCase() as 'usd' | 'eur')
      : p.amount;
    const commission = Math.round(amountXof * REFERRAL_COMMISSION);
    const paidAt = typeof p.completedAt === 'string' ? p.completedAt
      : typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString();

    const item: Missing = {
      paymentId: doc.id,
      referredEmail: p.userEmail ?? '',
      referralCode: p.referralCode,
      referrerId: p.referrerId,
      provider: p.provider ?? 'paydunya',
      amountXof,
      commission,
      paidAt,
      credited: false,
    };

    if (apply) {
      const codeRef = adminDb.collection('referralCodes').doc(p.referralCode);
      const outcome = await adminDb.runTransaction(async (tx) => {
        const [earningSnap, codeSnap] = await Promise.all([tx.get(earningRef), tx.get(codeRef)]);
        if (earningSnap.exists) return 'déjà créditée';
        if (!codeSnap.exists) return 'code parrain introuvable';
        const code = codeSnap.data()!;
        if (code.userId !== p.referrerId) return 'le code ne correspond pas au parrain';
        tx.set(earningRef, {
          referrerId: p.referrerId,
          referredId: p.userId,
          referredEmail: p.userEmail ?? '',
          referralCode: p.referralCode,
          plan: p.plan,
          amountPaid: amountXof,
          amountPaidOriginal: p.amount,
          commission,
          currency: 'XOF',
          provider: p.provider ?? 'paydunya',
          paymentToken: doc.id,
          status: 'confirmed',
          createdAt: paidAt,
          fixedByAdmin: true,
          fixedAt: new Date().toISOString(),
        });
        tx.update(codeRef, {
          balance: (code.balance ?? 0) + commission,
          totalEarned: (code.totalEarned ?? 0) + commission,
          usageCount: (code.usageCount ?? 0) + 1,
        });
        return 'ok';
      });
      if (outcome === 'ok') item.credited = true;
      else item.skipped = outcome;
    }
    missing.push(item);
  }

  return NextResponse.json({
    applied: apply,
    count: missing.length,
    credited: missing.filter(m => m.credited).length,
    totalCommission: missing.reduce((s, m) => s + m.commission, 0),
    missing,
  });
}
