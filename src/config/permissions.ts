import { UserRole } from '@/generated/prisma/enums';

export const permissions = {
  'view:users:all': [UserRole.ADMIN],
  'manage:users': [UserRole.ADMIN],
  'manage:reviews': [UserRole.ADMIN],
  'view:users:self': [UserRole.ADMIN, UserRole.LANDLORD, UserRole.TENANT],
  'manage:locations': [UserRole.ADMIN],
  'manage:reports': [UserRole.ADMIN],
  'manage:properties': [UserRole.ADMIN, UserRole.LANDLORD, UserRole.AGENCY, UserRole.AGENT],
} as const;
