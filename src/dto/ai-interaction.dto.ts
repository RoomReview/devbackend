import {
  object,
  string,
  number,
  boolean,
  type infer as _infer,
} from 'zod';

export const CreateAIInteractionDto = object({
  query: string().min(1),
  response: string().min(1),
  postcode: string().optional(),
  borough: string().optional(),
  tokensUsed: number().int().positive().optional(),
  creditsUsed: number().int().nonnegative(),
  downloaded: boolean().optional(),
});

export type CreateAIInteractionDto = _infer<typeof CreateAIInteractionDto>;
