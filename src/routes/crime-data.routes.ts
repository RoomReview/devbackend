import { Router } from 'express';
import * as crimeController from '@controllers/crime-data.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateCrimeDataDto, UpdateCrimeDataDto } from '@/dto/crime-data.dto';

const router = Router();

/**
 * @swagger
 * /data/crime:
 *   get:
 *     summary: GET Crime Data
 *     tags: [Crime Data]
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
router.get('/', crimeController.getAllCrimeData);
/**
 * @swagger
 * /data/crime/{id}:
 *   get:
 *     summary: GET Crime Data
 *     tags: [Crime Data]
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
router.get('/:id', crimeController.getCrimeDataById);

/**
 * @swagger
 * /data/crime:
 *   post:
 *     summary: POST Crime Data
 *     tags: [Crime Data]
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
  validateRequest({ body: CreateCrimeDataDto }),
  crimeController.createCrimeData,
);

/**
 * @swagger
 * /data/crime/bulk:
 *   post:
 *     summary: POST Crime Data
 *     tags: [Crime Data]
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
  '/bulk',
  authenticate,
  authorize('manage:locations'),
  crimeController.bulkCreateCrimeData,
);

/**
 * @swagger
 * /data/crime/{id}:
 *   put:
 *     summary: PUT Crime Data
 *     tags: [Crime Data]
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
  validateRequest({ body: UpdateCrimeDataDto }),
  crimeController.updateCrimeData,
);

/**
 * @swagger
 * /data/crime/{id}:
 *   delete:
 *     summary: DELETE Crime Data
 *     tags: [Crime Data]
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
router.delete('/:id', authenticate, authorize('manage:locations'), crimeController.deleteCrimeData);

export default router;
