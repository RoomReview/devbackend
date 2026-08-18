import { Router } from 'express';
import * as blogPostController from '@controllers/blog-post.controller';

const router = Router();

router.get('/', blogPostController.getAllBlogPosts);
router.get('/:id', blogPostController.getBlogPostById);
router.post('/', blogPostController.createBlogPost);
router.put('/:id', blogPostController.updateBlogPost);
router.delete('/:id', blogPostController.deleteBlogPost);

export default router;
