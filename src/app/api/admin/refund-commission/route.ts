import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';

export const preferredRegion = 'cdg1';

export async function POST(req: NextRequest) {
  const authUser = await verifyRequestUser(req);
  if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const callerSnap = await adminDb.collection('users').doc(authUser.uid).get();
  const caller = callerSnap.data();
  const isSuperAdmin =
    caller?.role === 'superadmin' ||
    (Array.isArray(caller?.roles) && caller.roles.includes('superadmin'));
  if (!isSuperAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { code, amount, note } = body ?? {};

  if (!code || typeof code !== 'string')
    return NextResponse.json({ error: 'code manquant' }, { status: 400 });
  const amt = Number(amount);
  if (!amt || amt <= 0 || !Number.isInteger(amt))
    return NextResponse.json({ error: 'Montant invalide (entier > 0 requis)' }, { status: 400 });

  const codeRef = adminDb.collection('referralCodes').doc(code);
  const codeSnap = await codeRef.get();
  if (!codeSnap.exists)
    return NextResponse.json({ error: `Code ${code} introuvable` }, { status: 404 });

  const codeData = codeSnap.data()!;
  const currentBalance = codeData.balance ?? 0;
  if (amt > currentBalance)
    return NextResponse.json(
      { error: `Solde insuffisant : ${currentBalance} FCFA disponibles` },
      { status: 400 }
    );

  const earningId = `refund_${Date.now()}_${code}`;
  await adminDb.runTransaction(async (tx) => {
    // Lire avant d'écrire (règle Firebase Admin SDK)
    const freshSnap = await tx.get(codeRef);
    const freshBalance = freshSnap.data()?.balance ?? 0;
    if (amt > freshBalance) throw new Error(`Solde insuffisant : ${freshBalance} FCFA`);

    tx.update(codeRef, { balance: freshBalance - amt }); // totalEarned inchangé
    tx.set(adminDb.collection('referralEarnings').doc(earningId), {
      type: 'refund',
      referrerId: codeData.userId,
      referrerCode: code,
      referredEmail: null,
      plan: null,
      amountPaid: null,
      commission: -amt,
      currency: 'XOF',
      provider: 'superadmin',
      status: 'completed',
      note: note || null,
      refundedBy: authUser.uid,
      createdAt: new Date().toISOString(),
    });
  });

  return NextResponse.json({
    ok: true,
    code,
    amount: amt,
    userName: codeData.userName,
    earningId,
    newBalance: currentBalance - amt,
  });
}
