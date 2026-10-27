'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/dashboard');
    } catch {
      setError('Email ou mot de passe incorrect.');
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
      router.replace('/dashboard');
    } catch {
      setError('Connexion Google échouée.');
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="text-6xl mb-3">📖</div>
        <h1 className="text-3xl font-black text-white">Sama Doom</h1>
        <p className="text-green-200 mt-1">Éducation islamique</p>
      </div>
      <div className="bg-white rounded-3xl p-8 shadow-2xl">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Connexion</h2>
        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-600 focus:outline-none text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-600 focus:outline-none text-gray-900" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-green-700 text-white font-bold rounded-xl hover:bg-green-800 transition-colors disabled:opacity-60">
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
        <div className="my-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-sm text-gray-400">ou</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <button onClick={handleGoogle}
          className="w-full py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
          <span>🌐</span> Continuer avec Google
        </button>
        <p className="mt-6 text-center text-sm text-gray-500">
          Pas encore de compte ?{' '}
          <a href="/register" className="text-green-700 font-semibold hover:underline">S&apos;inscrire</a>
        </p>
      </div>
    </div>
  );
}
