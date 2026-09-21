import { Router } from 'express';
import * as postcodeDataController from '@controllers/postcode-data.controller';

const router = Router();

router.get('/:code', postcodeDataController.getPostcodeDataByCode);

export default router;
