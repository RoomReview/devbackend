import { Router } from 'express';
import * as boroughController from '@controllers/borough.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { PaginationQueryDto } from '@/dto/pagination.dto';
import { CreateBoroughDto, UpdateBoroughDto } from '@/dto/borough.dto';
import { auditAdminAction } from '@/middleware/admin-audit.middleware';

const router = Router();

router.get('/', validateRequest({ query: PaginationQueryDto }), boroughController.getAllBoroughs);
router.get('/:id', boroughController.getBoroughById);
router.get('/slug/:slug', boroughController.getBoroughBySlug);
router.post(
  '/',
  authenticate,
  authorize('manage:locations'),
  auditAdminAction,
  validateRequest({ body: CreateBoroughDto }),
  boroughController.createBorough,
);
router.put(
  '/:id',
  authenticate,
  authorize('manage:locations'),
  auditAdminAction,
  validateRequest({ body: UpdateBoroughDto }),
  boroughController.updateBorough,
);
router.delete('/:id', authenticate, authorize('manage:locations'), auditAdminAction, boroughController.deleteBorough);

export default router;
