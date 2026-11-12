import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';

const PAYDUNYA_BASE = process.env.PAYDUNYA_MODE === 'live'
  ? 'https://app.paydunya.com/api/v2'
  : 'https://app.paydunya.com/sandbox-api/v2';

const PAYDUNYA_HEADERS = {
  'Content-Type': 'application/json',
  'PAYDUNYA-MASTER-KEY':  process.env.PAYDUNYA_MASTER_KEY!,
  'PAYDUNYA-PRIVATE-KEY': process.env.PAYDUNYA_PRIVATE_KEY!,
  'PAYDUNYA-TOKEN':       process.env.PAYDUNYA_TOKEN!,
};

const WITHDRAW_MODE_MAP: Record<string, string> = {
  'orange-money': 'orange-money-senegal',
  'wave':         'wave-senegal',
  'free-money':   'free-money-senegal',
};

const MIN_WITHDRAW = 2000; // FCFA

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }
    let uid: string;
    try {
      const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
    }

    const { amount, phone, operator } = await req.json();

    // 2. Validation
    if (!amount || !phone || !operator) {
      return NextResponse.json({ error: 'Champs manquants (amount, phone, operator)' }, { status: 400 });
    }
    if (amount < MIN_WITHDRAW) {
      return NextResponse.json({ error: `Montant minimum : ${MIN_WITHDRAW} FCFA` }, { status: 400 });
    }
    const withdrawMode = WITHDRAW_MODE_MAP[operator];
    if (!withdrawMode) {
      return NextResponse.json({ error: 'Operateur non supporte' }, { status: 400 });
    }
    const cleanPhone = phone.replace(/\s+/g, '').replace(/^(\+221|00221)/, '');
    if (!/^\d{9}$/.test(cleanPhone)) {
      return NextResponse.json({ error: 'Numero invalide (9 chiffres sans indicatif)' }, { status: 400 });
    }

    // 3. Code de parrainage
    const codesSnap = await adminDb.collection('referralCodes')
      .where('userId', '==', uid).limit(1).get();
    if (codesSnap.empty) {
      return NextResponse.json({ error: 'Aucun code de parrainage trouve' }, { status: 404 });
    }
    const codeDoc = codesSnap.docs[0];
    const balance: number = codeDoc.data().balance ?? 0;

    if (balance < amount) {
      return NextResponse.json({ error: `Solde insuffisant (${balance} FCFA disponibles)` }, { status: 400 });
    }

    // 4. Transaction atomique : deduire solde + creer retrait
    const withdrawalRef = adminDb.collection('withdrawals').doc();
    await adminDb.runTransaction(async (tx) => {
      const freshCode = await tx.get(codeDoc.ref);
      const freshBalance = freshCode.data()?.balance ?? 0;
      if (freshBalance < amount) throw new Error('Solde insuffisant');
      tx.update(codeDoc.ref, { balance: FieldValue.increment(-amount) });
      tx.set(withdrawalRef, {
        id: withdrawalRef.id,
        userId: uid,
        referralCode: codeDoc.id,
        amount,
        phone: cleanPhone,
        operator,
        withdrawMode,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    });

    // 5. PayDunya get-invoice
    const getInvoiceRes = await fetch(`${PAYDUNYA_BASE}/disburse/get-invoice`, {
      method: 'POST',
      headers: PAYDUNYA_HEADERS,
      body: JSON.stringify({
        account_alias: cleanPhone,
        amount: amount,
        withdraw_mode: withdrawMode,
        callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/paydunya/disburse-callback`,
      }),
    });
    const getInvoiceData = await getInvoiceRes.json();
    console.log('PayDunya get-invoice:', JSON.stringify(getInvoiceData));

    if (!getInvoiceData?.disburse_token) {
      await adminDb.runTransaction(async (tx) => {
        tx.update(codeDoc.ref, { balance: FieldValue.increment(amount) });
        tx.update(withdrawalRef, {
          status: 'failed',
          failReason: getInvoiceData?.message ?? 'PayDunya error',
          updatedAt: new Date().toISOString(),
        });
      });
      return NextResponse.json({ error: getInvoiceData?.message ?? 'Erreur PayDunya' }, { status: 502 });
    }

    const disburseToken: string = getInvoiceData.disburse_token;

    // 6. PayDunya submit-invoice
    const submitRes = await fetch(`${PAYDUNYA_BASE}/disburse/submit-invoice`, {
      method: 'POST',
      headers: PAYDUNYA_HEADERS,
      body: JSON.stringify({ disburse_invoice: disburseToken }),
    });
    const submitData = await submitRes.json();
    console.log('PayDunya submit-invoice:', JSON.stringify(submitData));

    await withdrawalRef.update({
      disburseToken,
      paydunyaSubmitResponse: submitData,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      withdrawalId: withdrawalRef.id,
      message: `Retrait de ${amount} FCFA en cours`,
    });

  } catch (err) {
    console.error('Withdraw error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
