import { Router } from 'express';
import * as savedPropertyController from '../controllers/saved-property.controller';
import { authenticate } from '@middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, savedPropertyController.getSavedProperties);
router.post('/:propertyId', authenticate, savedPropertyController.saveProperty);
router.delete('/:propertyId', authenticate, savedPropertyController.removeSavedProperty);

export default router;
