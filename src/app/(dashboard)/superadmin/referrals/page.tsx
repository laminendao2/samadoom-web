'use client';
import { useState, useEffect } from 'react';
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
  status: string;
  createdAt: string;
}

interface Totals {
  totalCommissions: number;
  totalUsage: number;
  totalBalance: number;
  totalSavings: number;
  totalProfs: number;
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR');
}

function fmtDate(s: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
}

export default function SuperAdminReferralsPage() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'profs' | 'transactions'>('profs');

  useEffect(() => {
    if (!user) return;
    (async () => {
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
    })();
  }, [user]);

  if (loading) return <div style={{ padding: 32, color: '#6b7280', textAlign: 'center' }}>Chargement…</div>;
  if (error) return <div style={{ padding: 32, color: '#dc2626' }}>{error}</div>;

  return (
    <div style={{ padding: '32px 24px', maxWidth: 960, margin: '0 auto' }}>
      {/* En-tête */}
      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#111827', marginBottom: 4 }}>
        🤝 Parrainage — Vue SuperAdmin
      </h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 28 }}>
        Suivi des commissions professeurs et réductions acheteurs.
      </p>

      {/* Cartes totaux */}
      {totals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 32 }}>
          {[
            { label: 'Profs parrains', value: totals.totalProfs, icon: '🎓', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
            { label: 'Parrainages total', value: totals.totalUsage, icon: '🔗', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
            { label: 'Commissions dues', value: `${fmt(totals.totalBalance)} FCFA`, icon: '💰', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
            { label: 'Total versé profs', value: `${fmt(totals.totalCommissions)} FCFA`, icon: '📈', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
            { label: 'Économies clients', value: `${fmt(totals.totalSavings)} FCFA`, icon: '🎁', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
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
                  <tr key={c.code} style={{ borderBottom: i < codes.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ fontWeight: 700, color: '#111827', margin: 0 }}>{c.userName}</p>
                      <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{c.userEmail}</p>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
                        background: '#f0fdf4', color: '#166534',
                        padding: '3px 10px', borderRadius: 6,
                      }}>{c.code}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1d4ed8' }}>{c.usageCount}</td>
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
                  const original = Math.round(e.amountPaid / 0.9);
                  const saving = original - e.amountPaid;
                  return (
                    <tr key={e.id} style={{ borderBottom: i < earnings.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <td style={{ padding: '12px 14px', color: '#6b7280', fontSize: 12 }}>{fmtDate(e.createdAt)}</td>
                      <td style={{ padding: '12px 14px', color: '#374151' }}>{e.referredEmail}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 700, fontSize: 12,
                          background: '#f0fdf4', color: '#166534',
                          padding: '2px 8px', borderRadius: 5,
                        }}>{e.referrerCode}</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                          background: e.plan === 'annuel' ? '#eff6ff' : '#f5f3ff',
                          color: e.plan === 'annuel' ? '#1d4ed8' : '#7c3aed',
                        }}>
                          {e.plan === 'annuel' ? 'Annuel' : e.plan === 'semaine' ? 'Hebdo' : 'Mensuel'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#111827' }}>{fmt(e.amountPaid)} FCFA</td>
                      <td style={{ padding: '12px 14px', color: '#dc2626', fontWeight: 600 }}>-{fmt(saving)} FCFA</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontWeight: 700, color: '#166534',
                          background: '#f0fdf4', padding: '3px 10px', borderRadius: 6, fontSize: 12,
                        }}>+{fmt(e.commission)} FCFA</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
