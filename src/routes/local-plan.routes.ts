import { Router } from 'express';
import * as planController from '@controllers/local-plan.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateLocalPlanDto, UpdateLocalPlanDto } from '@/dto/local-plan.dto';

const router = Router();

router.get('/', planController.getAllLocalPlans);
router.get('/:id', planController.getLocalPlanById);

// Admin-only updates
router.post(
  '/',
  authenticate,
  authorize('manage:locations'),
  validateRequest({ body: CreateLocalPlanDto }),
  planController.createLocalPlan,
);

router.put(
  '/:id',
  authenticate,
  authorize('manage:locations'),
  validateRequest({ body: UpdateLocalPlanDto }),
  planController.updateLocalPlan,
);

router.delete('/:id', authenticate, authorize('manage:locations'), planController.deleteLocalPlan);

export default router;
