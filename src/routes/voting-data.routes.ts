import { Router } from 'express';
import * as votingController from '@controllers/voting-data.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateVotingDataDto, UpdateVotingDataDto } from '@/dto/voting-data.dto';

const router = Router();

/**
 * @swagger
 * /data/voting:
 *   get:
 *     summary: GET Voting Data
 *     tags: [Voting Data]
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
router.get('/', votingController.getAllVotingData);
/**
 * @swagger
 * /data/voting/{id}:
 *   get:
 *     summary: GET Voting Data
 *     tags: [Voting Data]
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
router.get('/:id', votingController.getVotingDataById);

/**
 * @swagger
 * /data/voting:
 *   post:
 *     summary: POST Voting Data
 *     tags: [Voting Data]
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
  validateRequest({ body: CreateVotingDataDto }),
  votingController.createVotingData,
);

/**
 * @swagger
 * /data/voting/bulk:
 *   post:
 *     summary: POST Voting Data
 *     tags: [Voting Data]
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
  votingController.bulkCreateVotingData,
);

/**
 * @swagger
 * /data/voting/{id}:
 *   put:
 *     summary: PUT Voting Data
 *     tags: [Voting Data]
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
  validateRequest({ body: UpdateVotingDataDto }),
  votingController.updateVotingData,
);

/**
 * @swagger
 * /data/voting/{id}:
 *   delete:
 *     summary: DELETE Voting Data
 *     tags: [Voting Data]
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
router.delete('/:id', authenticate, authorize('manage:locations'), votingController.deleteVotingData);

export default router;
