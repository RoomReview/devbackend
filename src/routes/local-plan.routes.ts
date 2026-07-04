import { Router } from 'express';
import * as planController from '@controllers/local-plan.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateLocalPlanDto, UpdateLocalPlanDto } from '@/dto/local-plan.dto';

const router = Router();

/**
 * @swagger
 * /local-plans:
 *   get:
 *     summary: GET Local Plan
 *     tags: [Local Plan]
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
router.get('/', planController.getAllLocalPlans);
/**
 * @swagger
 * /local-plans/{id}:
 *   get:
 *     summary: GET Local Plan
 *     tags: [Local Plan]
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
router.get('/:id', planController.getLocalPlanById);

// Admin-only updates
/**
 * @swagger
 * /local-plans:
 *   post:
 *     summary: POST Local Plan
 *     tags: [Local Plan]
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
router.post(
  '/',
  authenticate,
  authorize('manage:locations'),
  validateRequest({ body: CreateLocalPlanDto }),
  planController.createLocalPlan,
);

/**
 * @swagger
 * /local-plans/{id}:
 *   put:
 *     summary: PUT Local Plan
 *     tags: [Local Plan]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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
router.put(
  '/:id',
  authenticate,
  authorize('manage:locations'),
  validateRequest({ body: UpdateLocalPlanDto }),
  planController.updateLocalPlan,
);

/**
 * @swagger
 * /local-plans/{id}:
 *   delete:
 *     summary: DELETE Local Plan
 *     tags: [Local Plan]
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
router.delete('/:id', authenticate, authorize('manage:locations'), planController.deleteLocalPlan);

export default router;
