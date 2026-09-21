import { Router } from 'express';
import * as contactInquiryController from '@controllers/contact-inquiry.controller';

const router = Router();

router.get('/', contactInquiryController.getAllContactInquiries);
router.get('/:id', contactInquiryController.getContactInquiryById);
router.post('/', contactInquiryController.createContactInquiry);
router.put('/:id', contactInquiryController.updateContactInquiry);
router.delete('/:id', contactInquiryController.deleteContactInquiry);

export default router;
