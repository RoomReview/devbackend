import { Router } from 'express';
import { email, object, string, uuid } from 'zod';
import * as teamController from '@/controllers/team.controller';
import { authenticate } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';

const router = Router();

router.get('/', authenticate, teamController.getTeam);
router.post(
  '/invitations',
  authenticate,
  validateRequest({ body: object({ email: email().max(254) }) }),
  teamController.createInvitation,
);
router.get(
  '/invitations/:token',
  validateRequest({ params: object({ token: string().regex(/^[A-Za-z0-9_-]{43}$/) }) }),
  teamController.getInvitationDetails,
);
router.post(
  '/invitations/accept',
  authenticate,
  validateRequest({ body: object({ token: string().regex(/^[A-Za-z0-9_-]{43}$/) }) }),
  teamController.acceptInvitation,
);
router.delete(
  '/invitations/:invitationId',
  authenticate,
  validateRequest({ params: object({ invitationId: uuid() }) }),
  teamController.revokeInvitation,
);
router.delete(
  '/members/:userId',
  authenticate,
  validateRequest({ params: object({ userId: uuid() }) }),
  teamController.removeMember,
);

export default router;
