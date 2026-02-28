import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  User,
  Building2,
  GitBranch,
  Scale,
  Layers,
  Shield,
  FileText,
  Activity,
  Users,
} from 'lucide-react';
import type { SettingsTab } from './settings/types';
import ProfileTab from './settings/ProfileTab';
import OrganizationTab from './settings/OrganizationTab';
import WorkflowTab from './settings/WorkflowTab';
import WeightsTab from './settings/WeightsTab';
import TiersTab from './settings/TiersTab';
import KRITab from './settings/KRITab';
import LifecycleTab from './settings/LifecycleTab';
import UsersTab from './settings/UsersTab';
import AutoCriticalRulesSettings from '../components/AutoCriticalRulesSettings';
import TemplateManagement from '../components/TemplateManagement';

export default function Settings() {
  const { profile } = useAuth();
  const { currentOrganization, isAdmin, isPlatformAdmin, currentMembership } = useOrganization();

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const canManageOrgSettings = isAdmin || isPlatformAdmin;
  const isRiskManager = profile?.role === 'risk_manager';

  const canConfigureAssessment = () => {
    if (!currentMembership) return false;
    return (
      currentMembership.defense_line === '2nd' ||
      currentMembership.defense_line === 'admin' ||
      isAdmin ||
      isPlatformAdmin
    );
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'organization' as const, label: 'Organization', icon: Building2, adminOnly: true },
    { id: 'workflow' as const, label: 'Workflow Config', icon: GitBranch, assessmentConfig: true },
    { id: 'weights' as const, label: 'Category Weights', icon: Scale, adminOnly: true },
    { id: 'tiers' as const, label: 'Tier Configuration', icon: Layers, adminOnly: true },
    { id: 'auto-critical' as const, label: 'Auto-Critical Rules', icon: Shield, adminOnly: true },
    { id: 'templates' as const, label: 'Onboarding Templates', icon: FileText, adminOnly: true },
    { id: 'kri' as const, label: 'KRI Thresholds', icon: Activity, adminOnly: true },
    { id: 'lifecycle' as const, label: 'Lifecycle Config', icon: GitBranch, adminOnly: true },
    { id: 'users' as const, label: 'User Management', icon: Users, adminOnly: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage account, organization, and system preferences
        </p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto">
            {tabs.map((tab) => {
              if (tab.adminOnly && !isRiskManager && !canManageOrgSettings) return null;
              if (tab.assessmentConfig && !canConfigureAssessment()) return null;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'profile' && <ProfileTab />}

          {activeTab === 'organization' && canManageOrgSettings && currentOrganization && (
            <OrganizationTab />
          )}

          {activeTab === 'workflow' && canConfigureAssessment() && currentOrganization && (
            <WorkflowTab />
          )}

          {activeTab === 'weights' && (isRiskManager || canManageOrgSettings) && (
            <WeightsTab />
          )}

          {activeTab === 'tiers' && (isRiskManager || canManageOrgSettings) && currentOrganization && (
            <TiersTab />
          )}

          {activeTab === 'auto-critical' && (isRiskManager || canManageOrgSettings) && currentOrganization && (
            <AutoCriticalRulesSettings />
          )}

          {activeTab === 'templates' && (isRiskManager || canManageOrgSettings) && currentOrganization && (
            <TemplateManagement organizationId={currentOrganization.id} />
          )}

          {activeTab === 'kri' && (isRiskManager || canManageOrgSettings) && (
            <KRITab />
          )}

          {activeTab === 'lifecycle' && (isRiskManager || canManageOrgSettings) && (
            <LifecycleTab />
          )}

          {activeTab === 'users' && (isRiskManager || canManageOrgSettings) && (
            <UsersTab />
          )}
        </div>
      </div>
    </div>
  );
}
