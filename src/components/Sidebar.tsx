'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const NAV_BY_ROLE: Record<string, { href: string; icon: string; label: string }[]> = {
  eleve: [
    { href: '/dashboard',   icon: '🏠', label: 'Accueil' },
    { href: '/cours',       icon: '📚', label: 'Mes cours' },
    { href: '/coran',       icon: '📖', label: 'Coran' },
    { href: '/progres',     icon: '📊', label: 'Progrès' },
    { href: '/abonnement',  icon: '⭐', label: 'Abonnement' },
    { href: '/profile',     icon: '👤', label: 'Profil' },
  ],
  parent: [
    { href: '/dashboard',   icon: '🏠', label: 'Accueil' },
    { href: '/enfants',     icon: '👶', label: 'Mes enfants' },
    { href: '/abonnement',  icon: '⭐', label: 'Abonnement' },
    { href: '/profile',     icon: '👤', label: 'Profil' },
  ],
  professeur: [
    { href: '/dashboard',   icon: '🏠', label: 'Accueil' },
    { href: '/eleves',      icon: '🎓', label: 'Mes élèves' },
    { href: '/cours',       icon: '📚', label: 'Cours' },
    { href: '/profile',     icon: '👤', label: 'Profil' },
  ],
  admin: [
    { href: '/dashboard',   icon: '🏠', label: 'Accueil' },
    { href: '/admin/users', icon: '👥', label: 'Utilisateurs' },
    { href: '/admin/ecole', icon: '🏫', label: 'Mon école' },
    { href: '/profile',     icon: '👤', label: 'Profil' },
  ],
  superadmin: [
    { href: '/dashboard',        icon: '🏠', label: 'Accueil' },
    { href: '/superadmin',       icon: '⚙️', label: 'Dashboard' },
    { href: '/superadmin/users', icon: '👥', label: 'Utilisateurs' },
    { href: '/superadmin/ecoles',icon: '🏫', label: 'Écoles' },
    { href: '/profile',          icon: '👤', label: 'Profil' },
  ],
};

const ROLE_COLORS: Record<string, string> = {
  eleve:      'from-blue-800 to-blue-700',
  parent:     'from-purple-800 to-purple-700',
  professeur: 'from-orange-700 to-orange-600',
  admin:      'from-green-800 to-green-700',
  superadmin: 'from-red-800 to-red-700',
};

export default function Sidebar() {
  const { profile, logout } = useAuth();
  const pathname = usePathname();
  const role  = profile?.role || 'eleve';
  const nav   = NAV_BY_ROLE[role] || NAV_BY_ROLE.eleve;
  const grad  = ROLE_COLORS[role] || ROLE_COLORS.eleve;

  return (
    <aside className={`w-64 min-h-screen bg-gradient-to-b ${grad} flex flex-col text-white`}>
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📖</span>
          <div>
            <h1 className="font-black text-lg leading-none">Sama Doom</h1>
            <p className="text-xs text-white/60 mt-0.5">Éducation islamique</p>
          </div>
        </div>
      </div>
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
            {(profile?.name || profile?.email || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{profile?.name || 'Utilisateur'}</p>
            <p className="text-xs text-white/60 truncate">{role}</p>
          </div>
          {profile?.isPro && <span className="text-yellow-300 text-sm">⭐</span>}
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                active ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}>
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10">
        <button onClick={() => logout()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-all text-sm font-medium">
          <span>🚪</span> Déconnexion
        </button>
      </div>
    </aside>
  );
}
