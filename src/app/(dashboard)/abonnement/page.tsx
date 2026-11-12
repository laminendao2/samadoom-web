'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getAuth } from 'firebase/auth';

const BASE_PLANS = [
  {
    id: 'mensuel',
    name: 'Mensuel',
    price: 3000,
    stripePriceUsd: 500, // centimes USD ($5)
    currency: 'FCFA',
    period: '/mois',
    features: ['Accès à tout le Coran', 'Cours illimités', 'Suivi des progrès', 'Support prioritaire'],
    highlight: false,
  },
  {
    id: 'annuel',
    name: 'Annuel',
    price: 24000,
    stripePriceUsd: 3900, // centimes USD ($39)
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
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [showRenew, setShowRenew] = useState(false);

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

  const handleCancelSubscription = async () => {
    if (!user) return;
    setCancelLoading(true);
    setError('');
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setCancelSuccess(true);
        setCancelConfirm(false);
      } else {
        setError(data.error || 'Erreur lors de l\'annulation');
      }
    } catch {
      setError('Erreur réseau. Réessayez.');
    } finally {
      setCancelLoading(false);
    }
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

  const handleStripe = async (planId: string) => {
    if (!user) return;
    setError('');
    setLoading(`stripe-${planId}`);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
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
        setError(data.error || 'Erreur Stripe. Réessayez.');
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

      {cancelSuccess && (
        <div style={{ marginBottom: 24, padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16 }}>
          <p style={{ fontWeight: 700, color: '#dc2626', margin: 0 }}>✅ Abonnement annulé</p>
          <p style={{ fontSize: 13, color: '#b91c1c', margin: '4px 0 0' }}>Votre accès Pro a été révoqué. Rechargez la page pour voir les changements.</p>
        </div>
      )}

      {profile?.isPro && !cancelSuccess && (
        <div style={{ marginBottom: 32, padding: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 28 }}>⭐</span>
            <div>
              <p style={{ fontWeight: 700, color: '#166534', margin: 0 }}>Vous avez le Plan Pro !</p>
              <p style={{ fontSize: 13, color: '#15803d', margin: '2px 0 0' }}>
                Plan : <strong>{profile.plan === 'mensuel' ? 'Mensuel' : profile.plan === 'annuel' ? 'Annuel' : profile.plan}</strong>
                {profile.planExpiresAt && (
                  <> · Expire le <strong>{new Date(profile.planExpiresAt).toLocaleDateString('fr-FR')}</strong></>
                )}
              </p>
            </div>
          </div>

          {/* Bouton annulation */}
          {!showRenew && (
            <button
              onClick={() => setShowRenew(true)}
              style={{
                padding: '8px 16px',
                background: '#166534',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                marginRight: 10,
              }}>
              🔄 Prolonger mon abonnement
            </button>
          )}
          {!cancelConfirm ? (
            <button
              onClick={() => setCancelConfirm(true)}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                color: '#dc2626',
                border: '1.5px solid #fca5a5',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}>
              Annuler mon abonnement
            </button>
          ) : (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 14 }}>
              <p style={{ fontSize: 14, color: '#7f1d1d', fontWeight: 600, margin: '0 0 12px' }}>
                ⚠️ Êtes-vous sûr ? Votre accès Pro sera immédiatement révoqué.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleCancelSubscription}
                  disabled={cancelLoading}
                  style={{
                    padding: '8px 18px',
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: cancelLoading ? 'not-allowed' : 'pointer',
                    opacity: cancelLoading ? 0.7 : 1,
                  }}>
                  {cancelLoading ? 'Annulation…' : 'Oui, annuler'}
                </button>
                <button
                  onClick={() => setCancelConfirm(false)}
                  disabled={cancelLoading}
                  style={{
                    padding: '8px 18px',
                    background: 'white',
                    color: '#374151',
                    border: '1.5px solid #d1d5db',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                  Garder mon abonnement
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {(!profile?.isPro || showRenew) && (
      <div style={{ marginBottom: 0 }}>
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
              border: `1.5px solid ${referralInfo?.valid ? '#16a34a' : referralError ? '#f59e0b' : '#d1d5db'}`,
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
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚠️</span>
            <p style={{ fontSize: 13, color: '#b45309', margin: 0 }}>
              {referralError} — vous pouvez continuer sans réduction.
            </p>
          </div>
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


              {/* Bouton Mobile Money */}
              <button
                disabled={loading === plan.id}
                onClick={() => handlePaydunya(plan.id)}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  borderRadius: 12,
                  background: '#166534',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 14,
                  border: 'none',
                  cursor: loading === plan.id ? 'not-allowed' : 'pointer',
                  opacity: loading === plan.id ? 0.7 : 1,
                  marginBottom: 8,
                }}>
                {loading === plan.id ? 'Redirection…' : '🌍 Mobile Money (Orange, Wave…)'}
              </button>

              {/* Bouton Stripe */}
              <button
                  disabled={loading === `stripe-${plan.id}`}
                  onClick={() => handleStripe(plan.id)}
                  style={{
                    width: '100%',
                    padding: '12px 0',
                    borderRadius: 12,
                    background: '#1a1a2e',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: 14,
                    border: 'none',
                    cursor: loading === `stripe-${plan.id}` ? 'not-allowed' : 'pointer',
                    opacity: loading === `stripe-${plan.id}` ? 0.7 : 1,
                  }}>
                  {loading === `stripe-${plan.id}` ? 'Redirection…' : '💳 Carte bancaire internationale'}
                </button>
            </div>
          );
        })}
      </div>
      </div>
      )}

      {/* Section PayDunya */}
      <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 20, padding: 24, marginBottom: 16 }}>
        <h3 style={{ fontWeight: 700, color: '#9a3412', marginBottom: 8, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          🌍 Mobile Money — Afrique de l&apos;Ouest (PayDunya)
        </h3>
        <p style={{ fontSize: 13, color: '#c2410c', marginBottom: 16 }}>
          Payez directement avec votre mobile money en FCFA — sans carte bancaire.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {[
            { name: 'Orange Money', emoji: '🟠', color: '#ff6600' },
            { name: 'Wave', emoji: '🔵', color: '#0052ff' },
            { name: 'Free Money', emoji: '🟢', color: '#00a651' },
            { name: 'Expresso', emoji: '🔴', color: '#e30613' },
          ].map(m => (
            <div key={m.name} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', background: 'white',
              border: `1.5px solid ${m.color}30`,
              borderRadius: 999, fontSize: 13, fontWeight: 600,
              color: m.color,
            }}>
              {m.emoji} {m.name}
            </div>
          ))}
        </div>
      </div>

      {/* Section Stripe */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24, marginBottom: 16 }}>
        <h3 style={{ fontWeight: 700, color: '#1e293b', marginBottom: 8, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          💳 Carte bancaire internationale (Stripe)
        </h3>
        <p style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
          Visa, Mastercard, Apple Pay, Google Pay — pour les utilisateurs hors Afrique. Paiement en USD.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {[
            { name: 'Visa', emoji: '💙' },
            { name: 'Mastercard', emoji: '🔴' },
            { name: 'Apple Pay', emoji: '🍎' },
            { name: 'Google Pay', emoji: '🌐' },
          ].map(m => (
            <div key={m.name} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', background: 'white',
              border: '1.5px solid #e2e8f0',
              borderRadius: 999, fontSize: 13, fontWeight: 600,
              color: '#374151',
            }}>
              {m.emoji} {m.name}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 12 }}>
          Mensuel : $5/mois · Annuel : $39/an — paiement 100% sécurisé via Stripe.
        </p>
      </div>

      {/* Contact & aide */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: 20 }}>
        <p style={{ fontWeight: 700, color: '#166534', marginBottom: 12, fontSize: 14 }}>
          🙋 Une question sur l&apos;abonnement ?
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <a
            href="https://wa.me/221776503767"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px',
              background: '#25D366', color: 'white',
              borderRadius: 12, fontWeight: 700, fontSize: 13,
              textDecoration: 'none',
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp : +221 77 650 37 67
          </a>
          <a
            href="mailto:info@freejobla.com"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px',
              background: 'white', color: '#166534',
              border: '1.5px solid #bbf7d0',
              borderRadius: 12, fontWeight: 700, fontSize: 13,
              textDecoration: 'none',
            }}>
            ✉️ info@freejobla.com
          </a>
        </div>
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
