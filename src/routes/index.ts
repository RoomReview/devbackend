import { Router } from 'express';
import reviewRoutes from './review.routes';
import userRoutes from './user.routes';
import propertyRoutes from './property.routes';
import authRoutes from './auth.routes';
import ssoRoutes from './sso.routes';
import boroughRoutes from './borough.routes';
import postcodeRoutes from './postcode.routes';
import savedPropertyRoutes from './saved-property.routes';
import experienceRoutes from './experience.routes';
import blogCategoryRoutes from './blog-category.routes';
import blogTagRoutes from './blog-tag.routes';
import blogPostRoutes from './blog-post.routes';
import newsletterRoutes from './newsletter.routes';
import contactInquiryRoutes from './contact-inquiry.routes';
import { errorHandler, notFoundHandler } from '@middleware/error.middleware';

const router = Router();

router.use('/reviews', reviewRoutes);
router.use('/users', userRoutes);
router.use('/properties', propertyRoutes);
router.use('/auth', authRoutes);
router.use('/sso', ssoRoutes);
router.use('/boroughs', boroughRoutes);
router.use('/postcodes', postcodeRoutes);
router.use('/saved-properties', savedPropertyRoutes);
router.use('/experiences', experienceRoutes);
router.use('/blog/categories', blogCategoryRoutes);
router.use('/blog/tags', blogTagRoutes);
router.use('/blog/posts', blogPostRoutes);
router.use('/newsletter', newsletterRoutes);
router.use('/contact-inquiries', contactInquiryRoutes);
router.use(notFoundHandler);
router.use(errorHandler);

export default router;
