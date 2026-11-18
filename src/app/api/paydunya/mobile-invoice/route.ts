import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getApps } from 'firebase-admin/app';


export const preferredRegion = 'cdg1'; // Paris — not blocked by PayDunya Cloudflare
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

    const body = await req.json();
    const { plan, referralCode: bodyReferralCode } = body;
    if (!plan || !PLANS[plan]) {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
    }

    const userId = decodedToken.uid;
    const userEmail = decodedToken.email || '';
    const planInfo = PLANS[plan];
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://samadoom.com';

    // Code parrain : priorité au code envoyé dans le body, sinon lire depuis le profil Firestore
    const REFERRAL_DISCOUNT = 0.05;
    let finalAmount = planInfo.amount;
    let validatedReferralCode: string | null = null;
    let referrerId: string | null = null;

    const userSnap = await adminDb.collection('users').doc(userId).get();
    const savedCode = (typeof bodyReferralCode === 'string' && /^[A-Za-z0-9]{3,20}$/.test(bodyReferralCode.trim()))
      ? bodyReferralCode.trim().toUpperCase()
      : (userSnap.data()?.savedReferralCode || null);

    if (savedCode) {
      const refSnap = await adminDb.collection('referralCodes').doc(savedCode).get();
      if (refSnap.exists) {
        const refData = refSnap.data()!;
        if (refData.userId !== userId) {
          finalAmount = Math.round(planInfo.amount * (1 - REFERRAL_DISCOUNT));
          validatedReferralCode = savedCode;
          referrerId = refData.userId;
        }
      }
    }

    const invoiceBody = {
      invoice: {
        total_amount: finalAmount,
        description: validatedReferralCode
          ? `${planInfo.description} (-5% parrainage)`
          : planInfo.description,
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
      custom_data: { userId, userEmail, plan, referralCode: validatedReferralCode, referrerId },
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
      body: JSON.stringify(invoiceBody),
    });

    const data = await response.json();
    if (data.response_code !== '00') {
      return NextResponse.json({ error: data.response_text || 'Erreur PayDunya' }, { status: 500 });
    }

    await adminDb.collection('payments').doc(data.token).set({
      userId, userEmail, plan,
      amount: finalAmount,
      originalAmount: planInfo.amount,
      currency: 'XOF',
      status: 'pending',
      provider: 'paydunya',
      token: data.token,
      referralCode: validatedReferralCode,
      referrerId,
      discountApplied: Boolean(validatedReferralCode), // réduction accordée → commission due
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      token: data.token,
      checkoutUrl: data.response_text || null,
      discountApplied: validatedReferralCode ? REFERRAL_DISCOUNT * 100 : 0,
      finalAmount,
    });
  } catch (err) {
    console.error('mobile-invoice error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
