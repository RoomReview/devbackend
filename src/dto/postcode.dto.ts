import {
  object,
  string,
  number,
  record,
  any,
  type infer as _infer,
} from 'zod';

export const CreatePostcodeDto = object({
  code: string().min(1),
  outcode: string().min(1),
  incode: string().min(1),
  latitude: number().optional(),
  longitude: number().optional(),
  metrics: record(string(), any()).optional(),
  boroughId: string().optional(),
});

export type CreatePostcodeDto = _infer<typeof CreatePostcodeDto>;

export const UpdatePostcodeDto = object({
  code: string().min(1).optional(),
  outcode: string().min(1).optional(),
  incode: string().min(1).optional(),
  latitude: number().optional(),
  longitude: number().optional(),
  metrics: record(string(), any()).optional(),
  boroughId: string().optional(),
});

export type UpdatePostcodeDto = _infer<typeof UpdatePostcodeDto>;
