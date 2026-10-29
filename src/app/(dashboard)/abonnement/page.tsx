'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const PLANS = [
  {
    id: 'mensuel',
    name: 'Mensuel',
    price: '3 000',
    priceEur: '4.99',
    currency: 'FCFA',
    period: '/mois',
    features: ['Accès à tout le Coran', 'Cours illimités', 'Suivi des progrès', 'Support prioritaire'],
    highlight: false,
    accentColor: '#166534',
  },
  {
    id: 'annuel',
    name: 'Annuel',
    price: '24 000',
    priceEur: '39.99',
    currency: 'FCFA',
    period: '/an',
    badge: 'Économise 33%',
    features: ['Tout du plan Mensuel', '2 mois offerts', 'Accès famille (2 enfants)', 'Contenu exclusif'],
    highlight: true,
    accentColor: '#166534',
  },
];

export default function AbonnementPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

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

      {error && (
        <div style={{ marginBottom: 16, padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#dc2626', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Plans */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 32 }}>
        {PLANS.map(plan => (
          <div key={plan.id} style={{
            position: 'relative',
            background: 'white',
            borderRadius: 20,
            padding: 24,
            border: plan.highlight ? '2px solid #166534' : '2px solid #e5e7eb',
            boxShadow: plan.highlight ? '0 8px 24px rgba(22,101,52,0.12)' : '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            {plan.badge && (
              <div style={{
                position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                background: '#166534', color: 'white', fontSize: 11, fontWeight: 700,
                padding: '4px 16px', borderRadius: 999,
              }}>
                {plan.badge}
              </div>
            )}
            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#111827', marginBottom: 12 }}>{plan.name}</h3>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#111827' }}>{plan.price}</span>
              <span style={{ color: '#6b7280', fontSize: 14 }}>{plan.currency}{plan.period}</span>
            </div>
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>≈ €{plan.priceEur}{plan.period}</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
        ))}
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
