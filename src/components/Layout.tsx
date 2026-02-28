import { useState, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useDefenseLineAccess } from '../hooks/useDefenseLineAccess';
import { useTheme } from '../hooks/useTheme';
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp';
import CommandPalette from './CommandPalette';
import OnboardingTour from './OnboardingTour';
import Breadcrumbs from './Breadcrumbs';
import Sidebar from './layout/Sidebar';
import Header from './layout/Header';
import { buildNavigation, filterNavigation } from './layout/navigationConfig';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const {
    currentOrganization,
    currentMembership,
    organizations,
    isPlatformAdmin,
    notificationCounts,
    switchOrganization,
    isImpersonating,
    impersonatedOrganization,
    stopImpersonation,
    defenseLineImpersonation,
    stopDefenseLineImpersonation,
    isAdmin,
  } = useOrganization();

  const access = useDefenseLineAccess();
  const { isDark, toggleTheme } = useTheme();

  const handleToggleSearch = useCallback(() => {
    setShowCommandPalette((prev) => !prev);
  }, []);

  const handleToggleHelp = useCallback(() => {
    setShowShortcutsHelp((prev) => !prev);
  }, []);

  useKeyboardShortcuts({
    onToggleSearch: handleToggleSearch,
    onToggleHelp: handleToggleHelp,
  });

  const navigation = buildNavigation(notificationCounts, access.is1A);
  const filteredNav = filterNavigation(navigation, {
    isPlatformAdmin,
    currentMembershipDefenseLine: currentMembership?.defense_line,
    is1A: access.is1A,
    isAdmin: access.isAdmin,
    isReadOnly: access.isReadOnly,
    defenseLine: access.defenseLine ?? undefined,
  });

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
      navigate('/login', { replace: true });
    }
  };

  const handleOrgSwitch = async (orgId: string) => {
    await switchOrganization(orgId);
    setOrgMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Skip to content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-slate-900 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      <Sidebar
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        currentOrganization={currentOrganization}
        organizations={organizations}
        currentMembershipDefenseLine={currentMembership?.defense_line}
        filteredNavigation={filteredNav}
        orgMenuOpen={orgMenuOpen}
        setOrgMenuOpen={setOrgMenuOpen}
        onOrgSwitch={handleOrgSwitch}
      />

      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        <Header
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenCommandPalette={() => setShowCommandPalette(true)}
          isPlatformAdmin={isPlatformAdmin}
          isAdmin={isAdmin}
          isReadOnly={access.isReadOnly}
          canReportIncidents={access.canReportIncidents}
          profile={profile}
          currentMembershipDefenseLine={currentMembership?.defense_line}
          userMenuOpen={userMenuOpen}
          setUserMenuOpen={setUserMenuOpen}
          signingOut={signingOut}
          onSignOut={handleSignOut}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          isImpersonating={isImpersonating}
          impersonatedOrganization={impersonatedOrganization}
          stopImpersonation={stopImpersonation}
          defenseLineImpersonation={defenseLineImpersonation}
          stopDefenseLineImpersonation={stopDefenseLineImpersonation}
        />

        <main id="main-content" className="p-3 sm:p-4 lg:p-6" role="main" aria-label="Page content">
          <div className="mb-4">
            <Breadcrumbs />
          </div>
          {children}
        </main>
      </div>

      <OnboardingTour autoStart />

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        navigation={filteredNav}
      />

      <KeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </div>
  );
}
