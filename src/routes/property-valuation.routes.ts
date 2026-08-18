import { Router } from 'express';
import * as propertyValuationController from '@controllers/property-valuation.controller';
import { authenticate } from '@/middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, propertyValuationController.getAllPropertyValuations);
router.get('/:id', authenticate, propertyValuationController.getPropertyValuationById);
router.post('/', authenticate, propertyValuationController.createPropertyValuation);

export default router;
