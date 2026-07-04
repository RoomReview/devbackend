import { Router } from 'express';
import * as savedPropertyController from '@controllers/saved-property.controller';
import { authenticate } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { SavePropertyDto } from '@/dto/saved-property.dto';

const router = Router();

router.use(authenticate); // Require authentication for all saved property endpoints

/**
 * @swagger
 * /saved-properties:
 *   get:
 *     summary: GET Saved Property
 *     tags: [Saved Property]
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
router.get('/', savedPropertyController.getSavedProperties);
/**
 * @swagger
 * /saved-properties:
 *   post:
 *     summary: POST Saved Property
 *     tags: [Saved Property]
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
router.post('/', validateRequest({ body: SavePropertyDto }), savedPropertyController.saveProperty);
/**
 * @swagger
 * /saved-properties/{propertyId}:
 *   delete:
 *     summary: DELETE Saved Property
 *     tags: [Saved Property]
 *     parameters:
 *       - in: path
 *         name: propertyId
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
router.delete('/:propertyId', savedPropertyController.unsaveProperty);

export default router;
