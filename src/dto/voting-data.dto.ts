import {
  object,
  string,
  number,
  type infer as _infer,
} from 'zod';

export const CreateVotingDataDto = object({
  borough: string().min(1),
  year: number().int().positive(),
  party: string().min(1),
  percentage: number().min(0).max(100),
  source: string().min(1),
});

export type CreateVotingDataDto = _infer<typeof CreateVotingDataDto>;

export const UpdateVotingDataDto = object({
  borough: string().min(1).optional(),
  year: number().int().positive().optional(),
  party: string().min(1).optional(),
  percentage: number().min(0).max(100).optional(),
  source: string().min(1).optional(),
});

export type UpdateVotingDataDto = _infer<typeof UpdateVotingDataDto>;
