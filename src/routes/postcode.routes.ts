import { Router } from 'express';
import * as postcodeController from '@controllers/postcode.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { PostcodeListQueryDto } from '@/dto/pagination.dto';
import { CreatePostcodeDto, UpdatePostcodeDto } from '@/dto/postcode.dto';
import { auditAdminAction } from '@/middleware/admin-audit.middleware';

const router = Router();

router.get('/', validateRequest({ query: PostcodeListQueryDto }), postcodeController.getAllPostcodes);
router.get('/code/:code', postcodeController.getPostcodeByCode);
router.get('/code/:code/report-data', postcodeController.getPostcodeReportDataByCode);
router.get('/:id', postcodeController.getPostcodeById);
router.post(
  '/',
  authenticate,
  authorize('manage:locations'),
  auditAdminAction,
  validateRequest({ body: CreatePostcodeDto }),
  postcodeController.createPostcode,
);
router.put(
  '/:id',
  authenticate,
  authorize('manage:locations'),
  auditAdminAction,
  validateRequest({ body: UpdatePostcodeDto }),
  postcodeController.updatePostcode,
);
router.delete('/:id', authenticate, authorize('manage:locations'), auditAdminAction, postcodeController.deletePostcode);

export default router;
