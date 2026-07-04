import { Router } from 'express';
import * as savedPropertyController from '@controllers/saved-property.controller';
import { authenticate } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { SavePropertyDto } from '@/dto/saved-property.dto';

const router = Router();

router.use(authenticate); // Require authentication for all saved property endpoints

router.get('/', savedPropertyController.getSavedProperties);
router.post('/', validateRequest({ body: SavePropertyDto }), savedPropertyController.saveProperty);
router.delete('/:propertyId', savedPropertyController.unsaveProperty);

export default router;
