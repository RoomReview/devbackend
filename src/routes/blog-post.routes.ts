import { Router } from 'express';
import * as blogPostController from '@controllers/blog-post.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateBlogPostDto, UpdateBlogPostDto } from '@/dto/blog-post.dto';

const router = Router();

router.get('/', blogPostController.getAllBlogPosts);
router.get('/:id', blogPostController.getBlogPostById);
router.get('/slug/:slug', blogPostController.getBlogPostBySlug);

router.post(
  '/',
  authenticate,
  authorize('manage:blog'),
  validateRequest({ body: CreateBlogPostDto }),
  blogPostController.createBlogPost,
);

router.put(
  '/:id',
  authenticate,
  authorize('manage:blog'),
  validateRequest({ body: UpdateBlogPostDto }),
  blogPostController.updateBlogPost,
);

router.delete(
  '/:id',
  authenticate,
  authorize('manage:blog'),
  blogPostController.deleteBlogPost,
);

export default router;
