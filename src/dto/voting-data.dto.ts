import {
  object,
  string,
  number,
  type infer as _infer,
} from 'zod';

export const CreateVotingDataDto = object({
  borough: string().min(1),
  wardName: string().optional(),
  year: number().int().positive(),
  party: string().min(1),
  votes: number().int().nonnegative(),
  percentage: number().min(0).max(100),
});

export type CreateVotingDataDto = _infer<typeof CreateVotingDataDto>;

export const UpdateVotingDataDto = object({
  borough: string().min(1).optional(),
  wardName: string().optional(),
  year: number().int().positive().optional(),
  party: string().min(1).optional(),
  votes: number().int().nonnegative().optional(),
  percentage: number().min(0).max(100).optional(),
});

export type UpdateVotingDataDto = _infer<typeof UpdateVotingDataDto>;
