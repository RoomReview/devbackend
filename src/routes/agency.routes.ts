import { Router } from 'express';
import * as agencyController from '@controllers/agency.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateAgencyDto, UpdateAgencyDto, VerifyAgencyDto } from '@/dto/agency.dto';

const router = Router();

/**
 * @swagger
 * /agencies:
 *   get:
 *     summary: GET Agency
 *     tags: [Agency]
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
router.get('/', agencyController.getAllAgencies);
/**
 * @swagger
 * /agencies/{id}:
 *   get:
 *     summary: GET Agency
 *     tags: [Agency]
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
router.get('/:id', agencyController.getAgencyById);

// Create and update profiles require authentication
/**
 * @swagger
 * /agencies:
 *   post:
 *     summary: POST Agency
 *     tags: [Agency]
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
router.post('/', authenticate, validateRequest({ body: CreateAgencyDto }), agencyController.createAgency);
/**
 * @swagger
 * /agencies/{id}:
 *   put:
 *     summary: PUT Agency
 *     tags: [Agency]
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
router.put('/:id', authenticate, validateRequest({ body: UpdateAgencyDto }), agencyController.updateAgency);

// Verification and deletion are Admin-only
/**
 * @swagger
 * /agencies/{id}/verify:
 *   patch:
 *     summary: PATCH Agency
 *     tags: [Agency]
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
  '/:id/verify',
  authenticate,
  authorize('manage:agencies'),
  validateRequest({ body: VerifyAgencyDto }),
  agencyController.verifyAgency,
);

/**
 * @swagger
 * /agencies/{id}:
 *   delete:
 *     summary: DELETE Agency
 *     tags: [Agency]
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
router.delete('/:id', authenticate, authorize('manage:agencies'), agencyController.deleteAgency);

// Agent linkages
/**
 * @swagger
 * /agencies/{id}/agents:
 *   get:
 *     summary: GET Agency
 *     tags: [Agency]
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
router.get('/:id/agents', authenticate, agencyController.getAgencyAgents);
/**
 * @swagger
 * /agencies/{id}/agents/{agentId}/verify:
 *   patch:
 *     summary: PATCH Agency
 *     tags: [Agency]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: agentId
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
  '/:id/agents/:agentId/verify',
  authenticate,
  authorize('manage:agencies'),
  agencyController.verifyAgentInAgency,
);

export default router;
