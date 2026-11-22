import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';

/**
 * POST /api/admin/revoke-gift
 * SuperAdmin uniquement — révoque un don SuperAdmin.
 * { earningId: string }
 */
export async function POST(req: NextRequest) {
  const authUser = await verifyRequestUser(req);
  if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const callerSnap = await adminDb.collection('users').doc(authUser.uid).get();
  const caller = callerSnap.data();
  const isSuperAdmin = caller?.role === 'superadmin'
    || (Array.isArray(caller?.roles) && caller.roles.includes('superadmin'));
  if (!isSuperAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  const { earningId } = await req.json().catch(() => ({}));
  if (!earningId) return NextResponse.json({ error: 'earningId manquant' }, { status: 400 });

  const earningRef = adminDb.collection('referralEarnings').doc(earningId);
  const earningSnap = await earningRef.get();
  if (!earningSnap.exists) return NextResponse.json({ error: 'Don introuvable' }, { status: 404 });

  const earning = earningSnap.data()!;
  if (earning.type !== 'gift') return NextResponse.json({ error: 'Cet earning n\'est pas un don' }, { status: 400 });

  const amount = Number(earning.commission ?? 0);
  const code = (earning.referralCode ?? earning.referrerCode) as string;
  if (!code) return NextResponse.json({ error: 'Code parrain introuvable dans le don' }, { status: 400 });

  const codeRef = adminDb.collection('referralCodes').doc(code);

  await adminDb.runTransaction(async (tx) => {
    const codeSnap = await tx.get(codeRef);
    if (!codeSnap.exists) throw new Error(`Code ${code} introuvable`);
    const codeData = codeSnap.data()!;

    tx.update(codeRef, {
      balance:     Math.max(0, (codeData.balance ?? 0) - amount),
      totalEarned: Math.max(0, (codeData.totalEarned ?? 0) - amount),
    });
    tx.delete(earningRef);
  });

  return NextResponse.json({ ok: true, earningId, amount, code });
}
