import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser, isSuperAdminUid } from '@/lib/server-auth';
import { activatePaydunyaPayment } from '@/lib/subscription';

export const preferredRegion = 'cdg1';


const EXPIRY_HOURS = Number(process.env.PENDING_EXPIRY_HOURS ?? '2');

async function runExpiry() {
  const cutoffMs = Date.now() - EXPIRY_HOURS * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const snap = await adminDb
    .collection('payments')
    .where('status', '==', 'pending')
    .limit(200)
    .get();

  let checked = 0;
  let expired = 0;
  let activated = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.provider !== 'paydunya') continue;
    const createdAt: string | undefined = data.createdAt;
    if (!createdAt || createdAt >= cutoffIso) continue;

    const token: string = data.token ?? doc.id;
    checked++;

    try {
      const result = await activatePaydunyaPayment(token);
      if (result.status === 'completed') {
        activated++;
      } else {
        await doc.ref.update({ status: 'expired', expiredAt: new Date().toISOString() });
        expired++;
      }
    } catch (err) {
      console.error('[expire-pending] erreur token ' + token + ':', err);
    }
  }

  return { checked, expired, activated };
}

export async function POST(req: NextRequest) {
  const user = await verifyRequestUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (!(await isSuperAdminUid(user.uid))) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  try {
    const stats = await runExpiry();
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    console.error('[expire-pending] Erreur:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const stats = await runExpiry();
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    console.error('[expire-pending] Cron erreur:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
