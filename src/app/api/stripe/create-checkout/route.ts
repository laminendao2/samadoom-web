import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-28.acacia',
});

// Prix en centimes USD
const STRIPE_PRICES: Record<string, number> = {
  mensuel: 500,  // $5.00
  annuel: 3900,  // $39.00
};

const REFERRAL_DISCOUNT = 0.10; // 10%

export async function POST(req: NextRequest) {
  try {
    const { plan, userId, userEmail, referralCode } = await req.json();

    if (!plan || !userId || !STRIPE_PRICES[plan]) {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
    }

    let finalAmount = STRIPE_PRICES[plan];
    let referrerId: string | null = null;
    let discountApplied = false;

    // Valider le code de parrainage si fourni
    if (referralCode) {
      try {
        const snap = await adminDb.collection('referralCodes').doc(referralCode.toUpperCase()).get();
        if (snap.exists) {
          const refData = snap.data()!;
          // Bloquer auto-parrainage
          if (refData.userId !== userId) {
            // Vérifier que le parrain est abonné
            const referrerDoc = await adminDb.collection('users').doc(refData.userId).get();
            if (referrerDoc.data()?.isPro) {
              finalAmount = Math.round(finalAmount * (1 - REFERRAL_DISCOUNT));
              referrerId = refData.userId;
              discountApplied = true;
            }
          }
        }
      } catch {
        // Ne pas bloquer si la validation échoue
      }
    }

    const origin = req.headers.get('origin') || 'https://samadoom.com';

    // Créer la session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: userEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: finalAmount,
            product_data: {
              name: `Sama Doom — Plan ${plan === 'mensuel' ? 'Mensuel' : 'Annuel'}`,
              description: discountApplied
                ? `Accès Pro Sama Doom (-10% parrainage code ${referralCode})`
                : 'Accès complet à tout le contenu islamique',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        userEmail: userEmail || '',
        plan,
        referralCode: referralCode || '',
        referrerId: referrerId || '',
        provider: 'stripe',
      },
      success_url: `${origin}/abonnement/success?session_id={CHECKOUT_SESSION_ID}&provider=stripe`,
      cancel_url: `${origin}/abonnement?cancelled=1`,
    });

    // Enregistrer en attente dans Firestore
    await adminDb.collection('payments').doc(session.id).set({
      sessionId: session.id,
      userId,
      userEmail: userEmail || '',
      plan,
      amount: finalAmount,
      currency: 'usd',
      referralCode: referralCode || null,
      referrerId: referrerId || null,
      discountApplied,
      status: 'pending',
      provider: 'stripe',
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      discountApplied,
      finalAmount,
    });
  } catch (err) {
    console.error('Stripe create-checkout error:', err);
    return NextResponse.json({ error: 'Erreur Stripe' }, { status: 500 });
  }
}
