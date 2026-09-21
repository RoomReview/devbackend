import { Router } from 'express';
import * as localPlanController from '@controllers/local-plan.controller';

const router = Router();

router.get('/', localPlanController.getAllLocalPlans);
router.get('/:id', localPlanController.getLocalPlanById);
router.post('/', localPlanController.createLocalPlan);
router.put('/:id', localPlanController.updateLocalPlan);
router.delete('/:id', localPlanController.deleteLocalPlan);

export default router;
