import { Router } from 'express';
import * as blogPostController from '@controllers/blog-post.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateBlogPostDto, UpdateBlogPostDto } from '@/dto/blog-post.dto';

const router = Router();

/**
 * @swagger
 * /blog/posts:
 *   get:
 *     summary: GET Blog Post
 *     tags: [Blog Post]
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.get('/', blogPostController.getAllBlogPosts);
/**
 * @swagger
 * /blog/posts/{id}:
 *   get:
 *     summary: GET Blog Post
 *     tags: [Blog Post]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', blogPostController.getBlogPostById);
/**
 * @swagger
 * /blog/posts/slug/{slug}:
 *   get:
 *     summary: GET Blog Post
 *     tags: [Blog Post]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.get('/slug/:slug', blogPostController.getBlogPostBySlug);

/**
 * @swagger
 * /blog/posts:
 *   post:
 *     summary: POST Blog Post
 *     tags: [Blog Post]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/',
  authenticate,
  authorize('manage:blog'),
  validateRequest({ body: CreateBlogPostDto }),
  blogPostController.createBlogPost,
);

/**
 * @swagger
 * /blog/posts/{id}:
 *   put:
 *     summary: PUT Blog Post
 *     tags: [Blog Post]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/:id',
  authenticate,
  authorize('manage:blog'),
  validateRequest({ body: UpdateBlogPostDto }),
  blogPostController.updateBlogPost,
);

/**
 * @swagger
 * /blog/posts/{id}:
 *   delete:
 *     summary: DELETE Blog Post
 *     tags: [Blog Post]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/:id',
  authenticate,
  authorize('manage:blog'),
  blogPostController.deleteBlogPost,
);

export default router;
