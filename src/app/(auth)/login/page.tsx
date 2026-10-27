'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

const ROLE_CONFIG: Record<string, {
  label: string; subtitle: string; emoji: string;
  headerBg: string; buttonBg: string; buttonHover: string;
  tabActive: string; linkColor: string;
}> = {
  eleve: {
    label: 'Élève', subtitle: 'Espace Élève', emoji: '🎓',
    headerBg: 'bg-blue-500', buttonBg: 'bg-blue-500', buttonHover: 'hover:bg-blue-600',
    tabActive: 'bg-blue-500', linkColor: 'text-blue-500',
  },
  parent: {
    label: 'Parent', subtitle: 'Espace Parent', emoji: '👨‍👩‍👧',
    headerBg: 'bg-purple-600', buttonBg: 'bg-purple-600', buttonHover: 'hover:bg-purple-700',
    tabActive: 'bg-purple-600', linkColor: 'text-purple-600',
  },
  professeur: {
    label: 'Professeur', subtitle: 'Espace Professeur', emoji: '📚',
    headerBg: 'bg-orange-500', buttonBg: 'bg-orange-500', buttonHover: 'hover:bg-orange-600',
    tabActive: 'bg-orange-500', linkColor: 'text-orange-500',
  },
  admin: {
    label: 'Admin', subtitle: 'Espace Admin', emoji: '🏫',
    headerBg: 'bg-green-800', buttonBg: 'bg-green-800', buttonHover: 'hover:bg-green-900',
    tabActive: 'bg-green-800', linkColor: 'text-green-800',
  },
  superadmin: {
    label: 'Super Admin', subtitle: 'Espace Super Admin', emoji: '⚙️',
    headerBg: 'bg-red-700', buttonBg: 'bg-red-700', buttonHover: 'hover:bg-red-800',
    tabActive: 'bg-red-700', linkColor: 'text-red-700',
  },
};

const DEFAULT_CONFIG = ROLE_CONFIG['eleve'];

function LoginForm() {
  const searchParams = useSearchParams();
  const roleKey = searchParams.get('role') || 'eleve';
  const config = ROLE_CONFIG[roleKey] || DEFAULT_CONFIG;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/dashboard');
    } catch {
      setError('Erreur avec Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8f9fa' }}>
      {/* Header coloré */}
      <div className={`${config.headerBg} text-white flex flex-col items-center pt-10 pb-16 px-6 relative`}>
        <Link href="/" className="absolute left-4 top-4 text-white text-2xl font-bold hover:opacity-80">←</Link>
        <div className="text-5xl mb-3">{config.emoji}</div>
        <h1 className="text-2xl font-bold">{config.label}</h1>
        <p className="text-white/70 text-sm mt-1">{config.subtitle}</p>
      </div>

      {/* Carte blanche */}
      <div className="flex-1 -mt-8 bg-white rounded-t-3xl px-6 pt-6 pb-10 max-w-md mx-auto w-full">
        {/* Tabs Connexion / Inscription */}
        <div className="flex bg-gray-100 rounded-full p-1 mb-6">
          <button className={`flex-1 py-2 rounded-full text-sm font-semibold text-white ${config.tabActive} transition-all`}>
            Connexion
          </button>
          <Link href={`/register?role=${roleKey}`} className="flex-1 py-2 rounded-full text-sm font-semibold text-gray-500 text-center hover:text-gray-700 transition-all">
            Inscription
          </Link>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Email</label>
            <div className="flex items-center bg-gray-100 rounded-xl px-4 py-3 gap-3">
              <span className="text-gray-400">✉️</span>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="exemple@email.com" required
                className="flex-1 bg-transparent outline-none text-gray-800 text-sm placeholder-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Mot de passe</label>
            <div className="flex items-center bg-gray-100 rounded-xl px-4 py-3 gap-3">
              <span className="text-gray-400">🔒</span>
              <input
                type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                className="flex-1 bg-transparent outline-none text-gray-800 text-sm placeholder-gray-400"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-gray-400 hover:text-gray-600">
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit" disabled={loading}
            className={`w-full py-4 rounded-xl text-white font-bold text-base ${config.buttonBg} ${config.buttonHover} transition-all disabled:opacity-60 mt-1`}
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className={`text-center text-sm font-semibold ${config.linkColor} mt-4 cursor-pointer hover:opacity-80`}>
          Mot de passe oublié ?
        </p>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">ou continuer avec</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <button
          onClick={handleGoogle} disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-all mb-3"
        >
          <span className="text-red-500 font-bold text-lg">G</span>
          Continuer avec Google
        </button>

        <button
          disabled
          className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-black text-white font-semibold text-sm opacity-50 cursor-not-allowed"
        >
          🍎 Continuer avec Apple
        </button>

        <p className="text-center text-xs text-gray-400 mt-5">
          En continuant, vous acceptez nos{' '}
          <span className={`${config.linkColor} font-medium cursor-pointer`}>conditions d&apos;utilisation</span>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Chargement…</p></div>}>
      <LoginForm />
    </Suspense>
  );
}
