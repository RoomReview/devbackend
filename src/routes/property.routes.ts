import { Router } from 'express';
import * as propertyController from '@controllers/property.controller';

const router = Router();

router.get('/', propertyController.getAllProperties);
router.get('/:id', propertyController.getPropertyById);
router.post('/', propertyController.createProperty);
router.put('/:id', propertyController.updateProperty);
router.delete('/:id', propertyController.deleteProperty);

export default router;
