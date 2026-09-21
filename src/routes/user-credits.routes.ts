import { Router } from 'express';
import * as userCreditsController from '@controllers/user-credits.controller';
import { authenticate } from '@/middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, userCreditsController.getUserCredits);
router.get('/history', authenticate, userCreditsController.getCreditHistory);
router.post('/purchase', authenticate, userCreditsController.purchaseCredits);
router.post('/download', authenticate, userCreditsController.useCreditsForDownload);

export default router;
