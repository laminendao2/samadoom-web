import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';
import { activatePaydunyaPayment } from '@/lib/subscription';

export async function GET(req: NextRequest) {
  try {
    const authUser = await verifyRequestUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token requis' }, { status: 400 });
    }

    const paymentRef = adminDb.collection('payments').doc(token);
    let paySnap = await paymentRef.get();
    if (!paySnap.exists) {
      return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });
    }
    // Security: only the user who created the invoice can check it
    if (paySnap.data()!.userId !== authUser.uid) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Encore en attente : on interroge PayDunya (filet de sécurité si le webhook n'est pas arrivé)
    if (paySnap.data()!.status === 'pending' && paySnap.data()!.provider === 'paydunya') {
      await activatePaydunyaPayment(token);
      paySnap = await paymentRef.get();
    }

    const payment = paySnap.data()!;
    return NextResponse.json({
      status: payment.status,
      plan: payment.plan,
      amount: payment.amount,
      currency: payment.currency,
      createdAt: payment.createdAt,
    });
  } catch (err) {
    console.error('payment-status error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
