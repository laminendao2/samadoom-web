import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { PAYDUNYA_PLANS, isPlanId } from '@/lib/plans';
import { verifyRequestUser } from '@/lib/server-auth';

const PAYDUNYA_BASE_URL = process.env.PAYDUNYA_MODE === 'live'
  ? 'https://app.paydunya.com/api/v1'
  : 'https://app.paydunya.com/sandbox-api/v1';

const REFERRAL_DISCOUNT = 0.05;

export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyRequestUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const userId = authUser.uid;
    const userEmail = authUser.email || '';

    const { plan, referralCode } = await req.json();

    if (!isPlanId(plan)) {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
    }

    const planInfo = PAYDUNYA_PLANS[plan];
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://samadoom.com';

    let finalAmount = planInfo.amount;
    let validatedReferralCode: string | null = null;
    let referrerId: string | null = null;

    if (typeof referralCode === 'string' && /^[A-Za-z0-9]{3,20}$/.test(referralCode.trim())) {
      const code = referralCode.toUpperCase().trim();
      const refSnap = await adminDb.collection('referralCodes').doc(code).get();
      if (refSnap.exists) {
        const refData = refSnap.data()!;
        if (refData.userId !== userId) {
          finalAmount = Math.round(planInfo.amount * (1 - REFERRAL_DISCOUNT));
          validatedReferralCode = code;
          referrerId = refData.userId;
        }
      }
    }

    // custom_data : PayDunya exige des valeurs non-nulles (toutes en string)
    const customData: Record<string, string> = {
      userId,
      userEmail,
      plan,
      originalAmount: String(planInfo.amount),
      regularAmount: String(planInfo.regularAmount),
    };
    if (validatedReferralCode) customData.referralCode = validatedReferralCode;
    if (referrerId) customData.referrerId = referrerId;

    const body = {
      invoice: {
        total_amount: finalAmount,
        description: validatedReferralCode
          ? `${planInfo.description} (-5% parrainage)`
          : planInfo.description,
      },
      store: {
        name: 'Sama Doom',
        tagline: 'Education islamique',
        postal_address: 'Dakar, Senegal',
        phone: '',
        logo_url: `${siteUrl}/logo.png`,
        website_url: siteUrl,
      },
      actions: {
        cancel_url: `${siteUrl}/abonnement?status=cancel`,
        return_url: `${siteUrl}/abonnement/success?plan=${plan}`,
        callback_url: `${siteUrl}/api/paydunya/callback`,
      },
      custom_data: customData,
    };

    let response: Response;
    try {
      response = await fetch(`${PAYDUNYA_BASE_URL}/checkout-invoice/create`, {
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
    } catch (fetchErr) {
      console.error('PayDunya fetch unreachable:', fetchErr);
      return NextResponse.json({ error: 'Service de paiement indisponible. Réessayez.' }, { status: 503 });
    }

    let data: Record<string, unknown>;
    try {
      data = await response.json();
    } catch (jsonErr) {
      console.error('PayDunya non-JSON response (HTTP', response.status, '):', jsonErr);
      return NextResponse.json({ error: 'Réponse inattendue du service de paiement.' }, { status: 502 });
    }

    if (data.response_code !== '00') {
      console.error('PayDunya error response:', JSON.stringify(data));
      const paydunyaMsg = typeof data.response_text === 'string' ? data.response_text : '';
      const userMsg = paydunyaMsg && paydunyaMsg.toLowerCase() !== 'erreur serveur'
        ? paydunyaMsg
        : 'Erreur lors de la création de la facture PayDunya. Réessayez.';
      return NextResponse.json({ error: userMsg }, { status: 502 });
    }

    if (!data.token || typeof data.token !== 'string') {
      console.error('PayDunya missing token:', JSON.stringify(data));
      return NextResponse.json({ error: 'Réponse PayDunya incomplète (token manquant).' }, { status: 502 });
    }

    await adminDb.collection('payments').doc(data.token as string).set({
      userId,
      userEmail,
      plan,
      amount: finalAmount,
      originalAmount: planInfo.amount,
      currency: 'XOF',
      status: 'pending',
      provider: 'paydunya',
      token: data.token,
      referralCode: validatedReferralCode,
      referrerId,
      discountApplied: Boolean(validatedReferralCode),
      createdAt: new Date().toISOString(),
    });

    const checkoutUrl = typeof data.response_text === 'string' && data.response_text.startsWith('http')
      ? data.response_text
      : `https://app.paydunya.com/checkout/invoice/${data.token}`;

    return NextResponse.json({
      success: true,
      token: data.token,
      checkoutUrl,
      discountApplied: validatedReferralCode ? REFERRAL_DISCOUNT * 100 : 0,
      finalAmount,
    });
  } catch (err) {
    console.error('PayDunya create error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
