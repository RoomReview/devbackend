import { Router } from 'express';
import * as creditsController from '@controllers/user-credits.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { UpdateUserCreditsDto, AdjustUserCreditsDto } from '@/dto/user-credits.dto';

const router = Router();

router.use(authenticate);

router.get('/user/:userId', creditsController.getUserCredits);

router.put(
  '/user/:userId',
  authorize('manage:credits'),
  validateRequest({ body: UpdateUserCreditsDto }),
  creditsController.updateUserCredits,
);

router.post(
  '/user/:userId/adjust',
  authorize('manage:credits'),
  validateRequest({ body: AdjustUserCreditsDto }),
  creditsController.adjustUserCredits,
);

export default router;
