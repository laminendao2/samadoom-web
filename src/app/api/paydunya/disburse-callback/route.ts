import { NextRequest, NextResponse } from 'next/server';
import { checkDisburseStatus, settleWithdrawal } from '@/lib/withdrawals';
import { adminDb } from '@/lib/firebase-admin';

/**
 * PayDunya vérifie l'accessibilité du callback de déboursement via GET.
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}

/**
 * Webhook PayDunya pour les virements (Payout / Déboursement).
 * PayDunya appelle cette URL quand le statut d'un virement change.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const disburseToken: string = body?.disburse_token ?? body?.token ?? '';

    if (!disburseToken) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 400 });
    }

    // Trouver le retrait correspondant
    const snap = await adminDb.collection('withdrawals')
      .where('disburseToken', '==', disburseToken)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: 'Retrait introuvable' }, { status: 404 });
    }

    const doc = snap.docs[0];
    const current = doc.data().status;
    if (current !== 'pending') {
      // Déjà traité — idempotent
      return NextResponse.json({ received: true });
    }

    // Confirmer le statut réel auprès de PayDunya
    const real = await checkDisburseStatus(disburseToken);
    if (real === 'success') {
      await settleWithdrawal(doc.id, 'paid');
    } else if (real === 'failed') {
      await settleWithdrawal(doc.id, 'failed', { failReason: 'Echec PayDunya (webhook)' });
    }
    // 'pending' / 'unknown' : on attend le prochain webhook

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('disburse-callback error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
