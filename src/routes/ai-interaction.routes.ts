import { Router } from 'express';
import * as aiController from '@controllers/ai-interaction.controller';
import { authenticate } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateAIInteractionDto } from '@/dto/ai-interaction.dto';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /ai-interactions:
 *   post:
 *     summary: POST Ai Interaction
 *     tags: [Ai Interaction]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.post('/', validateRequest({ body: CreateAIInteractionDto }), aiController.logInteraction);
/**
 * @swagger
 * /ai-interactions/{id}:
 *   get:
 *     summary: GET Ai Interaction
 *     tags: [Ai Interaction]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', aiController.getInteractionById);
/**
 * @swagger
 * /ai-interactions/user/{userId}:
 *   get:
 *     summary: GET Ai Interaction
 *     tags: [Ai Interaction]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.get('/user/:userId', aiController.getUserInteractions);

export default router;
