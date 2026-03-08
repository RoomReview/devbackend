import { Router } from 'express';
import reviewRoutes from './review.routes';
import userRoutes from './user.routes';
import propertyRoutes from './property.routes';
import authRoutes from './auth.routes';
import { errorHandler, notFoundHandler } from '@middleware/error.middleware';

const router = Router();

router.use('/reviews', reviewRoutes);
router.use('/users', userRoutes);
router.use('/properties', propertyRoutes);
router.use('/auth', authRoutes);
router.use(notFoundHandler);
router.use(errorHandler);

export default router;
