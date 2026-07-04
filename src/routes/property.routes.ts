import { Router } from 'express';
import * as propertyController from '@controllers/property.controller';
import * as propertyImageController from '@controllers/property-image.controller';
import { authenticate } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreatePropertyDto, UpdatePropertyDto } from '@/dto/property.dto';
import { CreatePropertyImageDto, UpdatePropertyImageDto } from '@/dto/property-image.dto';

/**
 * @swagger
 * tags:
 *   name: Properties
 *   description: Property listing and management
 */

const router = Router();

/**
 * @swagger
 * /properties:
 *   get:
 *     summary: Get all properties
 *     tags: [Properties]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: listingType
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: postcodeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: landlordId
 *         schema:
 *           type: string
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: bedrooms
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of properties
 */
router.get('/', propertyController.getAllProperties);

/**
 * @swagger
 * /properties/{id}:
 *   get:
 *     summary: Get property by ID
 *     tags: [Properties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property details
 */
router.get('/:id', propertyController.getPropertyById);

/**
 * @swagger
 * /properties:
 *   post:
 *     summary: Create a new property
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePropertyDto'
 *     responses:
 *       201:
 *         description: Property created successfully
 */
router.post(
  '/',
  authenticate,
  validateRequest({ body: CreatePropertyDto }),
  propertyController.createProperty,
);

/**
 * @swagger
 * /properties/{id}:
 *   put:
 *     summary: Update property by ID
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
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
 *             $ref: '#/components/schemas/UpdatePropertyDto'
 *     responses:
 *       200:
 *         description: Property updated successfully
 */
router.put(
  '/:id',
  authenticate,
  validateRequest({ body: UpdatePropertyDto }),
  propertyController.updateProperty,
);

/**
 * @swagger
 * /properties/{id}:
 *   delete:
 *     summary: Delete property by ID
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property deleted successfully
 */
router.delete('/:id', authenticate, propertyController.deleteProperty);

// Nested PropertyImage routes
/**
 * @swagger
 * /properties/{propertyId}/images:
 *   get:
 *     summary: GET Property
 *     tags: [Property]
 *     parameters:
 *       - in: path
 *         name: propertyId
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
router.get('/:propertyId/images', propertyImageController.getImagesByPropertyId);

/**
 * @swagger
 * /properties/{propertyId}/images:
 *   post:
 *     summary: POST Property
 *     tags: [Property]
 *     parameters:
 *       - in: path
 *         name: propertyId
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
  '/:propertyId/images',
  authenticate,
  validateRequest({ body: CreatePropertyImageDto }),
  propertyImageController.createImage,
);

/**
 * @swagger
 * /properties/{propertyId}/images/{imageId}:
 *   put:
 *     summary: PUT Property
 *     tags: [Property]
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: imageId
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
  '/:propertyId/images/:imageId',
  authenticate,
  validateRequest({ body: UpdatePropertyImageDto }),
  propertyImageController.updateImage,
);

/**
 * @swagger
 * /properties/{propertyId}/images/{imageId}:
 *   delete:
 *     summary: DELETE Property
 *     tags: [Property]
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: imageId
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
  '/:propertyId/images/:imageId',
  authenticate,
  propertyImageController.deleteImage,
);

export default router;
