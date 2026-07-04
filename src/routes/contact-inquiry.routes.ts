import { Router } from 'express';
import * as contactInquiryController from '@controllers/contact-inquiry.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateContactInquiryDto, UpdateContactInquiryStatusDto } from '@/dto/contact-inquiry.dto';

const router = Router();

// Submit inquiry is public
/**
 * @swagger
 * /contact-inquiries:
 *   post:
 *     summary: POST Contact Inquiry
 *     tags: [Contact Inquiry]
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
router.post('/', validateRequest({ body: CreateContactInquiryDto }), contactInquiryController.submitInquiry);

// Moderation routes are Admin-only
router.use(authenticate, authorize('view:users:all'));

/**
 * @swagger
 * /contact-inquiries:
 *   get:
 *     summary: GET Contact Inquiry
 *     tags: [Contact Inquiry]
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
router.get('/', contactInquiryController.getAllInquiries);
/**
 * @swagger
 * /contact-inquiries/{id}:
 *   get:
 *     summary: GET Contact Inquiry
 *     tags: [Contact Inquiry]
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
router.get('/:id', contactInquiryController.getInquiryById);
/**
 * @swagger
 * /contact-inquiries/{id}/status:
 *   patch:
 *     summary: PATCH Contact Inquiry
 *     tags: [Contact Inquiry]
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
 *             type: object
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
router.patch('/:id/status', validateRequest({ body: UpdateContactInquiryStatusDto }), contactInquiryController.updateInquiryStatus);
/**
 * @swagger
 * /contact-inquiries/{id}:
 *   delete:
 *     summary: DELETE Contact Inquiry
 *     tags: [Contact Inquiry]
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
router.delete('/:id', contactInquiryController.deleteInquiry);

export default router;
