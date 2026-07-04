import { Router } from 'express';
import * as boroughController from '@controllers/borough.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateBoroughDto, UpdateBoroughDto } from '@/dto/borough.dto';

const router = Router();

/**
 * @swagger
 * /boroughs:
 *   get:
 *     summary: GET Borough
 *     tags: [Borough]
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
router.get('/', boroughController.getAllBoroughs);
/**
 * @swagger
 * /boroughs/{id}:
 *   get:
 *     summary: GET Borough
 *     tags: [Borough]
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
router.get('/:id', boroughController.getBoroughById);
/**
 * @swagger
 * /boroughs/slug/{slug}:
 *   get:
 *     summary: GET Borough
 *     tags: [Borough]
 *     parameters:
 *       - in: path
 *         name: slug
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
router.get('/slug/:slug', boroughController.getBoroughBySlug);

/**
 * @swagger
 * /boroughs:
 *   post:
 *     summary: POST Borough
 *     tags: [Borough]
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
  validateRequest({ body: CreateBoroughDto }),
  boroughController.createBorough,
);

/**
 * @swagger
 * /boroughs/{id}:
 *   put:
 *     summary: PUT Borough
 *     tags: [Borough]
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
  validateRequest({ body: UpdateBoroughDto }),
  boroughController.updateBorough,
);

/**
 * @swagger
 * /boroughs/{id}:
 *   delete:
 *     summary: DELETE Borough
 *     tags: [Borough]
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
router.delete(
  '/:id',
  authenticate,
  authorize('manage:locations'),
  boroughController.deleteBorough,
);

export default router;
