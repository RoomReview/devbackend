import { Router } from 'express';
import * as analyticsController from '@controllers/analytics.controller';

const router = Router();

router.post('/events', analyticsController.createEvent);

export default router;
