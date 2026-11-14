import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { paydunyaHeaders } from '@/lib/subscription';

const PAYDUNYA_V2 = process.env.PAYDUNYA_MODE === 'live'
  ? 'https://app.paydunya.com/api/v2'
  : 'https://app.paydunya.com/sandbox-api/v2';

export type DisburseStatus = 'success' | 'failed' | 'pending' | 'created' | 'unknown';

/** Statut réel d'un retrait, demandé directement à PayDunya. */
export async function checkDisburseStatus(disburseToken: string): Promise<DisburseStatus> {
  try {
    const res = await fetch(`${PAYDUNYA_V2}/disburse/check-status`, {
      method: 'POST',
      headers: paydunyaHeaders(),
      body: JSON.stringify({ disburse_invoice: disburseToken }),
      cache: 'no-store',
    });
    const data = await res.json();
    const status = String(data?.status ?? '').toLowerCase();
    if (status === 'success' || status === 'failed' || status === 'pending' || status === 'created') {
      return status;
    }
    return 'unknown';
  } catch (err) {
    console.error('PayDunya check-status error:', err);
    return 'unknown';
  }
}

/**
 * Clôt un retrait — une seule fois. Seul un retrait encore "pending" peut
 * passer à "paid" ou "failed" ; le remboursement du solde en cas d'échec est
 * donc impossible à rejouer.
 */
export async function settleWithdrawal(
  withdrawalId: string,
  outcome: 'paid' | 'failed',
  details: Record<string, unknown> = {},
): Promise<boolean> {
  const ref = adminDb.collection('withdrawals').doc(withdrawalId);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const w = snap.data()!;
    if (w.status !== 'pending') return false;

    const nowIso = new Date().toISOString();
    if (outcome === 'paid') {
      tx.update(ref, { ...details, status: 'paid', paidAt: nowIso, updatedAt: nowIso });
    } else {
      tx.update(adminDb.collection('referralCodes').doc(w.referralCode), {
        balance: FieldValue.increment(Number(w.amount)),
      });
      tx.update(ref, { ...details, status: 'failed', updatedAt: nowIso });
    }
    return true;
  });
}
