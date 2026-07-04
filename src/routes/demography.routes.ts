import { Router } from 'express';
import * as demoController from '@controllers/demography.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateDemographyDto, UpdateDemographyDto } from '@/dto/demography.dto';

const router = Router();

router.get('/', demoController.getAllDemography);
router.get('/:id', demoController.getDemographyById);

// Admin-only updates
router.post(
  '/',
  authenticate,
  authorize('manage:locations'),
  validateRequest({ body: CreateDemographyDto }),
  demoController.createDemography,
);

router.put(
  '/:id',
  authenticate,
  authorize('manage:locations'),
  validateRequest({ body: UpdateDemographyDto }),
  demoController.updateDemography,
);

router.delete('/:id', authenticate, authorize('manage:locations'), demoController.deleteDemography);

export default router;
