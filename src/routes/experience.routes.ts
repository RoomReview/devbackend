import { Router } from 'express';
import * as experienceController from '../controllers/experience.controller';
import { authenticate } from '@/middleware/auth.middleware';

const router = Router();

router.get('/', experienceController.getAllExperiences);
router.get('/:id', experienceController.getExperienceById);
router.post('/', authenticate, experienceController.createExperience);
router.put('/:id', authenticate, experienceController.updateExperience);
router.delete('/:id', authenticate, experienceController.deleteExperience);

export default router;
