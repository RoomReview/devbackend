import { Router } from 'express';
import * as downloadController from '@controllers/download-history.controller';
import { authenticate } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateDownloadHistoryDto } from '@/dto/download-history.dto';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /downloads:
 *   post:
 *     summary: POST Download History
 *     tags: [Download History]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.post('/', validateRequest({ body: CreateDownloadHistoryDto }), downloadController.logDownload);
/**
 * @swagger
 * /downloads/{id}:
 *   get:
 *     summary: GET Download History
 *     tags: [Download History]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', downloadController.getDownloadById);
/**
 * @swagger
 * /downloads/user/{userId}:
 *   get:
 *     summary: GET Download History
 *     tags: [Download History]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.get('/user/:userId', downloadController.getUserDownloads);

export default router;
