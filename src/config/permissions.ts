
import { UserRole } from '@/generated/prisma/enums';

export const permissions = {
  'view:users:all': [UserRole.ADMIN],
  'view:users:self': [UserRole.ADMIN, UserRole.LANDLORD, UserRole.TENANT],
  'manage:locations': [UserRole.ADMIN],
  'manage:reports': [UserRole.ADMIN],
} as const;
