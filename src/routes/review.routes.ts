import { Router } from 'express';
import * as reviewController from '@controllers/review.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateReviewDto, UpdateReviewDto, UpdateReviewStatusDto } from '@/dto/review.dto';

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Property reviews and ratings
 */

const router = Router();

/**
 * @swagger
 * /reviews:
 *   get:
 *     summary: Get all reviews
 *     tags: [Reviews]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: postcodeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: boroughId
 *         schema:
 *           type: string
 *       - in: query
 *         name: authorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of reviews
 */
router.get('/', reviewController.getAllReviews);

/**
 * @swagger
 * /reviews/{id}:
 *   get:
 *     summary: Get review by ID
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review found
 */
router.get('/:id', reviewController.getReviewById);

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: Create a new review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReviewDto'
 *     responses:
 *       201:
 *         description: Review created successfully
 */
router.post(
  '/',
  authenticate,
  validateRequest({ body: CreateReviewDto }),
  reviewController.createReview,
);

/**
 * @swagger
 * /reviews/{id}:
 *   put:
 *     summary: Update review by ID
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateReviewDto'
 *     responses:
 *       200:
 *         description: Review updated successfully
 */
router.put(
  '/:id',
  authenticate,
  validateRequest({ body: UpdateReviewDto }),
  reviewController.updateReview,
);

/**
 * @swagger
 * /reviews/{id}/status:
 *   patch:
 *     summary: Update review status by ID (Admin only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateReviewStatusDto'
 *     responses:
 *       200:
 *         description: Review status updated successfully
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize('approve:reviews'),
  validateRequest({ body: UpdateReviewStatusDto }),
  reviewController.updateReviewStatus,
);

/**
 * @swagger
 * /reviews/{id}:
 *   delete:
 *     summary: Delete review by ID
 *     tags: [Reviews]
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
 *         description: Review deleted successfully
 */
router.delete('/:id', authenticate, reviewController.deleteReview);

export default router;
