import { Router } from 'express';
import * as blogTagController from '@controllers/blog-tag.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { auditAdminAction } from '@/middleware/admin-audit.middleware';

const router = Router();

router.get('/', blogTagController.getAllBlogTags);
router.get('/:id', blogTagController.getBlogTagById);
router.post(
  '/',
  authenticate,
  authorize('manage:blog'),
  auditAdminAction,
  blogTagController.createBlogTag,
);
router.put(
  '/:id',
  authenticate,
  authorize('manage:blog'),
  auditAdminAction,
  blogTagController.updateBlogTag,
);
router.delete(
  '/:id',
  authenticate,
  authorize('manage:blog'),
  auditAdminAction,
  blogTagController.deleteBlogTag,
);

export default router;
