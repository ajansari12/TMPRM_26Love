import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';
import { DefenseLine } from '../types/organization';
import { Loader2 } from 'lucide-react';

type PermissionKey =
  | 'canCreateRequests'
  | 'canReview'
  | 'canApprove'
  | 'canManageUsers'
  | 'canConfigureWorkflows';

interface RoleGuardProps {
  children: ReactNode;
  allowedLines?: DefenseLine[];
  requireAdmin?: boolean;
  requirePlatformAdmin?: boolean;
  requirePermission?: PermissionKey;
  redirectTo?: string;
}

export default function RoleGuard({
  children,
  allowedLines,
  requireAdmin,
  requirePlatformAdmin,
  requirePermission,
  redirectTo = '/access-denied',
}: RoleGuardProps) {
  const {
    loading,
    isPlatformAdmin,
    isAdmin,
    defenseLine,
    canCreateRequests,
    canReview,
    canApprove,
    canManageUsers,
    canConfigureWorkflows,
  } = useOrganization();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isPlatformAdmin) {
    return <>{children}</>;
  }

  if (requirePlatformAdmin) {
    return <Navigate to={redirectTo} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to={redirectTo} replace />;
  }

  if (requirePermission) {
    const permissionMap: Record<PermissionKey, boolean> = {
      canCreateRequests,
      canReview,
      canApprove,
      canManageUsers,
      canConfigureWorkflows,
    };
    if (!permissionMap[requirePermission]) {
      return <Navigate to={redirectTo} replace />;
    }
  }

  if (allowedLines && allowedLines.length > 0) {
    if (!defenseLine || (!isAdmin && !allowedLines.includes(defenseLine))) {
      return <Navigate to={redirectTo} replace />;
    }
  }

  return <>{children}</>;
}
