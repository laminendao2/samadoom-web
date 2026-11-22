'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

interface ReferralCode {
  code: string;
  userId: string;
  userName: string;
  userEmail: string;
  balance: number;
  totalEarned: number;
  usageCount: number;
  createdAt: string;
}

interface Earning {
  id: string;
  referrerId: string;
  referrerCode: string;
  referredEmail: string;
  plan: string;
  amountPaid: number;
  commission: number;
  currency: string;
  provider: string;
  status: string;
  createdAt: string;
}

interface Totals {
  totalCommissions: number;
  totalUsage: number;
  totalBalance: number;
  totalSavings: number;
  totalDons: number;
  totalProfs: number;
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR');
}

/** Affiche un montant avec sa devise correcte.
 *  Les nouvelles commissions Stripe sont normalisées en XOF (amountPaid = XOF).
 *  Anciens records USD encore en centimes → afficher en $ pour repérage.
 */
function fmtAmount(amount: number, currency: string): string {
  const cur = (currency ?? 'XOF').toUpperCase();
  if (cur === 'USD') return `$${(amount / 100).toFixed(2)}`; // ancien format
  if (cur === 'EUR') return `€${(amount / 100).toFixed(2)}`; // ancien format centimes
  return `${fmt(amount)} FCFA`;
}

function fmtDate(s: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
}

interface MissingCommission {
  paymentId: string;
  referredEmail: string;
  referralCode: string;
  provider: string;
  amountXof: number;
  commission: number;
  paidAt: string;
  credited: boolean;
  skipped?: string;
}

interface MissingResult {
  applied: boolean;
  count: number;
  credited: number;
  totalCommission: number;
  missing: MissingCommission[];
}

export default function SuperAdminReferralsPage() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'profs' | 'transactions'>('profs');
  const [missingLoading, setMissingLoading] = useState(false);
  const [missingError, setMissingError] = useState('');
  const [missingResult, setMissingResult] = useState<MissingResult | null>(null);
  const [fixLoading, setFixLoading] = useState(false);
  const [fixResult, setFixResult] = useState<{ earningsFixed: number; codesUpdated: number } | null>(null);
  const [revertLoading, setRevertLoading] = useState(false);
  const [revertResult, setRevertResult] = useState<{ earningsReverted: number; codesRecalculated: number } | null>(null);

  // Paramètres commissions par niveau
  type LvlSettings = { enabled: boolean; requiresPro: boolean; rate: number };
  const [lvlSettings, setLvlSettings] = useState<LvlSettings[]>([
    { enabled: true, requiresPro: false, rate: 0.10 },
    { enabled: true, requiresPro: false, rate: 0.035 },
    { enabled: true, requiresPro: false, rate: 0.015 },
  ]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  async function loadSettings() {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/superadmin/referral-settings', { headers: { Authorization: `Bearer ${idToken}` } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.levels)) setLvlSettings(data.levels);
      }
    } catch { /* silencieux */ }
  }

  async function saveSettings() {
    if (!user) return;
    setSettingsLoading(true);
    setSettingsMsg('');
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/superadmin/referral-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ levels: lvlSettings }),
      });
      const data = await res.json();
      if (res.ok) setSettingsMsg('✅ Paramètres sauvegardés');
      else setSettingsMsg(`❌ ${data.error || 'Erreur'}`);
    } catch {
      setSettingsMsg('❌ Erreur réseau');
    } finally {
      setSettingsLoading(false);
      setTimeout(() => setSettingsMsg(''), 3000);
    }
  }

  // Don / bonus
  const [giftCode, setGiftCode] = useState<string | null>(null);
  const [giftAmount, setGiftAmount] = useState('');
  const [giftNote, setGiftNote] = useState('');
  const [giftLoading, setGiftLoading] = useState(false);
  const [giftMsg, setGiftMsg] = useState('');
  // Révocation de don
  const [revokeLoadingId, setRevokeLoadingId] = useState<string | null>(null);
  // Modal filleuls
  interface Filleul { uid: string; name: string; email: string; isPro: boolean; subscriptionEnd: string | null; createdAt: string | null; }
  const [filleulsModal, setFilleulsModal] = useState<string | null>(null); // code affiché
  const [filleulsList, setFilleulsList] = useState<Filleul[]>([]);
  const [filleulsLoading, setFilleulsLoading] = useState(false);

  async function loadFilleuls(code: string) {
    if (!user) return;
    setFilleulsModal(code);
    setFilleulsList([]);
    setFilleulsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/superadmin/referral-filleuls?code=${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      setFilleulsList(data.filleuls ?? []);
    } catch { setFilleulsList([]); }
    finally { setFilleulsLoading(false); }
  }

  async function loadData() {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/superadmin/referrals', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur'); return; }
      setCodes(data.codes);
      setEarnings(data.earnings);
      setTotals(data.totals);
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  }

  async function fixBalances() {
    if (!user) return;
    setFixLoading(true);
    setFixResult(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/fix-referral-balances', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      setFixResult({ earningsFixed: data.earningsFixed, codesUpdated: data.codesUpdated });
      await loadData(); // recharger les données corrigées
    } catch {
      setFixResult({ earningsFixed: -1, codesUpdated: -1 });
    } finally {
      setFixLoading(false);
    }
  }

  async function revertCorruption() {
    if (!user) return;
    if (!window.confirm('Corriger les commissions corrompues par le bouton Stripe→FCFA ?\n\nLes montants FCFA mal convertis (ex: 1500→7920) seront restaurés.\nCette action est sûre et réversible.')) return;
    setRevertLoading(true);
    setRevertResult(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/revert-earnings-corruption', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      setRevertResult({ earningsReverted: data.earningsReverted, codesRecalculated: data.codesRecalculated });
      await loadData();
    } catch {
      setRevertResult({ earningsReverted: -1, codesRecalculated: -1 });
    } finally {
      setRevertLoading(false);
    }
  }

  async function checkMissing(apply: boolean) {
    if (!user) return;
    setMissingLoading(true);
    setMissingError('');
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/fix-missing-commissions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply }),
      });
      const data = await res.json();
      if (!res.ok) { setMissingError(data.error || 'Erreur'); return; }
      setMissingResult(data as MissingResult);
      if (apply) await loadData();
    } catch {
      setMissingError('Erreur réseau');
    } finally {
      setMissingLoading(false);
    }
  }

  async function sendGift() {
    if (!user || !giftCode) return;
    const amt = parseInt(giftAmount, 10);
    if (!amt || amt <= 0) { setGiftMsg('❌ Montant invalide'); return; }
    setGiftLoading(true);
    setGiftMsg('');
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/gift-commission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ code: giftCode, amount: amt, note: giftNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setGiftMsg(`❌ ${data.error || 'Erreur'}`); return; }
      setGiftMsg(`✅ ${fmt(amt)} FCFA crédités à ${data.userName}`);
      setGiftAmount('');
      setGiftNote('');
      await loadData();
    } catch {
      setGiftMsg('❌ Erreur réseau');
    } finally {
      setGiftLoading(false);
    }
  }

  async function revokeGift(earningId: string, amount: number) {
    if (!user) return;
    if (!confirm(`Révoquer ce don de ${amount} FCFA ? Cette action est irréversible.`)) return;
    setRevokeLoadingId(earningId);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/revoke-gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ earningId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(`Erreur : ${data.error}`); return; }
      await loadData();
    } catch {
      alert('Erreur réseau');
    } finally {
      setRevokeLoadingId(null);
    }
  }

  useEffect(() => {
    loadData();
    loadSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading) return <div style={{ padding: 32, color: '#6b7280', textAlign: 'center' }}>Chargement…</div>;
  if (error) return <div style={{ padding: 32, color: '#dc2626' }}>{error}</div>;

  const LEVEL_LABELS = ['Niveau 1 — Parrain direct', 'Niveau 2 — Parrain du parrain', 'Niveau 3 — Arrière-parrain'];

  return (
    <div style={{ padding: '32px 24px', maxWidth: 960, margin: '0 auto' }}>

      {/* ⚙️ Paramètres commissions */}
      <div style={{ background: '#faf5ff', border: '1.5px solid #e9d5ff', borderRadius: 16, padding: '20px 24px', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#6b21a8', margin: 0 }}>⚙️ Paramètres des commissions</h2>
            <p style={{ fontSize: 13, color: '#7c3aed', margin: '4px 0 0' }}>
              Configurez les conditions d&apos;activation par niveau de parrainage
            </p>
          </div>
          <button
            onClick={() => setShowSettings(s => !s)}
            style={{ padding: '8px 16px', background: showSettings ? '#ede9fe' : '#7c3aed', color: showSettings ? '#5b21b6' : '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {showSettings ? '▲ Fermer' : '▼ Modifier'}
          </button>
        </div>

        {/* Résumé compact toujours visible */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          {lvlSettings.map((lvl, i) => (
            <div key={i} style={{
              flex: 1, minWidth: 160,
              background: lvl.enabled ? '#fff' : '#f3f4f6',
              border: `1.5px solid ${lvl.enabled ? '#c4b5fd' : '#e5e7eb'}`,
              borderRadius: 10, padding: '10px 14px',
              opacity: lvl.enabled ? 1 : 0.6,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', marginBottom: 4 }}>
                N{i + 1} · {(lvl.rate * 100).toFixed(1).replace('.0', '')}%
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                {!lvl.enabled ? '🔴 Désactivé' : lvl.requiresPro ? '🔒 Pro requis' : '✅ Tout le monde'}
              </div>
            </div>
          ))}
        </div>

        {/* Formulaire détaillé */}
        {showSettings && (
          <div style={{ marginTop: 20, borderTop: '1px solid #e9d5ff', paddingTop: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {lvlSettings.map((lvl, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid #ede9fe', borderRadius: 12, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>
                        {LEVEL_LABELS[i]}
                      </span>
                      <span style={{ marginLeft: 8, fontSize: 13, color: '#7c3aed', fontWeight: 600 }}>
                        {(lvl.rate * 100).toFixed(1).replace('.0', '')}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Toggle Activé */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                        <input
                          type="checkbox"
                          checked={lvl.enabled}
                          onChange={e => setLvlSettings(prev => prev.map((l, j) => j === i ? { ...l, enabled: e.target.checked } : l))}
                          style={{ width: 16, height: 16, accentColor: '#7c3aed' }}
                        />
                        Niveau actif
                      </label>
                      {/* Toggle Pro requis */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: lvl.enabled ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600, color: lvl.enabled ? '#374151' : '#9ca3af' }}>
                        <input
                          type="checkbox"
                          checked={lvl.requiresPro}
                          disabled={!lvl.enabled}
                          onChange={e => setLvlSettings(prev => prev.map((l, j) => j === i ? { ...l, requiresPro: e.target.checked } : l))}
                          style={{ width: 16, height: 16, accentColor: '#7c3aed' }}
                        />
                        Parrain doit être Pro
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <button
                onClick={saveSettings}
                disabled={settingsLoading}
                style={{ padding: '10px 24px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: settingsLoading ? 'not-allowed' : 'pointer', opacity: settingsLoading ? 0.6 : 1 }}>
                {settingsLoading ? 'Enregistrement…' : '💾 Sauvegarder'}
              </button>
              {settingsMsg && <span style={{ fontSize: 13, color: settingsMsg.startsWith('✅') ? '#166534' : '#dc2626', fontWeight: 600 }}>{settingsMsg}</span>}
            </div>
          </div>
        )}
      </div>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#111827', marginBottom: 4 }}>
            🤝 Parrainage — Vue SuperAdmin
          </h1>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
            Suivi des commissions professeurs et réductions acheteurs.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {revertResult && (
            <span style={{ fontSize: 12, color: '#374151', background: revertResult.earningsReverted === -1 ? '#fef2f2' : '#f0fdf4', border: `1px solid ${revertResult.earningsReverted === -1 ? '#fecaca' : '#bbf7d0'}`, padding: '6px 12px', borderRadius: 8 }}>
              {revertResult.earningsReverted === -1
                ? '❌ Erreur lors de la correction'
                : `✅ ${revertResult.earningsReverted} gains restaurés · ${revertResult.codesRecalculated} balances recalculées`}
            </span>
          )}
          {fixResult && (
            <span style={{ fontSize: 12, color: '#374151', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '6px 12px', borderRadius: 8 }}>
              {fixResult.earningsFixed === -1
                ? '⚠️ Erreur lors de la correction'
                : `✅ ${fixResult.earningsFixed} gains corrigés · ${fixResult.codesUpdated} balances recalculées`}
            </span>
          )}
          <button
            onClick={revertCorruption}
            disabled={revertLoading}
            style={{
              fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 10,
              background: revertLoading ? '#e5e7eb' : '#dc2626', color: revertLoading ? '#9ca3af' : 'white',
              border: 'none', cursor: revertLoading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
            }}
          >
            {revertLoading ? '⏳ Correction…' : '🚨 Corriger corruption FCFA'}
          </button>
          <button
            onClick={fixBalances}
            disabled={fixLoading}
            style={{
              fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 10,
              background: fixLoading ? '#e5e7eb' : '#7c3aed', color: fixLoading ? '#9ca3af' : 'white',
              border: 'none', cursor: fixLoading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
            }}
          >
            {fixLoading ? '⏳ Recalcul…' : '🔧 Recalculer balances Stripe→FCFA'}
          </button>
          <button
            onClick={() => checkMissing(false)}
            disabled={missingLoading}
            style={{
              fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 10,
              background: missingLoading ? '#e5e7eb' : '#b45309', color: missingLoading ? '#9ca3af' : 'white',
              border: 'none', cursor: missingLoading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
            }}
          >
            {missingLoading ? '⏳ Vérification…' : '🔎 Commissions manquantes'}
          </button>
        </div>
      </div>

      {/* Commissions manquantes : réduction accordée à l'acheteur, gain jamais créé */}
      {missingError && (
        <div style={{ marginBottom: 20, padding: 14, borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 14 }}>
          Vérification impossible : {missingError}
        </div>
      )}
      {missingResult && (
        <div style={{ marginBottom: 28, padding: 18, borderRadius: 14, background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: missingResult.count ? 12 : 0 }}>
            <div style={{ fontWeight: 800, color: '#92400e', fontSize: 15 }}>
              {missingResult.count === 0
                ? '✅ Aucune commission manquante.'
                : missingResult.applied
                  ? `✅ ${missingResult.credited} commission(s) créditée(s) sur ${missingResult.count}`
                  : `${missingResult.count} commission(s) manquante(s) — ${fmt(missingResult.totalCommission)} FCFA`}
            </div>
            {missingResult.count > 0 && !missingResult.applied && (
              <button
                onClick={() => checkMissing(true)}
                disabled={missingLoading}
                style={{
                  fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 10,
                  background: missingLoading ? '#e5e7eb' : '#16a34a', color: missingLoading ? '#9ca3af' : 'white',
                  border: 'none', cursor: missingLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {missingLoading ? '⏳ Crédit en cours…' : `Créditer ${fmt(missingResult.totalCommission)} FCFA aux parrains`}
              </button>
            )}
          </div>
          {missingResult.missing.map(m => (
            <div key={m.paymentId} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid #fde68a', fontSize: 13, color: '#78350f' }}>
              <span>
                <strong>{m.referredEmail || 'Acheteur inconnu'}</strong> · code {m.referralCode} · {m.provider} · payé {fmt(m.amountXof)} FCFA le {fmtDate(m.paidAt)}
              </span>
              <span style={{ fontWeight: 700 }}>
                {m.skipped ? `Non créditée : ${m.skipped}` : `${m.credited ? 'Créditée' : 'À créditer'} : ${fmt(m.commission)} FCFA`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Cartes totaux */}
      {totals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 32 }}>
          {[
            { label: 'Profs parrains', value: totals.totalProfs, icon: '🎓', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
            { label: 'Parrainages total', value: totals.totalUsage, icon: '🔗', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
            { label: 'Commissions dues', value: `${fmt(totals.totalBalance)} FCFA`, icon: '💰', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
            { label: 'Total versé profs', value: `${fmt(totals.totalCommissions)} FCFA`, icon: '📈', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
            { label: 'Économies clients', value: `${fmt(totals.totalSavings)} FCFA`, icon: '🎁', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
            { label: 'Dons SuperAdmin', value: `${fmt(totals.totalDons)} FCFA`, icon: '🤲', color: '#be185d', bg: '#fdf2f8', border: '#fbcfe8' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: stat.bg,
              border: `1px solid ${stat.border}`,
              borderRadius: 16,
              padding: '16px 14px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{stat.icon}</div>
              <p style={{ fontSize: 18, fontWeight: 900, color: stat.color, margin: '0 0 2px' }}>{stat.value}</p>
              <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['profs', '🎓 Par professeur'], ['transactions', '📋 Transactions']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 20px',
            borderRadius: 10,
            border: 'none',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            background: tab === key ? '#166534' : '#f3f4f6',
            color: tab === key ? 'white' : '#374151',
          }}>{label}</button>
        ))}
      </div>

      {/* Tableau profs */}
      {tab === 'profs' && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {codes.length === 0 ? (
            <p style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Aucun code de parrainage créé pour l'instant.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Professeur', 'Code', 'Filleuls', 'Total gagné', 'Solde dû', 'Depuis'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {codes.map((c, i) => (
                  <React.Fragment key={c.code}>
                  <tr style={{ borderBottom: i < codes.length - 1 && giftCode !== c.code ? '1px solid #f3f4f6' : 'none' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div>
                          <p style={{ fontWeight: 700, color: '#111827', margin: 0 }}>{c.userName}</p>
                          <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{c.userEmail}</p>
                        </div>
                        <button
                          onClick={() => { setGiftCode(giftCode === c.code ? null : c.code); setGiftMsg(''); setGiftAmount(''); setGiftNote(''); }}
                          style={{
                            background: giftCode === c.code ? '#fef3c7' : '#f9fafb',
                            border: `1px solid ${giftCode === c.code ? '#f59e0b' : '#e5e7eb'}`,
                            borderRadius: 8, padding: '3px 8px', cursor: 'pointer',
                            fontSize: 12, fontWeight: 600, color: '#92400e', whiteSpace: 'nowrap',
                          }}
                        >🎁</button>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
                        background: '#f0fdf4', color: '#166534',
                        padding: '3px 10px', borderRadius: 6,
                      }}>{c.code}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1d4ed8' }}>
                      <button
                        onClick={() => loadFilleuls(c.code)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#1d4ed8', fontSize: 13, padding: 0, textDecoration: 'underline dotted' }}
                        title="Voir la liste des filleuls"
                      >{c.usageCount} 👁</button>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#166534' }}>{fmt(c.totalEarned)} FCFA</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontWeight: 700,
                        color: c.balance > 0 ? '#b45309' : '#6b7280',
                        background: c.balance > 0 ? '#fffbeb' : '#f9fafb',
                        padding: '3px 10px', borderRadius: 6, fontSize: 12,
                      }}>
                        {fmt(c.balance)} FCFA
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 12 }}>{fmtDate(c.createdAt)}</td>
                  </tr>
                  {/* Panel don inline */}
                  {giftCode === c.code && (
                    <tr style={{ background: '#fffbeb' }}>
                      <td colSpan={6} style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: '#92400e', fontSize: 13 }}>
                            🎁 Don à {c.userName}
                          </span>
                          <input
                            type="number"
                            placeholder="Montant FCFA"
                            value={giftAmount}
                            onChange={e => setGiftAmount(e.target.value)}
                            style={{
                              border: '1px solid #f59e0b', borderRadius: 8,
                              padding: '6px 12px', fontSize: 13, width: 150,
                              outline: 'none',
                            }}
                          />
                          <input
                            type="text"
                            placeholder="Note (optionnel)"
                            value={giftNote}
                            onChange={e => setGiftNote(e.target.value)}
                            style={{
                              border: '1px solid #e5e7eb', borderRadius: 8,
                              padding: '6px 12px', fontSize: 13, width: 200,
                              outline: 'none',
                            }}
                          />
                          <button
                            onClick={sendGift}
                            disabled={giftLoading || !giftAmount}
                            style={{
                              background: giftLoading ? '#d1d5db' : '#f59e0b',
                              color: 'white', border: 'none', borderRadius: 8,
                              padding: '6px 16px', fontWeight: 700, fontSize: 13,
                              cursor: giftLoading ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {giftLoading ? '⏳…' : '✅ Créditer'}
                          </button>
                          <button
                            onClick={() => { setGiftCode(null); setGiftMsg(''); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18 }}
                          >✕</button>
                          {giftMsg && <span style={{ fontSize: 13, fontWeight: 600, color: giftMsg.startsWith('✅') ? '#166534' : '#dc2626' }}>{giftMsg}</span>}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tableau transactions */}
      {tab === 'transactions' && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {earnings.length === 0 ? (
            <p style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Aucune transaction de parrainage pour l'instant.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Date', 'Acheteur', 'Code parrain', 'Plan', 'Payé', 'Économie', 'Commission prof'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {earnings.map((e, i) => {
                  const isGift = (e as any).type === 'gift';
                  const cur = (e.currency ?? 'XOF').toUpperCase();
                  const isLegacyCents = cur === 'USD' || cur === 'EUR';
                  const original = e.amountPaid != null ? Math.round(e.amountPaid / 0.95) : 0;
                  const saving = e.amountPaid != null ? original - e.amountPaid : 0;
                  return (
                    <tr key={e.id} style={{ borderBottom: i < earnings.length - 1 ? '1px solid #f3f4f6' : 'none', background: isGift ? '#fdf2f8' : undefined }}>
                      <td style={{ padding: '12px 14px', color: '#6b7280', fontSize: 12 }}>{fmtDate(e.createdAt)}</td>
                      <td style={{ padding: '12px 14px', color: '#374151' }}>
                        {isGift ? (
                          <span style={{ color: '#be185d', fontSize: 11, fontWeight: 600 }}>
                            🤲 Don SuperAdmin{(e as any).note ? ` — ${(e as any).note}` : ''}
                          </span>
                        ) : e.referredEmail}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 700, fontSize: 12,
                          background: '#f0fdf4', color: '#166534',
                          padding: '2px 8px', borderRadius: 5,
                        }}>{e.referrerCode}</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {isGift ? (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: '#fdf2f8', color: '#be185d' }}>Don</span>
                        ) : (
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                            background: e.plan === 'annuel' ? '#eff6ff' : '#f5f3ff',
                            color: e.plan === 'annuel' ? '#1d4ed8' : '#7c3aed',
                          }}>
                            {e.plan === 'annuel' ? 'Annuel' : e.plan === 'semaine' ? 'Hebdo' : 'Mensuel'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#111827' }}>
                        {isGift ? '—' : (<>{fmtAmount(e.amountPaid, e.currency)}{isLegacyCents && <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>{cur}</span>}</>)}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#dc2626', fontWeight: 600 }}>
                        {isGift ? '—' : `-${fmtAmount(saving, e.currency)}`}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontWeight: 700, color: isGift ? '#be185d' : '#166534',
                            background: isGift ? '#fdf2f8' : '#f0fdf4', padding: '3px 10px', borderRadius: 6, fontSize: 12,
                          }}>+{fmtAmount(e.commission, e.currency)}</span>
                          {isGift && (
                            <button
                              onClick={() => revokeGift(e.id, e.commission ?? 0)}
                              disabled={revokeLoadingId === e.id}
                              title="Révoquer ce don"
                              style={{
                                background: 'none', border: '1px solid #fca5a5', borderRadius: 6,
                                color: '#dc2626', fontSize: 11, padding: '2px 8px', cursor: 'pointer',
                                opacity: revokeLoadingId === e.id ? 0.5 : 1,
                              }}
                            >
                              {revokeLoadingId === e.id ? '…' : '✕ Révoquer'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
      {/* Modal filleuls */}
      {filleulsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setFilleulsModal(null)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, minWidth: 400, maxWidth: 560, width: '90%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: 0 }}>
                👥 Filleuls de <span style={{ color: '#7c3aed' }}>{filleulsModal}</span>
              </h2>
              <button onClick={() => setFilleulsModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>
            {filleulsLoading ? (
              <p style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>Chargement…</p>
            ) : filleulsList.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>Aucun filleul trouvé pour ce code.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 12 }}>Nom</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 12 }}>Email</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 12 }}>Statut</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 12 }}>Inscrit le</th>
                  </tr>
                </thead>
                <tbody>
                  {filleulsList.map((f, i) => (
                    <tr key={f.uid} style={{ borderBottom: i < filleulsList.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827' }}>{f.name}</td>
                      <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12 }}>{f.email}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {f.isPro || (f.subscriptionEnd && new Date(f.subscriptionEnd) > new Date())
                          ? <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11 }}>✅ Pro</span>
                          : <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>Gratuit</span>}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#9ca3af', fontSize: 12 }}>
                        {f.createdAt ? new Date(f.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p style={{ marginTop: 16, fontSize: 12, color: '#9ca3af', textAlign: 'right' }}>
              {filleulsList.length} filleul{filleulsList.length > 1 ? 's' : ''} enregistré{filleulsList.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
