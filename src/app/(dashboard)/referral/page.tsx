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
  const [copiedLink, setCopiedLink] = useState(false);
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
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // fallback
    }
  };

  const shareWhatsApp = () => {
    if (!referral?.referralUrl || !referral?.code) return;
    const message = `🎓 Rejoins Sama Doom — l'app d'éducation islamique !\n\nUtilise mon code *${referral.code}* pour obtenir *-10%* sur ton abonnement 🎁\n\n👉 ${referral.referralUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
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
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
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
                {copiedLink ? '✓' : 'Copier lien'}
              </button>
            </div>

            {/* Bouton WhatsApp */}
            <button
              onClick={shareWhatsApp}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '12px 0',
                background: '#25D366',
                color: 'white',
                border: 'none',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
              }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Partager sur WhatsApp
            </button>
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
