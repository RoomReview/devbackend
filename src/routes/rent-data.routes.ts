import { Router } from 'express';
import * as rentController from '@controllers/rent-data.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateRentDataDto, UpdateRentDataDto } from '@/dto/rent-data.dto';

const router = Router();

router.get('/', rentController.getAllRentData);
router.get('/:id', rentController.getRentDataById);

router.post(
  '/',
  authenticate,
  authorize('manage:locations'),
  validateRequest({ body: CreateRentDataDto }),
  rentController.createRentData,
);

router.post(
  '/bulk',
  authenticate,
  authorize('manage:locations'),
  rentController.bulkCreateRentData,
);

router.put(
  '/:id',
  authenticate,
  authorize('manage:locations'),
  validateRequest({ body: UpdateRentDataDto }),
  rentController.updateRentData,
);

router.delete('/:id', authenticate, authorize('manage:locations'), rentController.deleteRentData);

export default router;
