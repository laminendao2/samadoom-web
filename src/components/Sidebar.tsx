'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const NAV_BY_ROLE: Record<string, { href: string; icon: string; label: string }[]> = {
  eleve: [
    { href: '/dashboard',  icon: '🏠', label: 'Accueil' },
    { href: '/progres',    icon: '📊', label: 'Mes progrès' },
    { href: '/cours',      icon: '🎒', label: 'Mes cours' },
    { href: '/coran',      icon: '📖', label: 'Coran' },
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

const ROLE_ICONS: Record<string, string> = {
  eleve: '📚', parent: '👨‍👩‍👧', professeur: '🎓', admin: '🏫', superadmin: '⚡',
};

function RoleSwitcher({ profile, switchRole, onSwitch }: {
  profile: { role: string; roles?: string[] };
  switchRole: (r: string) => void;
  onSwitch?: () => void;
}) {
  const router = useRouter();
  const availableRoles = [...new Set([...(profile.roles || []), profile.role])];
  if (availableRoles.length <= 1) return null;

  return (
    <div className="px-3 pb-2">
      <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold px-1 mb-1">Changer de rôle</p>
      <div className="space-y-0.5">
        {availableRoles.map((r) => (
          <button
            key={r}
            onClick={() => {
              switchRole(r);
              router.push('/dashboard');
              onSwitch?.();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
              r === profile.role
                ? 'bg-white/25 text-white font-semibold'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="text-base w-5 text-center">{ROLE_ICONS[r] || '👤'}</span>
            <span className="flex-1 text-left">{ROLE_LABELS[r] || r}</span>
            {r === profile.role && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">actif</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { profile, logout, switchRole } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = profile?.role || 'eleve';
  const nav  = NAV_BY_ROLE[role] || NAV_BY_ROLE.eleve;
  const grad = ROLE_COLORS[role] || ROLE_COLORS.eleve;
  const hasMultipleRoles = (profile?.roles?.length ?? 0) > 1;

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

        {/* Role switcher */}
        {hasMultipleRoles && profile && (
          <div className="border-t border-white/10 pt-3">
            <RoleSwitcher profile={profile} switchRole={switchRole} />
          </div>
        )}

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
        {nav.slice(0, hasMultipleRoles ? 4 : 5).map((item) => {
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
        {/* Role switcher button on mobile */}
        {hasMultipleRoles && (
          <button
            onClick={() => setMobileOpen(true)}
            className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg opacity-60 hover:opacity-100 transition-all"
          >
            <span className="text-xl">🔄</span>
            <span className="text-white text-[10px] font-medium leading-none">Rôle</span>
          </button>
        )}
      </nav>

      {/* Mobile role switcher modal */}
      {mobileOpen && profile && (
        <div className="md:hidden fixed inset-0 z-[60] flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className={`relative w-full bg-gradient-to-b ${grad} rounded-t-2xl p-6 pb-10`}>
            <h3 className="text-white font-bold text-lg mb-4">Changer de rôle</h3>
            <RoleSwitcher profile={profile} switchRole={switchRole} onSwitch={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
