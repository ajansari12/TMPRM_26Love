import { Link } from 'react-router-dom';
import NotificationCenter from '../NotificationCenter';
import DefenseLineViewSelector from '../DefenseLineViewSelector';
import {
  Search,
  Menu,
  X,
  User,
  LogOut,
  ChevronDown,
  Settings,
  Crown,
  Eye,
  Clock,
  Moon,
  Sun,
} from 'lucide-react';
import { DEFENSE_LINE_LABELS, type DefenseLine } from '../../types/organization';

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenCommandPalette: () => void;
  isPlatformAdmin: boolean;
  isAdmin: boolean;
  isReadOnly: boolean;
  canReportIncidents: boolean;
  profile: { full_name?: string; email?: string; role?: string } | null;
  currentMembershipDefenseLine: DefenseLine | undefined;
  userMenuOpen: boolean;
  setUserMenuOpen: (open: boolean) => void;
  signingOut: boolean;
  onSignOut: () => void;
  // Theme
  isDark: boolean;
  onToggleTheme: () => void;
  // Impersonation
  isImpersonating: boolean;
  impersonatedOrganization: { name: string } | null;
  stopImpersonation: () => void;
  defenseLineImpersonation: {
    isActive: boolean;
    targetDefenseLine: string | null;
    minutesRemaining: number;
  };
  stopDefenseLineImpersonation: () => void;
}

export default function Header({
  sidebarOpen,
  onToggleSidebar,
  onOpenCommandPalette,
  isPlatformAdmin,
  isAdmin,
  isReadOnly,
  canReportIncidents,
  profile,
  currentMembershipDefenseLine,
  userMenuOpen,
  setUserMenuOpen,
  signingOut,
  onSignOut,
  isDark,
  onToggleTheme,
  isImpersonating,
  impersonatedOrganization,
  stopImpersonation,
  defenseLineImpersonation,
  stopDefenseLineImpersonation,
}: HeaderProps) {
  return (
    <>
      {/* Organization Impersonation Banner */}
      {isImpersonating && impersonatedOrganization && (
        <div className="bg-amber-400 text-amber-900 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center space-x-3">
            <Crown className="w-5 h-5" />
            <span className="font-medium">
              You are viewing as: <strong>{impersonatedOrganization.name}</strong>
            </span>
            <span className="text-sm text-amber-800">(Read-only for sensitive operations)</span>
          </div>
          <button
            onClick={stopImpersonation}
            className="flex items-center px-4 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
          >
            <X className="w-4 h-4 mr-1.5" />
            Exit Impersonation
          </button>
        </div>
      )}

      {/* 3rd Line Read-Only Banner */}
      {isReadOnly && !defenseLineImpersonation.isActive && (
        <div className="bg-slate-600 text-white px-6 py-2.5 flex items-center justify-center sticky top-0 z-30">
          <div className="flex items-center space-x-2">
            <Eye className="w-4 h-4" />
            <span className="text-sm font-medium">
              Third Line of Defense — Observation Mode (Read Only)
            </span>
          </div>
        </div>
      )}

      {/* Defense Line Impersonation Banner */}
      {defenseLineImpersonation.isActive && defenseLineImpersonation.targetDefenseLine && (
        <div className={`bg-teal-500 text-white px-6 py-3 flex items-center justify-between ${isImpersonating ? '' : 'sticky top-0 z-30'}`}>
          <div className="flex items-center space-x-3">
            <Eye className="w-5 h-5" />
            <span className="font-medium">
              Testing as: <strong>{DEFENSE_LINE_LABELS[defenseLineImpersonation.targetDefenseLine as DefenseLine]}</strong>
            </span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-teal-600 rounded text-sm">
              <Clock className="w-3.5 h-3.5" />
              <span>{defenseLineImpersonation.minutesRemaining} min remaining</span>
            </div>
            <span className="text-sm text-teal-100">(Actions flagged as test mode)</span>
          </div>
          <button
            onClick={() => stopDefenseLineImpersonation()}
            className="flex items-center px-4 py-1.5 bg-teal-700 text-white rounded-lg hover:bg-teal-800 transition-colors text-sm font-medium"
          >
            <X className="w-4 h-4 mr-1.5" />
            Exit Role View
          </button>
        </div>
      )}

      {/* Header */}
      <header className={`bg-white border-b border-slate-200 sticky z-20 ${
        isImpersonating && defenseLineImpersonation.isActive
          ? 'top-[104px]'
          : isImpersonating || defenseLineImpersonation.isActive
            ? 'top-[52px]'
            : (isReadOnly && !defenseLineImpersonation.isActive)
              ? 'top-[44px]'
              : 'top-0'
      }`}>
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Mobile: icon-only search trigger. Desktop: full search bar */}
            <button
              onClick={onOpenCommandPalette}
              className="sm:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Open command palette"
            >
              <Search className="w-5 h-5 text-slate-400" />
            </button>
            <button
              onClick={onOpenCommandPalette}
              className="hidden sm:flex items-center pl-3 pr-4 py-2 border border-slate-300 rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-colors w-48 md:w-72 text-left"
              aria-label="Open command palette"
            >
              <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <span className="text-sm text-slate-400 flex-1">Search...</span>
              <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">
                <span>⌘</span>K
              </kbd>
            </button>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Platform Admin Badge */}
            {isPlatformAdmin && (
              <div className="hidden sm:flex items-center space-x-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full">
                <Crown className="w-4 h-4" />
                <span className="text-xs font-medium">Platform Admin</span>
              </div>
            )}

            {/* Defense Line View Selector */}
            {isAdmin && <span className="hidden md:block"><DefenseLineViewSelector /></span>}

            {/* Dark Mode Toggle */}
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-slate-500" />}
            </button>

            <NotificationCenter />

            {canReportIncidents && (
              <Link
                to="/incidents"
                className="hidden sm:inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Report Incident
              </Link>
            )}

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="User menu"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-sm font-medium text-slate-900">
                    {profile?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {currentMembershipDefenseLine
                      ? DEFENSE_LINE_LABELS[currentMembershipDefenseLine]
                      : profile?.role || 'User'}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-600" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-900">{profile?.full_name}</p>
                    <p className="text-xs text-slate-500">{profile?.email}</p>
                  </div>

                  <Link
                    to="/settings"
                    className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Link>

                  <button
                    onClick={onSignOut}
                    disabled={signingOut}
                    className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {signingOut ? 'Signing out...' : 'Sign Out'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
