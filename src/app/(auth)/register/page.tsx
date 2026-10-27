'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const ROLES = [
  { value: 'eleve', label: 'Élève', emoji: '📚' },
  { value: 'parent', label: 'Parent', emoji: '👶' },
  { value: 'professeur', label: 'Professeur', emoji: '🎓' },
];

export default function RegisterPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState('eleve');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signUp(email, password, name, role);
      router.replace('/dashboard');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('email-already-in-use')) {
        setError('Cet email est déjà utilisé.');
      } else {
        setError('Erreur lors de la création du compte.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="text-6xl mb-3">📖</div>
        <h1 className="text-3xl font-black text-white">Sama Doom</h1>
        <p className="text-green-200 mt-1">Créer un compte</p>
      </div>
      <div className="bg-white rounded-3xl p-8 shadow-2xl">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Inscription</h2>
        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nom complet</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-600 focus:outline-none text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-600 focus:outline-none text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-600 focus:outline-none text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Je suis…</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map(r => (
                <button key={r.value} type="button" onClick={() => setRole(r.value)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${role === r.value ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="text-2xl mb-1">{r.emoji}</div>
                  <div className="text-xs font-semibold text-gray-700">{r.label}</div>
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-green-700 text-white font-bold rounded-xl hover:bg-green-800 transition-colors disabled:opacity-60">
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">
          Déjà un compte ?{' '}
          <a href="/login" className="text-green-700 font-semibold hover:underline">Se connecter</a>
        </p>
      </div>
    </div>
  );
}
