import { Router } from 'express';
import * as blogCategoryController from '@controllers/blog-category.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateBlogCategoryDto, UpdateBlogCategoryDto } from '@/dto/blog-category.dto';

const router = Router();

/**
 * @swagger
 * /blog/categories:
 *   get:
 *     summary: GET Blog Category
 *     tags: [Blog Category]
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
router.get('/', blogCategoryController.getAllBlogCategories);
/**
 * @swagger
 * /blog/categories/{id}:
 *   get:
 *     summary: GET Blog Category
 *     tags: [Blog Category]
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
router.get('/:id', blogCategoryController.getBlogCategoryById);
/**
 * @swagger
 * /blog/categories/slug/{slug}:
 *   get:
 *     summary: GET Blog Category
 *     tags: [Blog Category]
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
router.get('/slug/:slug', blogCategoryController.getBlogCategoryBySlug);

/**
 * @swagger
 * /blog/categories:
 *   post:
 *     summary: POST Blog Category
 *     tags: [Blog Category]
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
  validateRequest({ body: CreateBlogCategoryDto }),
  blogCategoryController.createBlogCategory,
);

/**
 * @swagger
 * /blog/categories/{id}:
 *   put:
 *     summary: PUT Blog Category
 *     tags: [Blog Category]
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
  validateRequest({ body: UpdateBlogCategoryDto }),
  blogCategoryController.updateBlogCategory,
);

/**
 * @swagger
 * /blog/categories/{id}:
 *   delete:
 *     summary: DELETE Blog Category
 *     tags: [Blog Category]
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
  blogCategoryController.deleteBlogCategory,
);

export default router;
