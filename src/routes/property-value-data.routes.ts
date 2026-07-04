import { Router } from 'express';
import * as valController from '@controllers/property-value-data.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreatePropertyValueDataDto, UpdatePropertyValueDataDto } from '@/dto/property-value-data.dto';

const router = Router();

/**
 * @swagger
 * /data/property-values:
 *   get:
 *     summary: GET Property Value Data
 *     tags: [Property Value Data]
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
router.get('/', valController.getAllPropertyValueData);
/**
 * @swagger
 * /data/property-values/{id}:
 *   get:
 *     summary: GET Property Value Data
 *     tags: [Property Value Data]
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
router.get('/:id', valController.getPropertyValueDataById);

/**
 * @swagger
 * /data/property-values:
 *   post:
 *     summary: POST Property Value Data
 *     tags: [Property Value Data]
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
  validateRequest({ body: CreatePropertyValueDataDto }),
  valController.createPropertyValueData,
);

/**
 * @swagger
 * /data/property-values/bulk:
 *   post:
 *     summary: POST Property Value Data
 *     tags: [Property Value Data]
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
  valController.bulkCreatePropertyValueData,
);

/**
 * @swagger
 * /data/property-values/{id}:
 *   put:
 *     summary: PUT Property Value Data
 *     tags: [Property Value Data]
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
  validateRequest({ body: UpdatePropertyValueDataDto }),
  valController.updatePropertyValueData,
);

/**
 * @swagger
 * /data/property-values/{id}:
 *   delete:
 *     summary: DELETE Property Value Data
 *     tags: [Property Value Data]
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
router.delete('/:id', authenticate, authorize('manage:locations'), valController.deletePropertyValueData);

export default router;
