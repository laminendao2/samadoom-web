import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Webhook PayDunya pour les remboursements (disbursements).
 * PayDunya appelle cette URL quand le virement Mobile Money est confirme ou echoue.
 */
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    console.log('PayDunya disburse-callback:', JSON.stringify(data));

    // PayDunya envoie le disburse_token et le statut
    const disburseToken: string = data?.disburse_token ?? data?.data?.disburse_token;
    const status: string = data?.status ?? data?.data?.status; // 'success' | 'failed' | 'pending'

    if (!disburseToken) {
      return NextResponse.json({ error: 'disburse_token manquant' }, { status: 400 });
    }

    // Trouver le retrait par disburseToken
    const withdrawalsSnap = await adminDb.collection('withdrawals')
      .where('disburseToken', '==', disburseToken).limit(1).get();

    if (withdrawalsSnap.empty) {
      console.warn('Withdrawal not found for disburse_token:', disburseToken);
      return NextResponse.json({ received: true });
    }

    const withdrawalDoc = withdrawalsSnap.docs[0];
    const withdrawal = withdrawalDoc.data();

    if (withdrawal.status === 'paid') {
      // Deja traite
      return NextResponse.json({ received: true });
    }

    if (status === 'success') {
      await withdrawalDoc.ref.update({
        status: 'paid',
        paidAt: new Date().toISOString(),
        paydunyaCallbackData: data,
      });
      console.log(`Retrait ${withdrawalDoc.id} : PAYE (${withdrawal.amount} FCFA vers ${withdrawal.phone})`);

    } else if (status === 'failed') {
      // Rembourser le solde
      const codeRef = adminDb.collection('referralCodes').doc(withdrawal.referralCode);
      await adminDb.runTransaction(async (tx) => {
        tx.update(codeRef, { balance: FieldValue.increment(withdrawal.amount) });
        tx.update(withdrawalDoc.ref, {
          status: 'failed',
          failReason: data?.message ?? 'Echec PayDunya',
          paydunyaCallbackData: data,
          updatedAt: new Date().toISOString(),
        });
      });
      console.log(`Retrait ${withdrawalDoc.id} : ECHEC — solde rembourse`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('disburse-callback error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
