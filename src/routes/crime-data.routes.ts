import { Router } from 'express';
import * as crimeController from '@controllers/crime-data.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateCrimeDataDto, UpdateCrimeDataDto } from '@/dto/crime-data.dto';

const router = Router();

router.get('/', crimeController.getAllCrimeData);
router.get('/:id', crimeController.getCrimeDataById);

router.post(
  '/',
  authenticate,
  authorize('manage:locations'),
  validateRequest({ body: CreateCrimeDataDto }),
  crimeController.createCrimeData,
);

router.post(
  '/bulk',
  authenticate,
  authorize('manage:locations'),
  crimeController.bulkCreateCrimeData,
);

router.put(
  '/:id',
  authenticate,
  authorize('manage:locations'),
  validateRequest({ body: UpdateCrimeDataDto }),
  crimeController.updateCrimeData,
);

router.delete('/:id', authenticate, authorize('manage:locations'), crimeController.deleteCrimeData);

export default router;
