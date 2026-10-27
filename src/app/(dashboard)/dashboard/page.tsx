'use client';
import { useAuth } from '@/context/AuthContext';

const GREETINGS: Record<string, string> = {
  eleve:      'Bismillah ! Prêt à apprendre ?',
  parent:     'Bienvenue, suivez les progrès de vos enfants.',
  professeur: 'Bienvenue professeur, vos élèves vous attendent.',
  admin:      'Tableau de bord administrateur.',
  superadmin: 'Tableau de bord Super Admin.',
};

const CARDS_BY_ROLE: Record<string, { icon: string; title: string; desc: string; href: string }[]> = {
  eleve: [
    { icon: '📖', title: 'Coran',       desc: 'Continuer ma lecture',      href: '/coran' },
    { icon: '📚', title: 'Mes cours',   desc: 'Voir mes leçons du jour',   href: '/cours' },
    { icon: '📊', title: 'Progrès',     desc: 'Voir mes statistiques',     href: '/progres' },
    { icon: '⭐', title: 'Abonnement',  desc: 'Gérer mon plan',            href: '/abonnement' },
  ],
  parent: [
    { icon: '👶', title: 'Mes enfants', desc: 'Suivre leurs progrès',      href: '/enfants' },
    { icon: '⭐', title: 'Abonnement',  desc: 'Gérer mon plan',            href: '/abonnement' },
    { icon: '👤', title: 'Profil',      desc: 'Modifier mes informations', href: '/profile' },
  ],
  professeur: [
    { icon: '🎓', title: 'Mes élèves',  desc: 'Gérer mes élèves',          href: '/eleves' },
    { icon: '📚', title: 'Cours',       desc: 'Gérer mes cours',           href: '/cours' },
    { icon: '👤', title: 'Profil',      desc: 'Modifier mes informations', href: '/profile' },
  ],
  admin: [
    { icon: '👥', title: 'Utilisateurs',desc: 'Gérer les comptes',         href: '/admin/users' },
    { icon: '🏫', title: 'Mon école',   desc: 'Paramètres école',          href: '/admin/ecole' },
  ],
  superadmin: [
    { icon: '⚙️', title: 'Dashboard',  desc: 'Vue globale',               href: '/superadmin' },
    { icon: '👥', title: 'Utilisateurs',desc: 'Tous les utilisateurs',     href: '/superadmin/users' },
    { icon: '🏫', title: 'Écoles',     desc: 'Gérer les écoles',          href: '/superadmin/ecoles' },
  ],
};

const ROLE_BG: Record<string, string> = {
  eleve:      'from-blue-700 to-blue-600',
  parent:     'from-purple-700 to-purple-600',
  professeur: 'from-orange-600 to-orange-500',
  admin:      'from-green-800 to-green-700',
  superadmin: 'from-red-800 to-red-700',
};

export default function DashboardPage() {
  const { profile } = useAuth();
  const role  = profile?.role || 'eleve';
  const cards = CARDS_BY_ROLE[role] || CARDS_BY_ROLE.eleve;
  const grad  = ROLE_BG[role] || ROLE_BG.eleve;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="p-8">
      <div className={`bg-gradient-to-r ${grad} rounded-2xl p-8 text-white mb-8`}>
        <p className="text-white/70 text-sm font-medium">{greeting} 👋</p>
        <h1 className="text-3xl font-black mt-1">{profile?.name || 'Utilisateur'}</h1>
        <p className="text-white/80 mt-2">{GREETINGS[role]}</p>
        {profile?.isPro && (
          <div className="mt-4 inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5 text-sm font-semibold">
            ⭐ Plan Pro actif
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map(card => (
          <a key={card.href} href={card.href}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all group">
            <div className="text-4xl mb-3">{card.icon}</div>
            <h3 className="font-bold text-gray-900 group-hover:text-green-700 transition-colors">{card.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{card.desc}</p>
          </a>
        ))}
      </div>
      {!profile?.isPro && ['eleve', 'parent'].includes(role) && (
        <div className="mt-8 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl p-6 flex items-center justify-between">
          <div>
            <h3 className="font-black text-white text-lg">Passe à Pro ⭐</h3>
            <p className="text-white/90 text-sm mt-1">Accès illimité à tout le contenu islamique</p>
          </div>
          <a href="/abonnement"
            className="bg-white text-orange-600 font-bold px-6 py-2.5 rounded-xl hover:bg-orange-50 transition-colors whitespace-nowrap">
            Voir les plans
          </a>
        </div>
      )}
    </div>
  );
}
