import { Router } from 'express';
import * as demoController from '@controllers/demography.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateDemographyDto, UpdateDemographyDto } from '@/dto/demography.dto';

const router = Router();

/**
 * @swagger
 * /data/demography:
 *   get:
 *     summary: GET Demography
 *     tags: [Demography]
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
router.get('/', demoController.getAllDemography);
/**
 * @swagger
 * /data/demography/{id}:
 *   get:
 *     summary: GET Demography
 *     tags: [Demography]
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
router.get('/:id', demoController.getDemographyById);

/**
 * @swagger
 * /data/demography:
 *   post:
 *     summary: POST Demography
 *     tags: [Demography]
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
  validateRequest({ body: CreateDemographyDto }),
  demoController.createDemography,
);

/**
 * @swagger
 * /data/demography/bulk:
 *   post:
 *     summary: POST Demography
 *     tags: [Demography]
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
  demoController.bulkCreateDemography,
);

/**
 * @swagger
 * /data/demography/{id}:
 *   put:
 *     summary: PUT Demography
 *     tags: [Demography]
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
  validateRequest({ body: UpdateDemographyDto }),
  demoController.updateDemography,
);

/**
 * @swagger
 * /data/demography/{id}:
 *   delete:
 *     summary: DELETE Demography
 *     tags: [Demography]
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
router.delete('/:id', authenticate, authorize('manage:locations'), demoController.deleteDemography);

export default router;
