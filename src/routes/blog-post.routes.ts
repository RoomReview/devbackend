import { Router } from 'express';
import * as blogPostController from '@controllers/blog-post.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { auditAdminAction } from '@/middleware/admin-audit.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { BlogPostIdParamsDto, CreateBlogPostDto } from '@/dto/blog-post.dto';

const router = Router();

router.get('/', blogPostController.getAllBlogPosts);
router.get('/slug/:slug', blogPostController.getBlogPostBySlug);
router.get('/:id', blogPostController.getBlogPostById);
router.post(
  '/',
  authenticate,
  authorize('create:blog'),
  auditAdminAction,
  validateRequest({ body: CreateBlogPostDto }),
  blogPostController.createBlogPost,
);
router.put(
  '/:id',
  authenticate,
  authorize('manage:blog'),
  auditAdminAction,
  validateRequest({
    params: BlogPostIdParamsDto,
    body: CreateBlogPostDto,
  }),
  blogPostController.updateBlogPost,
);
router.delete(
  '/:id',
  authenticate,
  authorize('manage:blog'),
  auditAdminAction,
  validateRequest({ params: BlogPostIdParamsDto }),
  blogPostController.deleteBlogPost,
);
router.patch(
  '/:id/publish',
  authenticate,
  authorize('publish:blog'),
  auditAdminAction,
  validateRequest({ params: BlogPostIdParamsDto }),
  blogPostController.publishBlogPost,
);

export default router;
