import { logger } from '../../lib/logger';

export const TABLE_MIGRATIONS: Record<string, string> = {
  organizations: '20260130034201_create_multi_tenant_organizations.sql',
  organization_users: '20260130034201_create_multi_tenant_organizations.sql',
  onboarding_requests: '20260130034352_create_onboarding_workflow.sql',
  onboarding_tasks: '20260130034352_create_onboarding_workflow.sql',
  onboarding_comments: '20260130034352_create_onboarding_workflow.sql',
  platform_admins: '20260130034526_create_platform_admin_and_shared_registry.sql',
  global_third_parties: '20260130034526_create_platform_admin_and_shared_registry.sql',
  vendors: '20251205022302_create_vendors_table.sql',
  profiles: '20251205022235_create_users_and_profiles.sql',
};

interface PostgrestError {
  code?: string;
  message?: string;
  details?: string;
}

export function isTableMissingError(error: unknown): boolean {
  const pgError = error as PostgrestError;
  return pgError?.code === '42P01' || pgError?.message?.includes('does not exist') || false;
}

export function getTableNameFromError(error: unknown): string | null {
  const pgError = error as PostgrestError;
  const message = pgError?.message || pgError?.details || '';
  const match = message.match(/relation "(?:public\.)?(\w+)" does not exist/);
  return match ? match[1] : null;
}

export function logTableMissingError(tableName: string) {
  const migration = TABLE_MIGRATIONS[tableName] || 'unknown migration';
  logger.warn(
    `[OrganizationContext] Table '${tableName}' not found. Please run the migration: ${migration}`,
  );
}

export function getPostgrestErrorMessage(error: unknown): string {
  return (error as PostgrestError)?.message || 'Unknown error';
}
