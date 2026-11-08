'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

interface ReferralData {
  code: string | null;
  balance: number;
  totalEarned: number;
  usageCount: number;
  referralUrl: string;
}

export default function ReferralPage() {
  const { user, profile } = useAuth();
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const fetchReferral = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/referral/generate?userId=${user.uid}`);
      const data = await res.json();
      setReferral(data.code ? data : null);
    } catch {
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReferral();
  }, [fetchReferral]);

  const generateCode = async () => {
    if (!user || !profile) return;
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/referral/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          userName: profile.name || user.email || 'Utilisateur',
          userEmail: user.email,
        }),
      });
      const data = await res.json();
      if (data.code) {
        setReferral(data);
      } else {
        setError(data.error || 'Erreur lors de la génération');
      }
    } catch {
      setError('Erreur réseau. Réessayez.');
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = async () => {
    if (!referral?.referralUrl) return;
    try {
      await navigator.clipboard.writeText(referral.referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const copyCode = async () => {
    if (!referral?.code) return;
    try {
      await navigator.clipboard.writeText(referral.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
        Chargement…
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: 680, margin: '0 auto' }}>
      {/* En-tête */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111827', marginBottom: 8 }}>
          🤝 Programme de parrainage
        </h1>
        <p style={{ color: '#6b7280', fontSize: 15 }}>
          Partagez votre code — vos filleuls payent <strong style={{ color: '#166534' }}>-10%</strong>,
          vous recevez <strong style={{ color: '#166534' }}>20% de commission</strong> à chaque paiement.
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#dc2626', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Pas encore de code */}
      {!referral?.code && (
        <div style={{
          background: 'white',
          borderRadius: 20,
          padding: 32,
          border: '2px dashed #d1d5db',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎁</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
            Générez votre code de parrainage
          </h2>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
            Un code personnalisé avec votre prénom, facile à partager.
          </p>
          <button
            onClick={generateCode}
            disabled={generating}
            style={{
              padding: '14px 32px',
              background: '#166534',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 15,
              cursor: generating ? 'not-allowed' : 'pointer',
              opacity: generating ? 0.7 : 1,
            }}>
            {generating ? 'Génération…' : 'Générer mon code'}
          </button>
        </div>
      )}

      {/* Code actif */}
      {referral?.code && (
        <>
          {/* Carte code */}
          <div style={{
            background: 'linear-gradient(135deg, #166534 0%, #15803d 100%)',
            borderRadius: 20,
            padding: 28,
            marginBottom: 20,
            color: 'white',
          }}>
            <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>Votre code de parrainage</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <span style={{
                fontSize: 36,
                fontWeight: 900,
                letterSpacing: 4,
                background: 'rgba(255,255,255,0.15)',
                padding: '8px 20px',
                borderRadius: 12,
                fontFamily: 'monospace',
              }}>
                {referral.code}
              </span>
              <button
                onClick={copyCode}
                style={{
                  padding: '8px 18px',
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}>
                {copied ? '✓ Copié' : 'Copier'}
              </button>
            </div>

            <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Lien de parrainage</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 12,
                background: 'rgba(0,0,0,0.2)',
                padding: '6px 12px',
                borderRadius: 8,
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                flex: 1,
                minWidth: 0,
              }}>
                {referral.referralUrl}
              </span>
              <button
                onClick={copyLink}
                style={{
                  padding: '6px 16px',
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}>
                {copied ? '✓' : 'Copier lien'}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Solde disponible', value: `${referral.balance?.toLocaleString('fr-FR') ?? 0} FCFA`, color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
              { label: 'Total gagné', value: `${referral.totalEarned?.toLocaleString('fr-FR') ?? 0} FCFA`, color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
              { label: 'Filleuls', value: referral.usageCount ?? 0, color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
            ].map(stat => (
              <div key={stat.label} style={{
                background: stat.bg,
                border: `1px solid ${stat.border}`,
                borderRadius: 16,
                padding: '18px 16px',
                textAlign: 'center',
              }}>
                <p style={{ fontSize: 20, fontWeight: 900, color: stat.color, margin: '0 0 4px' }}>
                  {stat.value}
                </p>
                <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Comment ça marche */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 20, padding: 24 }}>
            <h3 style={{ fontWeight: 800, color: '#92400e', marginBottom: 16, fontSize: 15 }}>
              💡 Comment ça marche
            </h3>
            {[
              { step: '1', text: 'Partagez votre code ou lien à vos élèves, parents ou amis' },
              { step: '2', text: 'Ils arrivent sur la page abonnement avec -10% appliqué automatiquement' },
              { step: '3', text: 'Dès qu\'ils paient, vous recevez 20% du montant payé sur votre solde' },
              { step: '4', text: 'La commission s\'accumule à chaque renouvellement' },
            ].map(item => (
              <div key={item.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: '#166534', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {item.step}
                </span>
                <p style={{ fontSize: 13, color: '#78350f', margin: 0, lineHeight: 1.5 }}>{item.text}</p>
              </div>
            ))}
          </div>

          {/* Retrait (phase 2) */}
          {referral.balance > 0 && (
            <div style={{ marginTop: 20, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 8px' }}>
                💰 Vous avez <strong style={{ color: '#166534' }}>{referral.balance.toLocaleString('fr-FR')} FCFA</strong> disponibles
              </p>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
                Le retrait vers Orange Money / Wave sera disponible prochainement.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
