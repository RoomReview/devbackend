import { Router } from 'express';
import * as aiInteractionController from '@controllers/ai-interaction.controller';
import { authenticate } from '@/middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, aiInteractionController.getAllAIInteractions);
router.get('/:id', authenticate, aiInteractionController.getAIInteractionById);
router.post('/', authenticate, aiInteractionController.createAIInteraction);

export default router;
