import { Router } from 'express';
import * as aiController from '@controllers/ai-interaction.controller';
import { authenticate } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateAIInteractionDto } from '@/dto/ai-interaction.dto';

const router = Router();

router.use(authenticate);

router.post('/', validateRequest({ body: CreateAIInteractionDto }), aiController.logInteraction);
router.get('/:id', aiController.getInteractionById);
router.get('/user/:userId', aiController.getUserInteractions);

export default router;
