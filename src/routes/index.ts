import { Router } from 'express';
import reviewRoutes from './review.routes';
import userRoutes from './user.routes';
import propertyRoutes from './property.routes';

const router = Router();

router.use('/reviews', reviewRoutes);
router.use('/users', userRoutes);
router.use('/properties', propertyRoutes);

export default router;
