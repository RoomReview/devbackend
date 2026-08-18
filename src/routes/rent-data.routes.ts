import { Router } from 'express';
import * as rentDataController from '@controllers/rent-data.controller';

const router = Router();

router.get('/', rentDataController.getAllRentData);
router.get('/:id', rentDataController.getRentDataById);
router.post('/', rentDataController.createRentData);
router.put('/:id', rentDataController.updateRentData);
router.delete('/:id', rentDataController.deleteRentData);

export default router;
