import { Router } from 'express';
import * as valuationController from '@controllers/property-valuation.controller';
import { authenticate } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreatePropertyValuationDto } from '@/dto/property-valuation.dto';

const router = Router();

router.use(authenticate);

router.post('/', validateRequest({ body: CreatePropertyValuationDto }), valuationController.logValuation);
router.get('/:id', valuationController.getValuationById);
router.get('/user/:userId', valuationController.getUserValuations);

export default router;
