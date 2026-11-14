import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { isValidPaydunyaHash, parsePaydunyaBody } from '@/lib/subscription';
import { checkDisburseStatus, settleWithdrawal } from '@/lib/withdrawals';

/**
 * Webhook PayDunya pour les retraits (disbursements).
 * Le statut annoncé dans la requête n'est pas cru : on redemande le statut réel
 * à PayDunya avant de marquer le retrait payé ou de rembourser le solde.
 */
export async function POST(req: NextRequest) {
  try {
    const body = parsePaydunyaBody(await req.text());
    const disburseToken = body['token'] ?? body['disburse_token'] ?? body['disburse_invoice'];

    if (!disburseToken) {
      return NextResponse.json({ error: 'token manquant' }, { status: 400 });
    }
    if (body['hash'] && !isValidPaydunyaHash(body['hash'])) {
      console.warn('disburse-callback: hash invalide');
      return NextResponse.json({ error: 'Signature invalide' }, { status: 403 });
    }

    const withdrawalsSnap = await adminDb.collection('withdrawals')
      .where('disburseToken', '==', disburseToken).limit(1).get();

    if (withdrawalsSnap.empty) {
      console.warn('Withdrawal not found for disburse token');
      return NextResponse.json({ received: true });
    }

    const withdrawalDoc = withdrawalsSnap.docs[0];
    if (withdrawalDoc.data().status !== 'pending') {
      return NextResponse.json({ received: true }); // déjà traité
    }

    const status = await checkDisburseStatus(disburseToken);
    if (status === 'success') {
      await settleWithdrawal(withdrawalDoc.id, 'paid');
      console.log(`Retrait ${withdrawalDoc.id} : PAYE`);
    } else if (status === 'failed') {
      await settleWithdrawal(withdrawalDoc.id, 'failed', { failReason: 'Echec PayDunya' });
      console.log(`Retrait ${withdrawalDoc.id} : ECHEC — solde rembourse`);
    } else if (status === 'unknown') {
      // 5xx → PayDunya renverra la notification
      return NextResponse.json({ error: 'Statut indisponible' }, { status: 503 });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('disburse-callback error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
