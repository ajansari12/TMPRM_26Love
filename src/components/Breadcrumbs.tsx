import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const ROUTE_LABELS: Record<string, string> = {
  onboarding: 'Onboarding',
  new: 'New Request',
  edit: 'Edit',
  vendors: 'Vendors',
  compare: 'Compare',
  inventory: 'Inventory',
  assess: 'Assessment',
  'fourth-parties': 'Fourth Parties',
  'exit-strategy': 'Exit Strategy',
  sla: 'SLA Tracking',
  assessments: 'Assessments',
  reassessments: 'Reassessments',
  'risk-matrix': 'Risk Matrix',
  'risk-exceptions': 'Risk Exceptions',
  'due-diligence': 'Due Diligence',
  contracts: 'Contracts',
  reviews: 'Reviews',
  performance: 'Performance',
  incidents: 'Incidents',
  kri: 'KRI Dashboard',
  concentration: 'Concentration Risk',
  compliance: 'Compliance',
  'osfi-b10': 'OSFI B-10',
  attestations: 'Attestations',
  reports: 'Reports',
  board: 'Board Reports',
  regulatory: 'Regulatory Reports',
  'assessment-analytics': 'Assessment Analytics',
  org: 'Organization',
  setup: 'Setup',
  users: 'User Management',
  workflows: 'Workflow Config',
  settings: 'Settings',
  'audit-log': 'Audit Log',
  notifications: 'Notifications',
  help: 'Help Center',
  platform: 'Platform Admin',
  tenants: 'Tenants',
  'global-vendors': 'Global Third Parties',
};

function isUuid(segment: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
}

export default function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/');
    const label = isUuid(segment) ? 'Details' : (ROUTE_LABELS[segment] || segment);
    const isLast = index === segments.length - 1;
    return { path, label, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-sm text-slate-500 space-x-1">
      <Link
        to="/"
        className="flex items-center hover:text-slate-900 transition-colors"
      >
        <Home className="w-4 h-4" />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.path} className="flex items-center space-x-1">
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          {crumb.isLast ? (
            <span className="font-medium text-slate-900">{crumb.label}</span>
          ) : (
            <Link
              to={crumb.path}
              className="hover:text-slate-900 transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
