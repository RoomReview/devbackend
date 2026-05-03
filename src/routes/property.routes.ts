import { Router } from 'express';
import * as propertyController from '@controllers/property.controller';

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
 *     responses:
 *       201:
 *         description: Property created successfully
 */
router.post('/', propertyController.createProperty);

/**
 * @swagger
 * /properties/{id}:
 *   put:
 *     summary: Update property by ID
 *     tags: [Properties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property updated successfully
 */
router.put('/:id', propertyController.updateProperty);

/**
 * @swagger
 * /properties/{id}:
 *   delete:
 *     summary: Delete property by ID
 *     tags: [Properties]
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
router.delete('/:id', propertyController.deleteProperty);

export default router;
