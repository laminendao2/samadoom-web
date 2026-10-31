'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const NAV_BY_ROLE: Record<string, { href: string; icon: string; label: string }[]> = {
  eleve: [
    { href: '/dashboard',  icon: '🏠', label: 'Accueil' },
    { href: '/progres',    icon: '📊', label: 'Mes progrès' },
    { href: '/abonnement', icon: '⭐', label: 'Abonnement' },
    { href: '/profile',    icon: '👤', label: 'Profil' },
  ],
  parent: [
    { href: '/dashboard',  icon: '🏠', label: 'Accueil' },
    { href: '/enfants',    icon: '👶', label: 'Mes enfants' },
    { href: '/abonnement', icon: '⭐', label: 'Abonnement' },
    { href: '/profile',    icon: '👤', label: 'Profil' },
  ],
  professeur: [
    { href: '/dashboard',  icon: '🏠', label: 'Accueil' },
    { href: '/eleves',     icon: '🎓', label: 'Mes élèves' },
    { href: '/profile',    icon: '👤', label: 'Profil' },
  ],
  admin: [
    { href: '/dashboard',   icon: '🏠',  label: 'Accueil' },
    { href: '/admin/users', icon: '👥',  label: 'Membres' },
    { href: '/admin/ecole', icon: '🏫',  label: 'Mon école' },
    { href: '/profile',     icon: '👤',  label: 'Profil' },
  ],
  superadmin: [
    { href: '/dashboard',         icon: '🏠',  label: 'Accueil' },
    { href: '/superadmin',        icon: '📊',  label: 'Vue globale' },
    { href: '/superadmin/users',  icon: '👥',  label: 'Utilisateurs' },
    { href: '/superadmin/ecoles', icon: '🏫',  label: 'Écoles' },
    { href: '/abonnement',        icon: '💳',  label: 'Abonnements' },
    { href: '/profile',           icon: '👤',  label: 'Profil' },
  ],
};

const ROLE_COLORS: Record<string, string> = {
  eleve:      'from-blue-800 to-blue-700',
  parent:     'from-purple-800 to-purple-700',
  professeur: 'from-orange-700 to-orange-600',
  admin:      'from-green-800 to-green-700',
  superadmin: 'from-red-800 to-red-700',
};

const ROLE_LABELS: Record<string, string> = {
  eleve: 'Élève', parent: 'Parent', professeur: 'Professeur',
  admin: 'Admin', superadmin: 'Super Admin',
};

export default function Sidebar() {
  const { profile, logout } = useAuth();
  const pathname = usePathname();
  const role = profile?.role || 'eleve';
  const nav  = NAV_BY_ROLE[role] || NAV_BY_ROLE.eleve;
  const grad = ROLE_COLORS[role] || ROLE_COLORS.eleve;

  return (
    <>
      {/* SIDEBAR — desktop */}
      <aside className={`hidden md:flex w-64 min-h-screen bg-gradient-to-b ${grad} flex-col text-white shrink-0`}>
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-2xl">📖</div>
            <div>
              <h1 className="font-black text-lg leading-none">Sama Doom</h1>
              <p className="text-xs text-white/60 mt-0.5">Éducation islamique</p>
            </div>
          </div>
        </div>

        {/* User */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg flex-shrink-0">
              {(profile?.name || profile?.email || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{profile?.name || 'Utilisateur'}</p>
              <p className="text-xs text-white/60">{ROLE_LABELS[role] || role}</p>
            </div>
            {profile?.isPro && <span className="text-yellow-300 text-xs font-bold flex-shrink-0">PRO</span>}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link key={item.href + item.label} href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}>
                <span className="text-xl w-6 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all">
            <span className="text-xl w-6 text-center">🚪</span>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* BOTTOM NAV — mobile */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r ${grad} border-t border-white/10 flex justify-around items-center h-16 px-2`}>
        {nav.slice(0, 5).map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link key={item.href + item.label} href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all ${
                active ? 'bg-white/20' : 'opacity-60'
              }`}>
              <span className="text-xl">{item.icon}</span>
              <span className="text-white text-[10px] font-medium leading-none">{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
