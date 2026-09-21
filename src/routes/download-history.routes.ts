import { Router } from 'express';
import * as downloadHistoryController from '@controllers/download-history.controller';
import { authenticate } from '@/middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, downloadHistoryController.getDownloadHistory);
router.post('/', authenticate, downloadHistoryController.createDownloadHistory);

export default router;
