'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const BASE_PLANS = [
  {
    id: 'mensuel',
    name: 'Mensuel',
    price: 3000,
    currency: 'FCFA',
    period: '/mois',
    features: ['Accès à tout le Coran', 'Cours illimités', 'Suivi des progrès', 'Support prioritaire'],
    highlight: false,
  },
  {
    id: 'annuel',
    name: 'Annuel',
    price: 24000,
    currency: 'FCFA',
    period: '/an',
    badge: 'Économise 33%',
    features: ['Tout du plan Mensuel', '2 mois offerts', 'Accès famille (2 enfants)', 'Contenu exclusif'],
    highlight: true,
  },
];

interface ReferralInfo {
  valid: boolean;
  discountPercent: number;
  referrerName: string;
  code: string;
}

function AbonnementContent() {
  const { user, profile } = useAuth();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [referralError, setReferralError] = useState('');
  const [referralLoading, setReferralLoading] = useState(false);

  // Détecter le code dans l'URL (?ref=CODE)
  useEffect(() => {
    const refParam = searchParams.get('ref');
    if (refParam) {
      setReferralCode(refParam.toUpperCase());
      validateCode(refParam.toUpperCase());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const validateCode = async (code: string) => {
    if (!code.trim()) {
      setReferralInfo(null);
      setReferralError('');
      return;
    }
    setReferralLoading(true);
    setReferralError('');
    try {
      const userId = user?.uid ? `&userId=${user.uid}` : '';
      const res = await fetch(`/api/referral/validate?code=${code.trim()}${userId}`);
      const data = await res.json();
      if (data.valid) {
        setReferralInfo(data);
        setReferralError('');
      } else {
        setReferralInfo(null);
        setReferralError(data.error || 'Code invalide');
      }
    } catch {
      setReferralError('Impossible de valider le code');
    } finally {
      setReferralLoading(false);
    }
  };

  const getDiscountedPrice = (basePrice: number) => {
    if (!referralInfo?.valid) return basePrice;
    return Math.round(basePrice * (1 - referralInfo.discountPercent / 100));
  };

  const handlePaydunya = async (planId: string) => {
    if (!user) return;
    setError('');
    setLoading(planId);
    try {
      const res = await fetch('/api/paydunya/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planId,
          userId: user.uid,
          userEmail: user.email,
          referralCode: referralInfo?.valid ? referralInfo.code : null,
        }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setError(data.error || 'Erreur lors de la création du paiement');
      }
    } catch {
      setError('Erreur réseau. Réessayez.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ padding: '32px 24px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111827', marginBottom: 8 }}>Abonnement Pro</h1>
      <p style={{ color: '#6b7280', marginBottom: 32 }}>Débloquez tout le contenu islamique pour vous et votre famille.</p>

      {profile?.isPro && (
        <div style={{ marginBottom: 32, padding: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>⭐</span>
          <div>
            <p style={{ fontWeight: 700, color: '#166534', margin: 0 }}>Vous avez déjà le Plan Pro !</p>
            <p style={{ fontSize: 13, color: '#15803d', margin: '2px 0 0' }}>Profitez de tout le contenu sans restriction.</p>
          </div>
        </div>
      )}

      {/* Zone code de parrainage */}
      <div style={{
        background: referralInfo?.valid ? '#f0fdf4' : '#f9fafb',
        border: `1px solid ${referralInfo?.valid ? '#bbf7d0' : '#e5e7eb'}`,
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
      }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
          🎁 Code de parrainage (optionnel)
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            placeholder="ex: CHEIKH4821"
            value={referralCode}
            onChange={e => setReferralCode(e.target.value.toUpperCase())}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 10,
              border: `1.5px solid ${referralInfo?.valid ? '#16a34a' : referralError ? '#dc2626' : '#d1d5db'}`,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: 1,
              outline: 'none',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
            }}
          />
          <button
            onClick={() => validateCode(referralCode)}
            disabled={referralLoading || !referralCode.trim()}
            style={{
              padding: '10px 20px',
              background: '#166534',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              cursor: referralLoading || !referralCode.trim() ? 'not-allowed' : 'pointer',
              opacity: referralLoading || !referralCode.trim() ? 0.6 : 1,
            }}>
            {referralLoading ? '…' : 'Appliquer'}
          </button>
        </div>

        {referralInfo?.valid && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <p style={{ fontSize: 13, color: '#166534', fontWeight: 600, margin: 0 }}>
              Code de <strong>{referralInfo.referrerName}</strong> — {referralInfo.discountPercent}% de réduction appliquée !
            </p>
          </div>
        )}
        {referralError && (
          <p style={{ marginTop: 8, fontSize: 13, color: '#dc2626' }}>❌ {referralError}</p>
        )}
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#dc2626', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Plans */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 32 }}>
        {BASE_PLANS.map(plan => {
          const discountedPrice = getDiscountedPrice(plan.price);
          const hasDiscount = referralInfo?.valid && discountedPrice < plan.price;

          return (
            <div key={plan.id} style={{
              position: 'relative',
              background: 'white',
              borderRadius: 20,
              padding: 24,
              border: plan.highlight ? '2px solid #166534' : '2px solid #e5e7eb',
              boxShadow: plan.highlight ? '0 8px 24px rgba(22,101,52,0.12)' : '0 2px 8px rgba(0,0,0,0.05)',
            }}>
              {plan.badge && !hasDiscount && (
                <div style={{
                  position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                  background: '#166534', color: 'white', fontSize: 11, fontWeight: 700,
                  padding: '4px 16px', borderRadius: 999, whiteSpace: 'nowrap',
                }}>
                  {plan.badge}
                </div>
              )}
              {hasDiscount && (
                <div style={{
                  position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                  background: '#dc2626', color: 'white', fontSize: 11, fontWeight: 700,
                  padding: '4px 16px', borderRadius: 999, whiteSpace: 'nowrap',
                }}>
                  🎁 -{referralInfo!.discountPercent}% parrainage
                </div>
              )}

              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#111827', marginBottom: 12 }}>{plan.name}</h3>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                {hasDiscount && (
                  <span style={{ fontSize: 20, color: '#9ca3af', textDecoration: 'line-through' }}>
                    {plan.price.toLocaleString('fr-FR')}
                  </span>
                )}
                <span style={{ fontSize: 36, fontWeight: 900, color: hasDiscount ? '#dc2626' : '#111827' }}>
                  {discountedPrice.toLocaleString('fr-FR')}
                </span>
                <span style={{ color: '#6b7280', fontSize: 14 }}>{plan.currency}{plan.period}</span>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' }}>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> {f}
                  </li>
                ))}
              </ul>

              <button
                disabled={loading === plan.id || !!profile?.isPro}
                onClick={() => handlePaydunya(plan.id)}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  borderRadius: 12,
                  background: plan.highlight ? '#166534' : '#f3f4f6',
                  color: plan.highlight ? 'white' : '#1f2937',
                  fontWeight: 700,
                  fontSize: 15,
                  border: 'none',
                  cursor: loading === plan.id || profile?.isPro ? 'not-allowed' : 'pointer',
                  opacity: loading === plan.id || profile?.isPro ? 0.7 : 1,
                }}>
                {loading === plan.id ? 'Redirection…' : profile?.isPro ? 'Plan actuel' : `Choisir ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Section PayDunya — méthodes de paiement */}
      <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 20, padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontWeight: 700, color: '#9a3412', marginBottom: 8, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          🌍 Paiement Afrique de l&apos;Ouest via PayDunya
        </h3>
        <p style={{ fontSize: 13, color: '#c2410c', marginBottom: 16 }}>
          Payez directement avec votre mobile money — sans carte bancaire.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {[
            { name: 'Orange Money', emoji: '🟠', color: '#ff6600' },
            { name: 'Wave', emoji: '🔵', color: '#0052ff' },
            { name: 'Free Money', emoji: '🟢', color: '#00a651' },
            { name: 'Expresso', emoji: '🔴', color: '#e30613' },
            { name: 'Carte bancaire', emoji: '💳', color: '#6b7280' },
          ].map(m => (
            <div key={m.name} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', background: 'white',
              border: `1.5px solid ${m.color}20`,
              borderRadius: 999, fontSize: 13, fontWeight: 600,
              color: m.color,
            }}>
              {m.emoji} {m.name}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 12 }}>
          Cliquez sur un plan ci-dessus → vous serez redirigé vers la page de paiement PayDunya sécurisée.
        </p>
      </div>

      {/* Section Stripe */}
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 20, padding: 24 }}>
        <h3 style={{ fontWeight: 700, color: '#0369a1', marginBottom: 8, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          💳 Paiement International via Stripe
        </h3>
        <p style={{ fontSize: 13, color: '#0284c7', marginBottom: 8 }}>
          Visa, Mastercard, Apple Pay — bientôt disponible pour les utilisateurs hors Afrique.
        </p>
        <span style={{ display: 'inline-block', padding: '4px 12px', background: '#e0f2fe', color: '#0369a1', fontSize: 12, fontWeight: 600, borderRadius: 999 }}>
          Prochainement
        </span>
      </div>
    </div>
  );
}

export default function AbonnementPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: '#6b7280' }}>Chargement…</div>}>
      <AbonnementContent />
    </Suspense>
  );
}
