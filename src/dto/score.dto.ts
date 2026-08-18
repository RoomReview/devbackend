import { object, string, nativeEnum, type infer as _infer } from 'zod';

export enum ScoreStatus {
  WAITING = 'WAITING',
  GENERATING = 'GENERATING',
  READY = 'READY',
  FAILED = 'FAILED',
}

export const CreateScoreRequestDto = object({
  boroughId: string().optional(),
  postcodeId: string().optional(),
  name: string().optional(),
  description: string().optional(),
});

export type CreateScoreRequestDto = _infer<typeof CreateScoreRequestDto>;

export const UpdateScoreRequestDto = object({
  status: nativeEnum(ScoreStatus).optional(),
  name: string().optional(),
  description: string().optional(),
});

export type UpdateScoreRequestDto = _infer<typeof UpdateScoreRequestDto>;

export const ScorePreviewDto = object({
  boroughId: string().optional(),
  postcodeId: string().optional(),
});

export type ScorePreviewDto = _infer<typeof ScorePreviewDto>;
