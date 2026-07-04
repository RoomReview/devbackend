import { Router } from 'express';
import * as votingController from '@controllers/voting-data.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateVotingDataDto, UpdateVotingDataDto } from '@/dto/voting-data.dto';

const router = Router();

router.get('/', votingController.getAllVotingData);
router.get('/:id', votingController.getVotingDataById);

// Admin-only updates
router.post(
  '/',
  authenticate,
  authorize('manage:locations'),
  validateRequest({ body: CreateVotingDataDto }),
  votingController.createVotingData,
);

router.put(
  '/:id',
  authenticate,
  authorize('manage:locations'),
  validateRequest({ body: UpdateVotingDataDto }),
  votingController.updateVotingData,
);

router.delete('/:id', authenticate, authorize('manage:locations'), votingController.deleteVotingData);

export default router;
