import { Link, useLocation } from 'react-router-dom';
import {
  Shield,
  Building2,
  Plus,
  Briefcase,
  ChevronDown,
  CheckSquare,
} from 'lucide-react';
import { DEFENSE_LINE_LABELS, type DefenseLine } from '../../types/organization';
import type { NavGroup } from './navigationConfig';

interface Organization {
  id: string;
  name: string;
}

interface SidebarProps {
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  currentOrganization: Organization | null;
  organizations: Organization[];
  currentMembershipDefenseLine: DefenseLine | undefined;
  filteredNavigation: NavGroup[];
  orgMenuOpen: boolean;
  setOrgMenuOpen: (open: boolean) => void;
  onOrgSwitch: (orgId: string) => void;
}

export default function Sidebar({
  sidebarOpen,
  onCloseSidebar,
  currentOrganization,
  organizations,
  currentMembershipDefenseLine,
  filteredNavigation,
  orgMenuOpen,
  setOrgMenuOpen,
  onOrgSwitch,
}: SidebarProps) {
  const location = useLocation();

  // Close sidebar on mobile after navigation
  const handleNavClick = () => {
    if (window.innerWidth < 1024) {
      onCloseSidebar();
    }
  };

  const getDefenseLineBadge = () => {
    if (!currentMembershipDefenseLine) return null;
    const label = DEFENSE_LINE_LABELS[currentMembershipDefenseLine];
    const colorMap: Record<string, string> = {
      '1a': 'bg-blue-100 text-blue-700',
      '1b': 'bg-indigo-100 text-indigo-700',
      '2nd': 'bg-purple-100 text-purple-700',
      '3rd': 'bg-pink-100 text-pink-700',
      'admin': 'bg-slate-100 text-slate-700',
    };
    const colorClass = colorMap[currentMembershipDefenseLine] || 'bg-slate-100 text-slate-700';

    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
        {label}
      </span>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-20 lg:hidden"
          onClick={onCloseSidebar}
        />
      )}
      <aside
        role="navigation"
        aria-label="Main navigation"
        className={`fixed top-0 left-0 h-full bg-slate-900 text-white transition-all duration-300 z-30
          ${sidebarOpen ? 'w-64 translate-x-0' : 'lg:w-20 -translate-x-full lg:translate-x-0'}
        `}
      >
      {/* Logo area */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        {sidebarOpen ? (
          <div className="flex items-center space-x-3">
            <div className="bg-slate-800 p-2 rounded-lg">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">TPRM</h1>
              <p className="text-xs text-slate-400">OSFI B-10 Compliant</p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800 p-2 rounded-lg mx-auto">
            <Shield className="w-6 h-6" />
          </div>
        )}
      </div>

      {/* Organization Selector */}
      {sidebarOpen && currentOrganization && (
        <div className="p-3 border-b border-slate-800">
          <div className="relative">
            <button
              onClick={() => setOrgMenuOpen(!orgMenuOpen)}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
              aria-label="Switch organization"
              aria-expanded={orgMenuOpen}
              aria-haspopup="true"
            >
              <div className="flex items-center space-x-2 min-w-0">
                <Briefcase className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-white truncate">
                  {currentOrganization.name}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${orgMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {orgMenuOpen && organizations.length > 1 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 rounded-lg shadow-lg border border-slate-700 py-1 z-50">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => onOrgSwitch(org.id)}
                    className={`w-full flex items-center space-x-2 px-3 py-2 text-sm text-left hover:bg-slate-700 transition-colors ${
                      org.id === currentOrganization.id ? 'bg-slate-700 text-white' : 'text-slate-300'
                    }`}
                  >
                    <Briefcase className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{org.name}</span>
                    {org.id === currentOrganization.id && (
                      <CheckSquare className="w-4 h-4 ml-auto text-green-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Defense Line Badge */}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">Your Role:</span>
            {getDefenseLineBadge()}
          </div>
        </div>
      )}

      {/* FI Onboarding Prompt */}
      {sidebarOpen && organizations.length === 0 && (
        <div className="p-3 border-b border-slate-800">
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-medium text-white">No Organization</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Register your financial institution to get started with the TPRM platform.
            </p>
            <Link
              to="/fi-onboarding"
              className="flex items-center justify-center w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1" />
              Register Institution
            </Link>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        {filteredNavigation.map((group) => (
          <div key={group.title} className="mb-4">
            {sidebarOpen && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {group.title}
              </h3>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path ||
                  (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <li key={item.path} className="relative group">
                    <Link
                      to={item.path}
                      onClick={handleNavClick}
                      className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${sidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                      {sidebarOpen && (
                        <>
                          <span className="text-sm flex-1">{item.name}</span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-500 text-white rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                      {!sidebarOpen && item.badge !== undefined && item.badge > 0 && (
                        <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
                      )}
                    </Link>
                    {!sidebarOpen && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none shadow-lg">
                        {item.name}
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 rounded-full text-[10px]">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 p-4">
        {sidebarOpen && (
          <p className="text-xs text-slate-400 text-center">Powered by ComplyWise</p>
        )}
      </div>
    </aside>
    </>
  );
}
