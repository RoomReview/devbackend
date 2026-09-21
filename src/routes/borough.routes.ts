import { Router } from 'express';
import * as boroughController from '@controllers/borough.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { PaginationQueryDto } from '@/dto/pagination.dto';
import { CreateBoroughDto, UpdateBoroughDto } from '@/dto/borough.dto';

const router = Router();

router.get('/', validateRequest({ query: PaginationQueryDto }), boroughController.getAllBoroughs);
router.get('/:id', boroughController.getBoroughById);
router.get('/slug/:slug', boroughController.getBoroughBySlug);
router.post(
  '/',
  authenticate,
  authorize('manage:locations'),
  validateRequest({ body: CreateBoroughDto }),
  boroughController.createBorough,
);
router.put(
  '/:id',
  authenticate,
  authorize('manage:locations'),
  validateRequest({ body: UpdateBoroughDto }),
  boroughController.updateBorough,
);
router.delete('/:id', authenticate, authorize('manage:locations'), boroughController.deleteBorough);

export default router;
