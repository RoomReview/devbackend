// TBD: future permissions table implementation

import { UserRole } from '@/generated/prisma/enums';

export const permissions = {
  'view:users:all': [UserRole.ADMIN],
  'view:users:self': [UserRole.ADMIN, UserRole.LANDLORD, UserRole.TENANT],
  'approve:reviews': [UserRole.ADMIN],
  'manage:properties': [UserRole.ADMIN],
  'manage:locations': [UserRole.ADMIN],
} as const;
