import { Router } from 'express';
import * as downloadController from '@controllers/download-history.controller';
import { authenticate } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateDownloadHistoryDto } from '@/dto/download-history.dto';

const router = Router();

router.use(authenticate);

router.post('/', validateRequest({ body: CreateDownloadHistoryDto }), downloadController.logDownload);
router.get('/:id', downloadController.getDownloadById);
router.get('/user/:userId', downloadController.getUserDownloads);

export default router;
