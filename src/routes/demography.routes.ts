import { Router } from 'express';
import * as demographyController from '@controllers/demography.controller';

const router = Router();

router.get('/', demographyController.getAllDemography);
router.get('/:id', demographyController.getDemographyById);
router.post('/', demographyController.createDemography);
router.put('/:id', demographyController.updateDemography);
router.delete('/:id', demographyController.deleteDemography);

export default router;
