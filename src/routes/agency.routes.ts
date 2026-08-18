import { Router } from 'express';
import * as agencyController from '@controllers/agency.controller';
import { authenticate } from '@/middleware/auth.middleware';

const router = Router();

router.get('/', agencyController.getAllAgencies);
router.get('/:id', agencyController.getAgencyById);
router.post('/', authenticate, agencyController.createAgency);
router.put('/:id', authenticate, agencyController.updateAgency);
router.post('/:id/verify', authenticate, agencyController.verifyAgency);
router.delete('/:id', authenticate, agencyController.deleteAgency);
router.get('/:id/agents', authenticate, agencyController.getAgencyAgents);
router.post('/:id/agents/:agentId/verify', authenticate, agencyController.verifyAgentInAgency);

export default router;
