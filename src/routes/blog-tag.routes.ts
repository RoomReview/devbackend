import { Router } from 'express';
import * as blogTagController from '@controllers/blog-tag.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateBlogTagDto, UpdateBlogTagDto } from '@/dto/blog-tag.dto';

const router = Router();

router.get('/', blogTagController.getAllBlogTags);
router.get('/:id', blogTagController.getBlogTagById);
router.get('/slug/:slug', blogTagController.getBlogTagBySlug);

router.post(
  '/',
  authenticate,
  authorize('manage:blog'),
  validateRequest({ body: CreateBlogTagDto }),
  blogTagController.createBlogTag,
);

router.put(
  '/:id',
  authenticate,
  authorize('manage:blog'),
  validateRequest({ body: UpdateBlogTagDto }),
  blogTagController.updateBlogTag,
);

router.delete(
  '/:id',
  authenticate,
  authorize('manage:blog'),
  blogTagController.deleteBlogTag,
);

export default router;
