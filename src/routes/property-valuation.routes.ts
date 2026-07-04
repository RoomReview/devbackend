import { Router } from 'express';
import * as valuationController from '@controllers/property-valuation.controller';
import { authenticate } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreatePropertyValuationDto } from '@/dto/property-valuation.dto';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /valuations:
 *   post:
 *     summary: POST Property Valuation
 *     tags: [Property Valuation]
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
router.post('/', validateRequest({ body: CreatePropertyValuationDto }), valuationController.logValuation);
/**
 * @swagger
 * /valuations/{id}:
 *   get:
 *     summary: GET Property Valuation
 *     tags: [Property Valuation]
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
router.get('/:id', valuationController.getValuationById);
/**
 * @swagger
 * /valuations/user/{userId}:
 *   get:
 *     summary: GET Property Valuation
 *     tags: [Property Valuation]
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
router.get('/user/:userId', valuationController.getUserValuations);

export default router;
