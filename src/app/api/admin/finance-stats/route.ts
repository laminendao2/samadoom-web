import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';

const EUR_TO_XOF = 655.957 * 0.88;   // taux fixe CFA × fee factor
const USD_TO_XOF = 600 * 0.88;        // approximation historique

function centsToXof(cents: number, currency: string): number {
  const cur = (currency ?? 'XOF').toUpperCase();
  if (cur === 'EUR') return Math.round((cents / 100) * EUR_TO_XOF);
  if (cur === 'USD') return Math.round((cents / 100) * USD_TO_XOF);
  return cents; // XOF natif (PayDunya)
}

function displayAmount(amount: number, currency: string): string {
  const cur = (currency ?? 'XOF').toUpperCase();
  if (cur === 'EUR') return `€${(amount / 100).toFixed(2)}`;
  if (cur === 'USD') return `$${(amount / 100).toFixed(2)}`;
  return `${amount.toLocaleString()} FCFA`;
}

export async function GET(req: NextRequest) {
  const authUser = await verifyRequestUser(req);
  if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const userDoc = await adminDb.collection('users').doc(authUser.uid).get();
  const userData = userDoc.data();
  const isSuperAdmin =
    userData?.role === 'superadmin' ||
    (Array.isArray(userData?.roles) && userData.roles.includes('superadmin'));
  if (!isSuperAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  // ── Charger tous les paiements ─────────────────────────────────────────────
  const paymentsSnap = await adminDb.collection('payments').get();

  interface PlatformStats {
    count: number;
    completed: number;
    pending: number;
    cancelled: number;
    totalNative: number;      // dans la devise native (centimes pour Stripe)
    totalXof: number;         // converti en FCFA
    currency: string;         // devise principale de la plateforme
    nativeLabel: string;      // ex: "€49.95"
  }

  const platforms: Record<string, PlatformStats> = {
    stripe:   { count: 0, completed: 0, pending: 0, cancelled: 0, totalNative: 0, totalXof: 0, currency: 'EUR', nativeLabel: '—' },
    paydunya: { count: 0, completed: 0, pending: 0, cancelled: 0, totalNative: 0, totalXof: 0, currency: 'XOF', nativeLabel: '—' },
    other:    { count: 0, completed: 0, pending: 0, cancelled: 0, totalNative: 0, totalXof: 0, currency: 'XOF', nativeLabel: '—' },
  };

  for (const doc of paymentsSnap.docs) {
    const p = doc.data();
    const provider = (p.provider ?? 'paydunya').toLowerCase();
    const currency  = (p.currency ?? 'XOF').toUpperCase();
    const amount    = typeof p.amount === 'number' ? p.amount : 0;
    const status    = p.status ?? 'pending';

    const key = provider === 'stripe' ? 'stripe' : provider === 'paydunya' ? 'paydunya' : 'other';
    const pl = platforms[key];
    pl.count++;
    if (status === 'completed') { pl.completed++; pl.totalNative += amount; pl.totalXof += centsToXof(amount, currency); }
    else if (status === 'pending') pl.pending++;
    else pl.cancelled++;
  }

  // Libellés natifs
  platforms.stripe.nativeLabel   = `€${(platforms.stripe.totalNative / 100).toFixed(2)}`;
  platforms.paydunya.nativeLabel = `${platforms.paydunya.totalNative.toLocaleString()} FCFA`;
  if (platforms.other.totalNative > 0) platforms.other.nativeLabel = `${platforms.other.totalNative.toLocaleString()} FCFA`;

  // ── Commissions dues (referralCodes) ──────────────────────────────────────
  const refCodesSnap = await adminDb.collection('referralCodes').get();
  let totalCommissionsDues = 0;
  let totalCommissionsPaid = 0;
  let totalCommissionsEarned = 0;

  for (const doc of refCodesSnap.docs) {
    const d = doc.data();
    totalCommissionsEarned += (d.totalEarned ?? 0);
    totalCommissionsDues   += (d.balance ?? 0);
    totalCommissionsPaid   += ((d.totalEarned ?? 0) - (d.balance ?? 0));
  }

  // ── Totaux ────────────────────────────────────────────────────────────────
  const totalXof = Object.values(platforms).reduce((s, p) => s + p.totalXof, 0);
  const netXof   = totalXof - totalCommissionsDues;

  // ── RevenueCat : estimé depuis users.subscriptionEnd (abonnements manuels exlus)
  // Les IAP Apple/Google ne sont pas accessibles ici directement
  const usersSnap = await adminDb.collection('users').get();
  const now = Date.now();
  let rcActiveCount = 0;
  for (const doc of usersSnap.docs) {
    const u = doc.data();
    // Abonné "isPro" sans planExpiresAt = provient de RevenueCat (pas de paiement Firestore)
    if (u.isPro === true && !u.planExpiresAt && !u.subscriptionEnd) rcActiveCount++;
  }

  return NextResponse.json({
    platforms: {
      stripe:   platforms.stripe,
      paydunya: platforms.paydunya,
      ...(platforms.other.count > 0 ? { other: platforms.other } : {}),
    },
    revenueCat: {
      activeSubscriptions: rcActiveCount,
      note: 'Revenus gérés par Apple/Google — disponibles dans le dashboard RevenueCat',
    },
    commissions: {
      totalEarned: totalCommissionsEarned,
      dues:  totalCommissionsDues,
      paid:  totalCommissionsPaid,
    },
    summary: {
      totalXof,
      netXof,
      totalPayments: paymentsSnap.size,
    },
  });
}
