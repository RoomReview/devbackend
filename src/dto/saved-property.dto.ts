import { object, string, type infer as _infer } from 'zod';

export const SavePropertyDto = object({
  propertyId: string().uuid(),
});

export type SavePropertyDto = _infer<typeof SavePropertyDto>;
