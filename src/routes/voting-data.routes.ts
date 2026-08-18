import { Router } from 'express';
import * as votingDataController from '@controllers/voting-data.controller';

const router = Router();

router.get('/', votingDataController.getAllVotingData);
router.get('/:id', votingDataController.getVotingDataById);
router.post('/', votingDataController.createVotingData);
router.put('/:id', votingDataController.updateVotingData);
router.delete('/:id', votingDataController.deleteVotingData);

export default router;
