import { Router } from 'express';
import * as blogTagController from '@controllers/blog-tag.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateBlogTagDto, UpdateBlogTagDto } from '@/dto/blog-tag.dto';

const router = Router();

/**
 * @swagger
 * /blog/tags:
 *   get:
 *     summary: GET Blog Tag
 *     tags: [Blog Tag]
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
router.get('/', blogTagController.getAllBlogTags);
/**
 * @swagger
 * /blog/tags/{id}:
 *   get:
 *     summary: GET Blog Tag
 *     tags: [Blog Tag]
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
router.get('/:id', blogTagController.getBlogTagById);
/**
 * @swagger
 * /blog/tags/slug/{slug}:
 *   get:
 *     summary: GET Blog Tag
 *     tags: [Blog Tag]
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
router.get('/slug/:slug', blogTagController.getBlogTagBySlug);

/**
 * @swagger
 * /blog/tags:
 *   post:
 *     summary: POST Blog Tag
 *     tags: [Blog Tag]
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
  validateRequest({ body: CreateBlogTagDto }),
  blogTagController.createBlogTag,
);

/**
 * @swagger
 * /blog/tags/{id}:
 *   put:
 *     summary: PUT Blog Tag
 *     tags: [Blog Tag]
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
  validateRequest({ body: UpdateBlogTagDto }),
  blogTagController.updateBlogTag,
);

/**
 * @swagger
 * /blog/tags/{id}:
 *   delete:
 *     summary: DELETE Blog Tag
 *     tags: [Blog Tag]
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
  blogTagController.deleteBlogTag,
);

export default router;
