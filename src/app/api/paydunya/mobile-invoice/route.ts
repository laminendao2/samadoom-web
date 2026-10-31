import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getApps } from 'firebase-admin/app';

const PAYDUNYA_BASE_URL = process.env.PAYDUNYA_MODE === 'live'
  ? 'https://app.paydunya.com/api/v1'
  : 'https://app.paydunya.com/sandbox-api/v1';

const PLANS: Record<string, { name: string; amount: number; description: string }> = {
  mensuel: { name: 'Abonnement Mensuel', amount: 3000, description: 'Accès complet Sama Doom — 1 mois' },
  annuel:  { name: 'Abonnement Annuel',  amount: 24000, description: 'Accès complet Sama Doom — 12 mois (2 mois offerts)' },
};

export async function POST(req: NextRequest) {
  try {
    // Authenticate via Firebase ID token
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

    const { plan } = await req.json();
    if (!plan || !PLANS[plan]) {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
    }

    const userId = decodedToken.uid;
    const userEmail = decodedToken.email || '';
    const planInfo = PLANS[plan];
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://samadoom.com';

    const body = {
      invoice: {
        total_amount: planInfo.amount,
        description: planInfo.description,
      },
      store: {
        name: 'Sama Doom',
        tagline: 'Éducation islamique',
        postal_address: 'Dakar, Sénégal',
        phone: '',
        logo_url: `${siteUrl}/logo.png`,
        website_url: siteUrl,
      },
      actions: {
        cancel_url: `${siteUrl}/abonnement?status=cancel`,
        return_url: `${siteUrl}/abonnement/success?plan=${plan}`,
        callback_url: `${siteUrl}/api/paydunya/callback`,
      },
      custom_data: { userId, userEmail, plan },
    };

    const response = await fetch(`${PAYDUNYA_BASE_URL}/checkout-invoice/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PAYDUNYA-MASTER-KEY': process.env.PAYDUNYA_MASTER_KEY!,
        'PAYDUNYA-PRIVATE-KEY': process.env.PAYDUNYA_PRIVATE_KEY!,
        'PAYDUNYA-TOKEN': process.env.PAYDUNYA_TOKEN!,
        'PAYDUNYA-PUBLIC-KEY': process.env.PAYDUNYA_PUBLIC_KEY!,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (data.response_code !== '00') {
      return NextResponse.json({ error: data.response_text || 'Erreur PayDunya' }, { status: 500 });
    }

    await adminDb.collection('payments').doc(data.token).set({
      userId, userEmail, plan,
      amount: planInfo.amount,
      currency: 'XOF',
      status: 'pending',
      provider: 'paydunya',
      token: data.token,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      token: data.token,
      checkoutUrl: data.response_text || null,
    });
  } catch (err) {
    console.error('mobile-invoice error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
