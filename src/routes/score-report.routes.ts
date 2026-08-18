import { Router } from 'express';
import * as scoreReportController from '@/controllers/score-report.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateScoreRequestDto, ScorePreviewDto } from '@/dto/score.dto';

/**
 * @swagger
 * tags:
 *   name: ScoreReports
 *   description: Score report management and generation
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     CreateScoreRequestDto:
 *       type: object
 *       properties:
 *         boroughId:
 *           type: string
 *           format: uuid
 *         postcodeId:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *     ScorePreviewDto:
 *       type: object
 *       properties:
 *         boroughId:
 *           type: string
 *           format: uuid
 *         postcodeId:
 *           type: string
 *     ScoreReport:
 *       type: object
 *       properties:
 *         scoreReportId:
 *           type: string
 *           format: uuid
 *         boroughId:
 *           type: string
 *           format: uuid
 *         postcodeId:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         status:
 *           type: string
 *           enum: [WAITING, GENERATING, READY, FAILED]
 *         overallScore:
 *           type: number
 *         boroughScore:
 *           type: number
 *         postcodeScore:
 *           type: number
 *         scoreBreakdown:
 *           type: object
 *           additionalProperties:
 *             type: number
 *         reportData:
 *           type: object
 *           additionalProperties: true
 *         failureReason:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     ApiResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         statusCode:
 *           type: number
 *         message:
 *           type: string
 *         data:
 *           type: object
 *         error:
 *           type: string
 *     ScoreReportPreview:
 *       type: object
 *       properties:
 *         borough:
 *           type: string
 *         postcode:
 *           type: string
 *         overallScore:
 *           type: number
 *         boroughScore:
 *           type: number
 *         postcodeScore:
 *           type: number
 *         scoreBreakdown:
 *           type: object
 *           additionalProperties:
 *             type: object
 *         preview:
 *           type: object
 *           additionalProperties:
 *             type: object
 */

const router = Router();

/**
 * @swagger
 * /score-reports:
 *   post:
 *     summary: Create a score report request
 *     tags: [ScoreReports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateScoreRequestDto'
 *     responses:
 *       201:
 *         description: Score report request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  authenticate,
  authorize('manage:reports'),
  validateRequest({ body: CreateScoreRequestDto }),
  scoreReportController.createScoreReport,
);

/**
 * @swagger
 * /score-reports/preview:
 *   post:
 *     summary: Preview a score report
 *     tags: [ScoreReports]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScorePreviewDto'
 *     responses:
 *       200:
 *         description: Score report preview generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Validation error
 */
router.post('/preview', validateRequest({ body: ScorePreviewDto }), scoreReportController.previewScoreReport);

/**
 * @swagger
 * /score-reports/{id}:
 *   get:
 *     summary: Get a score report by ID
 *     tags: [ScoreReports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Score report fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: Score report not found
 */
router.get('/:id', scoreReportController.getScoreReport);

/**
 * @swagger
 * /score-reports/{id}/generate:
 *   post:
 *     summary: Start generating a score report
 *     tags: [ScoreReports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       202:
 *         description: Score report generation started
 *       404:
 *         description: Score report not found
 */
router.post('/:id/generate', authenticate, authorize('manage:reports'), scoreReportController.enqueueScoreReportGeneration);

/**
 * @swagger
 * /score-reports/{id}/pdf:
 *   get:
 *     summary: Download the generated score report PDF
 *     tags: [ScoreReports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file returned successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Score report must be READY before PDF generation
 *       404:
 *         description: Score report not found
 */
router.get('/:id/pdf', authenticate, authorize('manage:reports'), scoreReportController.getScoreReportPdf);

export default router;
