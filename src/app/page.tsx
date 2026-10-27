'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

const ROLES = [
  {
    key: 'eleve',
    label: 'Élève',
    subtitle: 'Notes, devoirs & emploi du temps',
    emoji: '🎓',
    color: 'bg-blue-500',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
  },
  {
    key: 'parent',
    label: 'Parent',
    subtitle: 'Suivez la scolarité de votre enfant',
    emoji: '👨‍👩‍👧',
    color: 'bg-purple-500',
    bgLight: 'bg-purple-50',
    textColor: 'text-purple-600',
    borderColor: 'border-purple-200',
  },
  {
    key: 'professeur',
    label: 'Professeur',
    subtitle: 'Gérez vos classes et évaluations',
    emoji: '📚',
    color: 'bg-orange-500',
    bgLight: 'bg-orange-50',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-200',
  },
  {
    key: 'admin',
    label: 'Admin',
    subtitle: "Administration de l'établissement",
    emoji: '🏫',
    color: 'bg-green-700',
    bgLight: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
  },
];

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">📖</div>
          <p className="text-gray-500">Chargement…</p>
        </div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8f9fa' }}>
      {/* Header vert */}
      <div className="bg-green-800 text-white flex flex-col items-center pt-12 pb-16 px-6">
        <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-lg overflow-hidden">
          <span className="text-5xl">📖</span>
        </div>
        <h1 className="text-3xl font-black tracking-widest">SAMA DOOM</h1>
        <p className="text-green-200 mt-1 text-sm">La réussite scolaire, ensemble</p>
      </div>

      {/* Contenu */}
      <div className="flex-1 -mt-8 bg-white rounded-t-3xl px-6 pt-8 pb-10">
        <h2 className="text-xl font-bold text-gray-800 text-center mb-6">Je suis…</h2>

        {/* Grille des rôles */}
        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
          {ROLES.map((role) => (
            <Link
              key={role.key}
              href={`/login?role=${role.key}`}
              className={`flex flex-col items-center p-5 rounded-2xl border-2 ${role.borderColor} ${role.bgLight} hover:scale-105 transition-transform active:scale-95 cursor-pointer`}
            >
              <div className={`w-14 h-14 rounded-2xl ${role.bgLight} flex items-center justify-center text-3xl mb-3 border ${role.borderColor}`}>
                {role.emoji}
              </div>
              <span className={`font-bold text-base ${role.textColor}`}>{role.label}</span>
              <span className="text-xs text-gray-500 text-center mt-1 leading-tight">{role.subtitle}</span>
            </Link>
          ))}
        </div>

        {/* Section Musulman */}
        <div className="mt-6 max-w-sm mx-auto">
          <div className="flex items-center gap-4 bg-green-900 text-white rounded-2xl px-5 py-4 cursor-pointer hover:bg-green-800 transition-colors">
            <div className="text-3xl">🕌</div>
            <div>
              <p className="font-bold text-base">Je suis Musulman(e)</p>
              <p className="text-green-300 text-xs">Prières · Coran · Qibla · Douas · Calendrier</p>
            </div>
            <span className="ml-auto text-green-300 text-xl">›</span>
          </div>
        </div>
      </div>
    </div>
  );
}
