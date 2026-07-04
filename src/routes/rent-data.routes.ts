import { Router } from 'express';
import * as rentController from '@controllers/rent-data.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateRentDataDto, UpdateRentDataDto } from '@/dto/rent-data.dto';

const router = Router();

/**
 * @swagger
 * /data/rent:
 *   get:
 *     summary: GET Rent Data
 *     tags: [Rent Data]
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
router.get('/', rentController.getAllRentData);
/**
 * @swagger
 * /data/rent/{id}:
 *   get:
 *     summary: GET Rent Data
 *     tags: [Rent Data]
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
router.get('/:id', rentController.getRentDataById);

/**
 * @swagger
 * /data/rent:
 *   post:
 *     summary: POST Rent Data
 *     tags: [Rent Data]
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
  validateRequest({ body: CreateRentDataDto }),
  rentController.createRentData,
);

/**
 * @swagger
 * /data/rent/bulk:
 *   post:
 *     summary: POST Rent Data
 *     tags: [Rent Data]
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
  rentController.bulkCreateRentData,
);

/**
 * @swagger
 * /data/rent/{id}:
 *   put:
 *     summary: PUT Rent Data
 *     tags: [Rent Data]
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
  validateRequest({ body: UpdateRentDataDto }),
  rentController.updateRentData,
);

/**
 * @swagger
 * /data/rent/{id}:
 *   delete:
 *     summary: DELETE Rent Data
 *     tags: [Rent Data]
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
router.delete('/:id', authenticate, authorize('manage:locations'), rentController.deleteRentData);

export default router;
