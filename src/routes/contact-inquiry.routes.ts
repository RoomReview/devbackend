import { Router } from 'express';
import * as contactInquiryController from '@controllers/contact-inquiry.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateContactInquiryDto, UpdateContactInquiryStatusDto } from '@/dto/contact-inquiry.dto';

const router = Router();

// Submit inquiry is public
router.post('/', validateRequest({ body: CreateContactInquiryDto }), contactInquiryController.submitInquiry);

// Moderation routes are Admin-only
router.use(authenticate, authorize('view:users:all'));

router.get('/', contactInquiryController.getAllInquiries);
router.get('/:id', contactInquiryController.getInquiryById);
router.patch('/:id/status', validateRequest({ body: UpdateContactInquiryStatusDto }), contactInquiryController.updateInquiryStatus);
router.delete('/:id', contactInquiryController.deleteInquiry);

export default router;
