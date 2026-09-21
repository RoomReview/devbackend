import { Router } from 'express';
import * as blogTagController from '@controllers/blog-tag.controller';

const router = Router();

router.get('/', blogTagController.getAllBlogTags);
router.get('/:id', blogTagController.getBlogTagById);
router.post('/', blogTagController.createBlogTag);
router.put('/:id', blogTagController.updateBlogTag);
router.delete('/:id', blogTagController.deleteBlogTag);

export default router;
