'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

const ROLE_CONFIG: Record<string, {
  label: string; subtitle: string; emoji: string;
  headerBg: string; accentColor: string;
}> = {
  eleve:      { label: 'Élève',       subtitle: 'Espace Élève',       emoji: '🎓', headerBg: '#3b82f6', accentColor: '#3b82f6' },
  parent:     { label: 'Parent',      subtitle: 'Espace Parent',      emoji: '👨‍👩‍👧', headerBg: '#9333ea', accentColor: '#9333ea' },
  professeur: { label: 'Professeur',  subtitle: 'Espace Professeur',  emoji: '📚', headerBg: '#f97316', accentColor: '#f97316' },
  admin:      { label: 'Admin',       subtitle: 'Espace Admin',       emoji: '🏫', headerBg: '#166534', accentColor: '#166534' },
  superadmin: { label: 'Super Admin', subtitle: 'Espace Super Admin', emoji: '⚙️', headerBg: '#b91c1c', accentColor: '#b91c1c' },
};

const DEFAULT = ROLE_CONFIG['eleve'];

function LoginForm() {
  const searchParams = useSearchParams();
  const roleKey = searchParams.get('role') || 'eleve';
  const cfg = ROLE_CONFIG[roleKey] || DEFAULT;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/dashboard');
    } catch {
      setError('Email ou mot de passe incorrect');
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/dashboard');
    } catch {
      setError('Erreur avec Google');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8f9fa' }}>
      {/* Header coloré */}
      <div style={{ background: cfg.headerBg, color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 40, paddingBottom: 64, paddingLeft: 24, paddingRight: 24, position: 'relative' }}>
        <Link href="/" style={{ position: 'absolute', left: 16, top: 16, color: 'white', fontSize: 22, fontWeight: 700, textDecoration: 'none' }}>←</Link>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{cfg.emoji}</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{cfg.label}</h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>{cfg.subtitle}</p>
      </div>

      {/* Carte blanche */}
      <div style={{ flex: 1, marginTop: -32, background: 'white', borderRadius: '24px 24px 0 0', padding: '24px 24px 40px', maxWidth: 480, width: '100%', margin: '-32px auto 0', boxSizing: 'border-box' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 999, padding: 4, marginBottom: 24 }}>
          <button style={{ flex: 1, padding: '8px 0', borderRadius: 999, background: cfg.accentColor, color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
            Connexion
          </button>
          <Link href={`/register?role=${roleKey}`} style={{ flex: 1, padding: '8px 0', borderRadius: 999, color: '#6b7280', fontWeight: 600, fontSize: 14, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Inscription
          </Link>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Email</label>
            <div style={{ display: 'flex', alignItems: 'center', background: '#f3f4f6', borderRadius: 12, padding: '12px 16px', gap: 12 }}>
              <span style={{ color: '#9ca3af' }}>✉️</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="exemple@email.com" required
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#1f2937' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Mot de passe</label>
            <div style={{ display: 'flex', alignItems: 'center', background: '#f3f4f6', borderRadius: 12, padding: '12px 16px', gap: 12 }}>
              <span style={{ color: '#9ca3af' }}>🔒</span>
              <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#1f2937' }} />
              <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>
                {showPwd ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', margin: 0 }}>{error}</p>}

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '14px 0', borderRadius: 12, background: cfg.accentColor, color: 'white', fontWeight: 700, fontSize: 15, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, marginTop: 4 }}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: cfg.accentColor, marginTop: 16, cursor: 'pointer' }}>
          Mot de passe oublié ?
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          <span style={{ fontSize: 12, color: '#9ca3af' }}>ou continuer avec</span>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        </div>

        <button onClick={handleGoogle} disabled={loading}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '12px 0', borderRadius: 12, border: '2px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 16 }}>G</span>
          Continuer avec Google
        </button>

        <button disabled style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '12px 0', borderRadius: 12, background: '#1f2937', color: 'white', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'not-allowed', opacity: 0.5 }}>
          🍎 Continuer avec Apple
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 20 }}>
          En continuant, vous acceptez nos{' '}
          <span style={{ color: cfg.accentColor, fontWeight: 500, cursor: 'pointer' }}>conditions d&apos;utilisation</span>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p>Chargement…</p></div>}>
      <LoginForm />
    </Suspense>
  );
}
