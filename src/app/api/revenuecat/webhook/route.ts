import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Webhook RevenueCat → Firestore
 * Synchronise l'état d'abonnement IAP (Apple / Google) vers Firestore
 * afin que le dashboard web reflète l'abonnement mobile.
 *
 * Config RevenueCat : Project → Integrations → Webhooks → Add Endpoint
 *   URL : https://samadoom.com/api/revenuecat/webhook
 *   Authorization : Bearer <REVENUECAT_WEBHOOK_SECRET>
 */

/** Événements qui activent ou prolongent l'abonnement */
const ACTIVATE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'SUBSCRIBER_ALIAS',
]);

/** Événements qui terminent l'abonnement */
const EXPIRE_EVENTS = new Set([
  'EXPIRATION',
  'BILLING_ISSUE',  // paiement échoué définitivement (après grace period)
]);

/** Événements à ignorer silencieusement */
const IGNORE_EVENTS = new Set([
  'CANCELLATION',    // annulé mais reste actif jusqu'à expiration_at_ms → géré via EXPIRATION
  'TEST',
  'TRANSFER',
  'SUBSCRIPTION_PAUSED',
  'SUBSCRIPTION_EXTENDED',
]);

interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  original_app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number | null;
  purchased_at_ms?: number;
  store?: string;
  environment?: string;
  entitlement_ids?: string[];
  period_type?: string;
}

interface RevenueCatPayload {
  api_version?: string;
  event: RevenueCatEvent;
}

export async function POST(req: NextRequest) {
  // --- Vérification du secret ---
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    console.error('REVENUECAT_WEBHOOK_SECRET non configuré');
    return NextResponse.json({ error: 'Config manquante' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const receivedSecret = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (receivedSecret !== secret) {
    console.warn('RevenueCat webhook : secret invalide');
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  // --- Parsing du payload ---
  let payload: RevenueCatPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const event = payload.event;
  if (!event || !event.type || !event.app_user_id) {
    return NextResponse.json({ error: 'Payload incomplet' }, { status: 400 });
  }

  // Ignorer les événements sandbox et les événements non pertinents
  if (event.environment === 'SANDBOX' && process.env.NODE_ENV === 'production') {
    console.log(`RevenueCat sandbox ignoré : ${event.type}`);
    return NextResponse.json({ received: true, skipped: 'sandbox' });
  }

  if (IGNORE_EVENTS.has(event.type)) {
    console.log(`RevenueCat événement ignoré : ${event.type}`);
    return NextResponse.json({ received: true, skipped: event.type });
  }

  // Trouver l'UID Firebase : app_user_id ou original_app_user_id
  // L'app mobile doit appeler Purchases.logIn(firebaseUid) pour que ce soit l'UID Firebase
  const uid = event.app_user_id || event.original_app_user_id;
  if (!uid || uid.startsWith('$RC')) {
    // $RCAnonymousID : utilisateur non connecté, on ne peut pas l'associer
    console.warn(`RevenueCat webhook : UID anonyme (${uid}), ignoré`);
    return NextResponse.json({ received: true, skipped: 'anonymous_user' });
  }

  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    console.warn(`RevenueCat webhook : utilisateur ${uid} introuvable dans Firestore`);
    // On répond 200 pour éviter les relivraisons infinies
    return NextResponse.json({ received: true, skipped: 'user_not_found' });
  }

  const now = new Date();

  if (ACTIVATE_EVENTS.has(event.type)) {
    // --- Activation ---
    const expirationMs = event.expiration_at_ms;
    if (!expirationMs) {
      console.warn(`RevenueCat ${event.type} sans expiration_at_ms pour ${uid}`);
      return NextResponse.json({ received: true, skipped: 'no_expiration' });
    }

    const expiresAt = new Date(expirationMs);

    // Ne pas rétrograder une expiration déjà plus lointaine (ex. renouvellement
    // traité en double, ou abonnement manuel SuperAdmin plus long)
    const existing = userSnap.data();
    const existingEnd = existing?.subscriptionEnd?.toDate?.() as Date | undefined;
    if (existingEnd && existingEnd > expiresAt) {
      console.log(`RevenueCat ${event.type} : expiration existante (${existingEnd.toISOString()}) > nouvelle (${expiresAt.toISOString()}), ignoré`);
      return NextResponse.json({ received: true, skipped: 'existing_longer' });
    }

    await userRef.set({
      isPro: true,
      subscriptionEnd: Timestamp.fromDate(expiresAt),
      planExpiresAt: expiresAt.toISOString(),
      plan: event.product_id?.includes('annuel') ? 'annuel' : 'mensuel',
      lastPaymentProvider: event.store === 'PLAY_STORE' ? 'google_play' : 'apple',
      planActivatedAt: event.purchased_at_ms
        ? new Date(event.purchased_at_ms).toISOString()
        : now.toISOString(),
      cancelAtPeriodEnd: false,
    }, { merge: true });

    console.log(`RevenueCat ${event.type} : ${uid} activé jusqu'au ${expiresAt.toISOString()}`);
    return NextResponse.json({ received: true, result: 'activated', expiresAt: expiresAt.toISOString() });

  } else if (EXPIRE_EVENTS.has(event.type)) {
    // --- Expiration ---
    // On garde subscriptionEnd à sa valeur actuelle si elle est dans le futur
    // (ex. abonnement manuel SuperAdmin), sinon on met isPro à false
    const existing = userSnap.data();
    const existingEnd = existing?.subscriptionEnd?.toDate?.() as Date | undefined;

    if (existingEnd && existingEnd > now) {
      // L'accès est toujours valide (ex. don manuel SuperAdmin ou autre source)
      console.log(`RevenueCat ${event.type} : ${uid} a encore accès jusqu'au ${existingEnd.toISOString()}, isPro conservé`);
      return NextResponse.json({ received: true, skipped: 'still_active_other_source' });
    }

    await userRef.set({
      isPro: false,
      subscriptionEnd: null,
      planExpiresAt: null,
    }, { merge: true });

    console.log(`RevenueCat ${event.type} : ${uid} expiré`);
    return NextResponse.json({ received: true, result: 'expired' });
  }

  // Événement inconnu — répondre 200 pour éviter les relivraisons
  console.log(`RevenueCat événement non géré : ${event.type}`);
  return NextResponse.json({ received: true, skipped: 'unknown_event' });
}
