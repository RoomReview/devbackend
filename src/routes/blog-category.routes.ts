import { Router } from 'express';
import * as blogCategoryController from '@controllers/blog-category.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateBlogCategoryDto, UpdateBlogCategoryDto } from '@/dto/blog-category.dto';

const router = Router();

router.get('/', blogCategoryController.getAllBlogCategories);
router.get('/:id', blogCategoryController.getBlogCategoryById);
router.get('/slug/:slug', blogCategoryController.getBlogCategoryBySlug);

router.post(
  '/',
  authenticate,
  authorize('manage:blog'),
  validateRequest({ body: CreateBlogCategoryDto }),
  blogCategoryController.createBlogCategory,
);

router.put(
  '/:id',
  authenticate,
  authorize('manage:blog'),
  validateRequest({ body: UpdateBlogCategoryDto }),
  blogCategoryController.updateBlogCategory,
);

router.delete(
  '/:id',
  authenticate,
  authorize('manage:blog'),
  blogCategoryController.deleteBlogCategory,
);

export default router;
