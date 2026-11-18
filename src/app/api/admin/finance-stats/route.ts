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

/** Date d'un champ Firestore : chaîne ISO, Timestamp Admin ou Date. */
function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (v instanceof Date) return v;
  if (typeof (v as { toDate?: unknown }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate();
  }
  return null;
}

function parseBound(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
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

  // ── Période demandée : [from, to[ en ISO (bornes calculées côté client,
  //    dans le fuseau de l'utilisateur). Sans paramètre → tout l'historique.
  const sp = req.nextUrl.searchParams;
  const from = parseBound(sp.get('from'));
  const to   = parseBound(sp.get('to'));
  if ((sp.get('from') && !from) || (sp.get('to') && !to) || (from && to && from >= to)) {
    return NextResponse.json({ error: 'Période invalide' }, { status: 400 });
  }
  const hasPeriod = Boolean(from || to);
  const inPeriod = (v: unknown): boolean => {
    if (!hasPeriod) return true;
    const d = toDate(v);
    if (!d) return false;               // sans date → exclu d'une vue filtrée
    if (from && d < from) return false;
    if (to && d >= to) return false;
    return true;
  };

  // ── Charger tous les paiements ─────────────────────────────────────────────
  const paymentsSnap = await adminDb.collection('payments').get();
  let paymentsInPeriod = 0;

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
    if (!inPeriod(p.createdAt)) continue;
    paymentsInPeriod++;
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

  // ── Commissions générées sur la période (referralEarnings, en XOF) ────────
  // Les soldes ci-dessus (dues / payées) sont des cumuls actuels : ils ne
  // peuvent pas être découpés par période. Seuls les gains datés le peuvent.
  let commissionsEarnedInPeriod = totalCommissionsEarned;
  if (hasPeriod) {
    const earningsSnap = await adminDb.collection('referralEarnings').get();
    commissionsEarnedInPeriod = 0;
    for (const doc of earningsSnap.docs) {
      const e = doc.data();
      if (!inPeriod(e.createdAt)) continue;
      commissionsEarnedInPeriod += typeof e.commission === 'number' ? e.commission : 0;
    }
  }

  // ── Totaux Stripe + PayDunya ──────────────────────────────────────────────
  const totalXof = Object.values(platforms).reduce((s, p) => s + p.totalXof, 0);
  const netXof   = totalXof - totalCommissionsDues;
  const netPeriodXof = totalXof - commissionsEarnedInPeriod;

  // ── RevenueCat : appel direct à l'API REST v2 ─────────────────────────────
  // Clé secrète dans REVENUECAT_SECRET_KEY (Vercel env vars)
  // Project ID Sama Doom : 40327083
  const RC_SECRET = process.env.REVENUECAT_SECRET_KEY ?? '';
  const RC_PROJECT_ID = '40327083';

  interface RcData {
    activeSubscriptions: number;
    mrrUsd: number | null;
    revenueUsd28d: number | null;
    mrrXof: number | null;
    revenueXof28d: number | null;
    apiConnected: boolean;
    error?: string;
  }

  let rcData: RcData = {
    activeSubscriptions: 0,
    mrrUsd: null,
    revenueUsd28d: null,
    mrrXof: null,
    revenueXof28d: null,
    apiConnected: false,
  };

  if (RC_SECRET) {
    try {
      // Endpoint v2 overview metrics (disponible sur tous les plans)
      const rcRes = await fetch(
        `https://api.revenuecat.com/v2/projects/${RC_PROJECT_ID}/metrics/overview`,
        {
          headers: {
            Authorization: `Bearer ${RC_SECRET}`,
            'Content-Type': 'application/json',
          },
          // next: { revalidate: 300 }, // cache 5 min
        }
      );

      if (rcRes.ok) {
        const rcJson = await rcRes.json() as {
          metrics?: Array<{ id: string; value: number; period?: string }>;
        };
        const metrics = rcJson.metrics ?? [];
        const find = (id: string) => metrics.find((m) => m.id === id)?.value ?? null;

        const mrrRaw    = find('mrr');           // en USD
        const rev28Raw  = find('revenue');       // revenus 28 derniers jours en USD
        const activeSubs = find('active_subscriptions') ?? find('active_paying_subscribers');

        // Taux USD→XOF approximatif pour affichage
        const USD_DISPLAY = 600;
        rcData = {
          activeSubscriptions: activeSubs ? Math.round(activeSubs) : 0,
          mrrUsd:       mrrRaw,
          revenueUsd28d: rev28Raw,
          mrrXof:       mrrRaw    !== null ? Math.round(mrrRaw    * USD_DISPLAY) : null,
          revenueXof28d: rev28Raw !== null ? Math.round(rev28Raw  * USD_DISPLAY) : null,
          apiConnected: true,
        };
      } else {
        const errText = await rcRes.text().catch(() => '');
        rcData.error = `HTTP ${rcRes.status}: ${errText.slice(0, 120)}`;
        rcData.apiConnected = false;
      }
    } catch (e: unknown) {
      rcData.error = e instanceof Error ? e.message : String(e);
      rcData.apiConnected = false;
    }
  } else {
    rcData.error = 'REVENUECAT_SECRET_KEY manquante — ajouter dans Vercel env vars';
  }

  return NextResponse.json({
    platforms: {
      stripe:   platforms.stripe,
      paydunya: platforms.paydunya,
      ...(platforms.other.count > 0 ? { other: platforms.other } : {}),
    },
    revenueCat: rcData,
    commissions: {
      totalEarned: totalCommissionsEarned,
      dues:  totalCommissionsDues,
      paid:  totalCommissionsPaid,
      earnedInPeriod: commissionsEarnedInPeriod,
    },
    summary: {
      totalXof,
      netXof,
      netPeriodXof,
      totalPayments: paymentsInPeriod,
    },
    period: {
      filtered: hasPeriod,
      from: from ? from.toISOString() : null,
      to:   to   ? to.toISOString()   : null,
    },
  });
}
