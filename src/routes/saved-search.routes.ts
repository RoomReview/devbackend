import { Router } from 'express';
import * as savedSearchController from '../controllers/saved-search.controller';
import { authenticate } from '@middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, savedSearchController.listSavedSearches);
router.post('/', authenticate, savedSearchController.saveSearch);
router.delete('/:savedSearchId', authenticate, savedSearchController.removeSavedSearch);

export default router;
