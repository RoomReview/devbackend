import { Router } from 'express';
import * as postcodeController from '@controllers/postcode.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreatePostcodeDto, UpdatePostcodeDto } from '@/dto/postcode.dto';

const router = Router();

router.get('/', postcodeController.getAllPostcodes);
router.get('/:id', postcodeController.getPostcodeById);
router.get('/code/:code', postcodeController.getPostcodeByCode);

router.post(
  '/',
  authenticate,
  authorize('manage:locations'),
  validateRequest({ body: CreatePostcodeDto }),
  postcodeController.createPostcode,
);

router.put(
  '/:id',
  authenticate,
  authorize('manage:locations'),
  validateRequest({ body: UpdatePostcodeDto }),
  postcodeController.updatePostcode,
);

router.delete(
  '/:id',
  authenticate,
  authorize('manage:locations'),
  postcodeController.deletePostcode,
);

export default router;
