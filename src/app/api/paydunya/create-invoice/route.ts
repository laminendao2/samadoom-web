import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

const PAYDUNYA_BASE_URL = process.env.PAYDUNYA_MODE === 'live'
  ? 'https://app.paydunya.com/api/v1'
  : 'https://app.paydunya.com/sandbox-api/v1';

const PLANS: Record<string, { name: string; amount: number; description: string }> = {
  mensuel: {
    name: 'Abonnement Mensuel',
    amount: 3000, // FCFA
    description: 'Accès complet Sama Doom — 1 mois',
  },
  annuel: {
    name: 'Abonnement Annuel',
    amount: 24000, // FCFA (économise 2 mois)
    description: 'Accès complet Sama Doom — 12 mois (2 mois offerts)',
  },
};

export async function POST(req: NextRequest) {
  try {
    const { plan, userId, userEmail } = await req.json();

    if (!plan || !PLANS[plan]) {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
    }
    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Utilisateur requis' }, { status: 401 });
    }

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
      custom_data: {
        userId,
        userEmail,
        plan,
      },
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
      console.error('PayDunya error:', data);
      return NextResponse.json({ error: data.response_text || 'Erreur PayDunya' }, { status: 500 });
    }

    // Sauvegarder la facture en attente dans Firestore
    await adminDb.collection('payments').doc(data.token).set({
      userId,
      userEmail,
      plan,
      amount: planInfo.amount,
      currency: 'XOF',
      status: 'pending',
      provider: 'paydunya',
      token: data.token,
      createdAt: new Date().toISOString(),
    });

    const checkoutUrl = data.response_text === 'Pending' && data.token
      ? `${PAYDUNYA_BASE_URL.replace('/api/v1', '').replace('/sandbox-api/v1', '')}/checkout/invoice/${data.token}`
      : null;

    return NextResponse.json({
      success: true,
      token: data.token,
      checkoutUrl: checkoutUrl || `https://app.paydunya.com/checkout/invoice/${data.token}`,
    });
  } catch (err) {
    console.error('PayDunya create error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
