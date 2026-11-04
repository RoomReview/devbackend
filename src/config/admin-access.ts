import { UserRole } from '@/generated/prisma/enums';
import type { permissions } from '@/config/permissions';

type AdminPermission = keyof typeof permissions | 'view:admin:audit-logs';

const superAdminEmails = new Set([
  'roomrevievsuperpuperadmin@roomreview.co.uk',
]);

const standardAdminEmails = new Set([
  'federico@roomreview.co.uk',
  'yuliia@roomreview.co.uk',
]);

const blogPublisherEmails = new Set([
  'meghamayuri@roomreview.co.uk',
]);

export const canAccessAdminPermission = (
  email: string,
  role: string,
  permission: AdminPermission,
) => {
  if (role !== UserRole.ADMIN) {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (superAdminEmails.has(normalizedEmail)) {
    return true;
  }
  if (standardAdminEmails.has(normalizedEmail)) {
    return permission !== 'view:admin:audit-logs';
  }
  if (blogPublisherEmails.has(normalizedEmail)) {
    return permission === 'create:blog' || permission === 'publish:blog';
  }

  return false;
};

export const canAccessAdminDashboard = (email: string, role: string) =>
  canAccessAdminPermission(email, role, 'view:users:all');

export const canViewAdminAuditLog = (email: string, role: string) =>
  canAccessAdminPermission(email, role, 'view:admin:audit-logs');
