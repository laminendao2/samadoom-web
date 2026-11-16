/**
 * Conversion de devises vers XOF (FCFA) pour le calcul des commissions
 *
 * EUR → XOF : taux FIXE officiel 1 EUR = 655.957 XOF (pegging Trésor français depuis 1999)
 *             Zéro risque de change. On applique quand même FEE_FACTOR pour les frais Stripe
 *             et les frais de transfert mobile money.
 *
 * USD → XOF : taux FLOTTANT. On fetch le cours spot + on applique FEE_FACTOR.
 *             Fallback sur FALLBACK_USD_RATE si l'API est indisponible.
 *
 * FEE_FACTOR = 0.88 → 12% déduits pour couvrir :
 *   - Frais Stripe : ~2.9% + frais fixe par transaction
 *   - Frais de transfert mobile money (Wave, Orange) : 1-3%
 *   - Marge de sécurité pour fluctuations
 * → Modifier FEE_FACTOR ici uniquement pour ajuster sans toucher au reste.
 */

export const FEE_FACTOR = 0.88;           // 1 - frais totaux estimés (12%)
const EUR_TO_XOF_FIXED = 655.957;         // taux officiel immuable
const FALLBACK_USD_RATE = 600;            // fallback si API USD down
const CACHE_TTL_MS = 60 * 60 * 1000;     // 1 heure

let cachedUsdRate: number | null = null;
let cacheTime = 0;

async function getUsdSpotRate(): Promise<number> {
  const now = Date.now();
  if (cachedUsdRate !== null && now - cacheTime < CACHE_TTL_MS) return cachedUsdRate;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`er-api HTTP ${res.status}`);
    const data = await res.json() as { rates?: Record<string, number> };
    const spot = data.rates?.['XOF'];
    if (!spot || typeof spot !== 'number' || spot < 400 || spot > 900) {
      throw new Error(`taux XOF suspect: ${spot}`);
    }
    cachedUsdRate = spot;
    cacheTime = now;
    return spot;
  } catch (err) {
    console.warn(`[fx] API USD indisponible, fallback ${FALLBACK_USD_RATE}:`, err);
    return FALLBACK_USD_RATE;
  }
}

/**
 * Convertit un montant en centimes (Stripe) vers XOF au taux effectif.
 * Prend en compte la devise : EUR taux fixe, USD taux spot.
 * Applique FEE_FACTOR dans les deux cas.
 */
export async function stripeCentsToXof(cents: number, currency: 'eur' | 'usd'): Promise<number> {
  const cur = currency.toLowerCase() as 'eur' | 'usd';
  let spotRate: number;

  if (cur === 'eur') {
    spotRate = EUR_TO_XOF_FIXED;
  } else {
    spotRate = await getUsdSpotRate();
  }

  const effectiveRate = spotRate * FEE_FACTOR;
  const result = Math.round((cents / 100) * effectiveRate);
  console.log(`[fx] ${cents} ${cur} cents → ${result} XOF (spot ${spotRate}, effectif ${effectiveRate.toFixed(2)})`);
  return result;
}

/** Alias pour compatibilité ascendante (USD uniquement). */
export async function usdCentsToXof(cents: number): Promise<number> {
  return stripeCentsToXof(cents, 'usd');
}
