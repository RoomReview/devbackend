import { Router } from 'express';
import * as crimeDataController from '@controllers/crime-data.controller';

const router = Router();

router.get('/', crimeDataController.getAllCrimeData);
router.get('/:id', crimeDataController.getCrimeDataById);
router.post('/', crimeDataController.createCrimeData);
router.put('/:id', crimeDataController.updateCrimeData);
router.delete('/:id', crimeDataController.deleteCrimeData);

export default router;
