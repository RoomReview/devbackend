import { Router } from 'express';
import * as experienceController from '@controllers/experience.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateExperienceDto, UpdateExperienceDto, UpdateExperienceStatusDto } from '@/dto/experience.dto';

const router = Router();

/**
 * @swagger
 * /experiences:
 *   get:
 *     summary: GET Experience
 *     tags: [Experience]
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
router.get('/', experienceController.getAllExperiences);
/**
 * @swagger
 * /experiences/{id}:
 *   get:
 *     summary: GET Experience
 *     tags: [Experience]
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
router.get('/:id', experienceController.getExperienceById);

// Create can be anonymous or authenticated, handled inside controller
/**
 * @swagger
 * /experiences:
 *   post:
 *     summary: POST Experience
 *     tags: [Experience]
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
router.post('/', validateRequest({ body: CreateExperienceDto }), experienceController.createExperience);

/**
 * @swagger
 * /experiences/{id}:
 *   put:
 *     summary: PUT Experience
 *     tags: [Experience]
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
  validateRequest({ body: UpdateExperienceDto }),
  experienceController.updateExperience,
);

/**
 * @swagger
 * /experiences/{id}/status:
 *   patch:
 *     summary: PATCH Experience
 *     tags: [Experience]
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
router.patch(
  '/:id/status',
  authenticate,
  authorize('approve:experiences'),
  validateRequest({ body: UpdateExperienceStatusDto }),
  experienceController.updateExperienceStatus,
);

/**
 * @swagger
 * /experiences/{id}:
 *   delete:
 *     summary: DELETE Experience
 *     tags: [Experience]
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
router.delete('/:id', authenticate, experienceController.deleteExperience);

export default router;
