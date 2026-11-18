import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';

/**
 * SuperAdmin uniquement — don/bonus dans le solde d'un parrain.
 *
 * POST { code: string, amount: number, note?: string }
 * → crédite `amount` FCFA dans referralCodes/{code}.balance + totalEarned
 * → crée referralEarnings/gift_{timestamp}_{code}
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
  const { code, amount, note } = body ?? {};

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'code manquant' }, { status: 400 });
  }
  const amt = Number(amount);
  if (!amt || amt <= 0 || !Number.isInteger(amt)) {
    return NextResponse.json({ error: 'Montant invalide (entier > 0 requis)' }, { status: 400 });
  }

  const codeRef = adminDb.collection('referralCodes').doc(code);
  const codeSnap = await codeRef.get();
  if (!codeSnap.exists) {
    return NextResponse.json({ error: `Code ${code} introuvable` }, { status: 404 });
  }

  const codeData = codeSnap.data()!;
  const earningId = `gift_${Date.now()}_${code}`;

  await adminDb.runTransaction(async (tx) => {
    // Créditer le solde du parrain
    tx.update(codeRef, {
      balance:     (codeData.balance ?? 0) + amt,
      totalEarned: (codeData.totalEarned ?? 0) + amt,
    });

    // Enregistrer le don comme une entrée de gains
    const earningRef = adminDb.collection('referralEarnings').doc(earningId);
    tx.set(earningRef, {
      type:         'gift',
      referrerId:   codeData.userId,
      referrerCode: code,
      referredEmail: null,
      plan:         null,
      amountPaid:   null,
      commission:   amt,
      currency:     'XOF',
      provider:     'superadmin',
      status:       'completed',
      note:         note || null,
      giftedBy:     authUser.uid,
      createdAt:    new Date().toISOString(),
    });
  });

  return NextResponse.json({
    ok: true,
    code,
    amount: amt,
    userName: codeData.userName,
    earningId,
  });
}
