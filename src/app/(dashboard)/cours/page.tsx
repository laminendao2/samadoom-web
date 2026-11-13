'use client';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

const COURS = [
  { icon: '📖', title: 'Mémorisation du Coran', desc: 'Apprends et révise les sourates', href: '/coran', tag: 'Mobile' },
  { icon: '🕌', title: 'Tajwid', desc: 'Règles de récitation coranique', href: '#', tag: 'Bientôt' },
  { icon: '🤲', title: 'Douas', desc: 'Invocations et supplications', href: '#', tag: 'Bientôt' },
  { icon: '📿', title: 'Hadiths', desc: 'Paroles du Prophète ﷺ', href: '#', tag: 'Bientôt' },
  { icon: '🌙', title: 'Seerah', desc: 'La vie du Prophète Muhammad ﷺ', href: '#', tag: 'Bientôt' },
  { icon: '🕋', title: 'Fiqh', desc: 'Jurisprudence islamique de base', href: '#', tag: 'Bientôt' },
];

export default function CoursPage() {
  const { profile } = useAuth();
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Mes cours</h1>
        <p className="text-gray-500 text-sm mt-1">Tout le contenu islamique disponible</p>
      </div>
      {!profile?.isPro && (
        <div className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="font-bold">Passe à Pro ⭐</p>
            <p className="text-sm text-white/80">Accès illimité à tous les cours</p>
          </div>
          <Link href="/abonnement" className="bg-white text-orange-600 font-bold px-4 py-2 rounded-xl text-sm hover:bg-orange-50 transition-colors">
            Voir les plans
          </Link>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {COURS.map((c) => (
          <div key={c.title}
            className={`bg-white rounded-2xl p-5 border border-gray-100 shadow-sm ${c.href !== '#' ? 'hover:shadow-md cursor-pointer' : 'opacity-70'} transition-all`}>
            {c.href !== '#' ? (
              <Link href={c.href} className="flex items-start gap-4">
                <span className="text-3xl">{c.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">{c.title}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${c.tag === 'Mobile' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{c.tag}</span>
                  </div>
                  <p className="text-gray-500 text-sm mt-0.5">{c.desc}</p>
                </div>
              </Link>
            ) : (
              <div className="flex items-start gap-4">
                <span className="text-3xl">{c.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">{c.title}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-500">{c.tag}</span>
                  </div>
                  <p className="text-gray-500 text-sm mt-0.5">{c.desc}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
