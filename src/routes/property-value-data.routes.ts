import { Router } from 'express';
import * as propertyValueDataController from '@controllers/property-value-data.controller';

const router = Router();

router.get('/', propertyValueDataController.getAllPropertyValueData);
router.get('/:id', propertyValueDataController.getPropertyValueDataById);
router.post('/', propertyValueDataController.createPropertyValueData);
router.put('/:id', propertyValueDataController.updatePropertyValueData);
router.delete('/:id', propertyValueDataController.deletePropertyValueData);

export default router;
