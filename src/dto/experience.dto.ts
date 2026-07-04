import { ExperienceType, ExperienceStatus } from '@/generated/prisma/enums';
import {
  object,
  string,
  number,
  boolean,
  enum as enum_,
  type infer as _infer,
} from 'zod';

export const CreateExperienceDto = object({
  type: enum_([
    ExperienceType.POSITIVE,
    ExperienceType.NEGATIVE,
    ExperienceType.WARNING,
    ExperienceType.NEUTRAL,
  ]),
  title: string().min(1),
  story: string().min(1),
  landlordName: string().optional(),
  agentName: string().optional(),
  yearOfExperience: number().int().positive().optional(),
  anonymous: boolean().optional(),
  contactEmail: string().optional(),
  postcodeId: string().optional(),
});

export type CreateExperienceDto = _infer<typeof CreateExperienceDto>;

export const UpdateExperienceDto = object({
  type: enum_([
    ExperienceType.POSITIVE,
    ExperienceType.NEGATIVE,
    ExperienceType.WARNING,
    ExperienceType.NEUTRAL,
  ]).optional(),
  title: string().min(1).optional(),
  story: string().min(1).optional(),
  landlordName: string().optional(),
  agentName: string().optional(),
  yearOfExperience: number().int().positive().optional(),
  anonymous: boolean().optional(),
  contactEmail: string().optional(),
  postcodeId: string().optional(),
});

export type UpdateExperienceDto = _infer<typeof UpdateExperienceDto>;

export const UpdateExperienceStatusDto = object({
  status: enum_([
    ExperienceStatus.PENDING,
    ExperienceStatus.APPROVED,
    ExperienceStatus.REJECTED,
    ExperienceStatus.FEATURED,
  ]),
  adminNotes: string().optional(),
});

export type UpdateExperienceStatusDto = _infer<typeof UpdateExperienceStatusDto>;
