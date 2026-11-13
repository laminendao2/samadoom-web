import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

export async function GET(req: NextRequest) {
  try {
    // Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const idToken = authHeader.slice(7);
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
    }

    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token requis' }, { status: 400 });
    }

    const paySnap = await adminDb.collection('payments').doc(token).get();
    if (!paySnap.exists) {
      return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });
    }

    const payment = paySnap.data()!;
    // Security: only the user who created the invoice can check it
    if (payment.userId !== decodedToken.uid) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

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
