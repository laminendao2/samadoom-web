import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-10-28.endive',
});

// Prix en centimes USD
const STRIPE_PRICES: Record<string, number> = {
  mensuel: 500,  // $5.00
  annuel: 3900,  // $39.00
};

const REFERRAL_DISCOUNT = 0.05; // 5%

export async function POST(req: NextRequest) {
  try {
    // L'identité vient du token Firebase, jamais du corps de la requête
    const authUser = await verifyRequestUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const userId = authUser.uid;
    const userEmail = authUser.email || '';

    const body = await req.json();
    const plan = typeof body.plan === 'string' ? body.plan : '';
    const referralCode = typeof body.referralCode === 'string' && /^[A-Za-z0-9]{3,20}$/.test(body.referralCode.trim())
      ? body.referralCode.trim().toUpperCase()
      : null;

    if (!plan || !Object.prototype.hasOwnProperty.call(STRIPE_PRICES, plan)) {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
    }

    let finalAmount = STRIPE_PRICES[plan];
    let referrerId: string | null = null;
    let discountApplied = false;

    // Valider le code de parrainage si fourni
    if (referralCode) {
      try {
        const snap = await adminDb.collection('referralCodes').doc(referralCode).get();
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

    // URL de retour fixe : ne pas faire confiance au header Origin
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://samadoom.com';

    // Créer la session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
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
                ? `Accès Pro Sama Doom (-5% parrainage code ${referralCode})`
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
