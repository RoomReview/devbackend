import { Router } from 'express';
import * as valController from '@controllers/property-value-data.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreatePropertyValueDataDto, UpdatePropertyValueDataDto } from '@/dto/property-value-data.dto';

const router = Router();

router.get('/', valController.getAllPropertyValueData);
router.get('/:id', valController.getPropertyValueDataById);

// Admin-only updates
router.post(
  '/',
  authenticate,
  authorize('manage:locations'),
  validateRequest({ body: CreatePropertyValueDataDto }),
  valController.createPropertyValueData,
);

router.put(
  '/:id',
  authenticate,
  authorize('manage:locations'),
  validateRequest({ body: UpdatePropertyValueDataDto }),
  valController.updatePropertyValueData,
);

router.delete('/:id', authenticate, authorize('manage:locations'), valController.deletePropertyValueData);

export default router;
