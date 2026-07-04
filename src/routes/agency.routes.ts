import { Router } from 'express';
import * as agencyController from '@controllers/agency.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateAgencyDto, UpdateAgencyDto, VerifyAgencyDto } from '@/dto/agency.dto';

const router = Router();

router.get('/', agencyController.getAllAgencies);
router.get('/:id', agencyController.getAgencyById);

// Create and update profiles require authentication
router.post('/', authenticate, validateRequest({ body: CreateAgencyDto }), agencyController.createAgency);
router.put('/:id', authenticate, validateRequest({ body: UpdateAgencyDto }), agencyController.updateAgency);

// Verification and deletion are Admin-only
router.patch(
  '/:id/verify',
  authenticate,
  authorize('manage:agencies'),
  validateRequest({ body: VerifyAgencyDto }),
  agencyController.verifyAgency,
);

router.delete('/:id', authenticate, authorize('manage:agencies'), agencyController.deleteAgency);

// Agent linkages
router.get('/:id/agents', authenticate, agencyController.getAgencyAgents);
router.patch(
  '/:id/agents/:agentId/verify',
  authenticate,
  authorize('manage:agencies'),
  agencyController.verifyAgentInAgency,
);

export default router;
