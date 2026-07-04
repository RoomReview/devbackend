import { Router } from 'express';
import * as experienceController from '@controllers/experience.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateExperienceDto, UpdateExperienceDto, UpdateExperienceStatusDto } from '@/dto/experience.dto';

const router = Router();

router.get('/', experienceController.getAllExperiences);
router.get('/:id', experienceController.getExperienceById);

// Create can be anonymous or authenticated, handled inside controller
router.post('/', validateRequest({ body: CreateExperienceDto }), experienceController.createExperience);

router.put(
  '/:id',
  authenticate,
  validateRequest({ body: UpdateExperienceDto }),
  experienceController.updateExperience,
);

router.patch(
  '/:id/status',
  authenticate,
  authorize('approve:experiences'),
  validateRequest({ body: UpdateExperienceStatusDto }),
  experienceController.updateExperienceStatus,
);

router.delete('/:id', authenticate, experienceController.deleteExperience);

export default router;
