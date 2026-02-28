import {
  LayoutDashboard,
  Building2,
  Plus,
  List,
  Calculator,
  Grid3x3,
  ClipboardCheck,
  FileText,
  FileSearch,
  TrendingUp,
  ShieldAlert,
  Activity,
  PieChart,
  Table,
  Settings,
  Shield,
  Target,
  FileCheck,
  GitPullRequest,
  Users,
  Workflow,
  Building,
  Globe2,
  LayoutGrid,
  Crown,
  RefreshCw,
  CheckCircle2,
  LifeBuoy,
} from 'lucide-react';

export interface NavItem {
  name: string;
  path: string;
  icon: any;
  badge?: number;
  hideForReadOnly?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
  requiresAdmin?: boolean;
  requiresPlatformAdmin?: boolean;
  hideFor1A?: boolean;
  requireLines?: string[];
  visibleToAll?: boolean;
}

export function buildNavigation(
  notificationCounts: { pendingMyReview: number; pendingReassessments: number; overdueDueDiligence: number; pendingContractReviews: number },
  is1A: boolean,
): NavGroup[] {
  return [
    {
      title: 'DASHBOARD',
      items: [{ name: 'Dashboard', path: '/', icon: LayoutDashboard }],
    },
    {
      title: 'WORKFLOW',
      items: [
        {
          name: 'Onboarding Requests',
          path: '/onboarding',
          icon: GitPullRequest,
          badge: notificationCounts.pendingMyReview,
        },
        { name: 'New Request', path: '/onboarding/new', icon: Plus, hideForReadOnly: true },
      ],
    },
    {
      title: 'VENDOR MANAGEMENT',
      items: [
        { name: is1A ? 'My Vendors' : 'Vendors', path: '/vendors', icon: Building2 },
        { name: 'Vendor Inventory', path: '/vendors/inventory', icon: List },
      ],
    },
    {
      title: 'RISK ASSESSMENT',
      hideFor1A: true,
      items: [
        { name: 'Tiering Assessments', path: '/assessments', icon: Calculator },
        {
          name: 'Pending Reassessments',
          path: '/assessments/reassessments',
          icon: RefreshCw,
          badge: notificationCounts.pendingReassessments,
        },
        { name: 'Risk Matrix', path: '/risk-matrix', icon: Grid3x3 },
        { name: 'Risk Exceptions', path: '/risk-exceptions', icon: ShieldAlert },
        {
          name: 'Due Diligence',
          path: '/due-diligence',
          icon: ClipboardCheck,
          badge: notificationCounts.overdueDueDiligence,
        },
      ],
    },
    {
      title: 'CONTRACTS',
      hideFor1A: true,
      items: [
        { name: 'Contract Register', path: '/contracts', icon: FileText },
        {
          name: 'Contract Reviews',
          path: '/contracts/reviews',
          icon: FileSearch,
          badge: notificationCounts.pendingContractReviews,
        },
      ],
    },
    {
      title: 'MONITORING',
      hideFor1A: true,
      items: [
        { name: 'Performance Management', path: '/performance', icon: TrendingUp },
        { name: 'Incidents', path: '/incidents', icon: ShieldAlert },
        { name: 'KRI Dashboard', path: '/kri', icon: Activity },
        { name: 'Concentration Risk', path: '/concentration', icon: Target },
      ],
    },
    {
      title: 'REPORTING',
      hideFor1A: true,
      items: [
        { name: 'Assessment Analytics', path: '/reports/assessment-analytics', icon: TrendingUp },
        { name: 'Board Reports', path: '/reports/board', icon: PieChart },
        { name: 'Regulatory Reports', path: '/reports/regulatory', icon: FileText },
        { name: 'Inventory Reports', path: '/reports/inventory', icon: Table },
      ],
    },
    {
      title: 'COMPLIANCE',
      requireLines: ['2nd', '3rd', 'admin', 'senior_management'],
      items: [
        { name: 'Compliance Overview', path: '/compliance', icon: CheckCircle2 },
        { name: 'OSFI B-10', path: '/compliance/osfi-b10', icon: Shield },
        { name: 'Attestations', path: '/attestations', icon: FileCheck },
      ],
    },
    {
      title: 'ORGANIZATION',
      items: [
        { name: 'Organization Setup', path: '/org/setup', icon: Building },
        { name: 'User Management', path: '/org/users', icon: Users },
        { name: 'Workflow Config', path: '/org/workflows', icon: Workflow },
        { name: 'Settings', path: '/settings', icon: Settings },
        { name: 'Audit Log', path: '/audit-log', icon: Shield },
      ],
      requiresAdmin: true,
    },
    {
      title: 'SUPPORT',
      visibleToAll: true,
      items: [
        { name: 'Help Center', path: '/help', icon: LifeBuoy },
      ],
    },
    {
      title: 'PLATFORM ADMIN',
      items: [
        { name: 'Platform Dashboard', path: '/platform', icon: Crown },
        { name: 'Tenant Management', path: '/platform/tenants', icon: LayoutGrid },
        { name: 'Global Third Parties', path: '/platform/global-vendors', icon: Globe2 },
      ],
      requiresPlatformAdmin: true,
    },
  ];
}

export function filterNavigation(
  navigation: NavGroup[],
  options: {
    isPlatformAdmin: boolean;
    currentMembershipDefenseLine: string | undefined;
    is1A: boolean;
    isAdmin: boolean;
    isReadOnly: boolean;
    defenseLine: string | undefined;
  },
): NavGroup[] {
  return navigation
    .filter((group) => {
      if (group.visibleToAll) return true;
      if (group.requiresPlatformAdmin && !options.isPlatformAdmin) return false;
      if (group.requiresAdmin && options.currentMembershipDefenseLine !== 'admin') {
        return options.isPlatformAdmin;
      }
      if (group.hideFor1A && options.is1A && !options.isAdmin) return false;
      if (group.requireLines && options.defenseLine && !options.isAdmin) {
        if (!group.requireLines.includes(options.defenseLine)) return false;
      }
      return true;
    })
    .map((group) => {
      if (!options.isReadOnly) return group;
      return {
        ...group,
        items: group.items.filter((item) => !item.hideForReadOnly),
      };
    });
}
