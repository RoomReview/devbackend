import { Router } from 'express';
import * as seoController from '@controllers/seo.controller';

const router = Router();

router.get('/sitemap-data', seoController.getSitemapData);

export default router;
