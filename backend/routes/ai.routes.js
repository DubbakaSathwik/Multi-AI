import { Router } from 'express';
import { 
  chatWithModels,
  diagnoseGemini,
  generateConsensus,
  chooseBestResponse,
  optimizePrompt,
  createPersonaDraft,
  debateStep,
  debateSummary 
} from '../controllers/ai.controller.js';
import { validatePrompt } from '../middlewares/validation.middleware.js';

const router = Router();

router.post('/chat', validatePrompt, chatWithModels);
router.get('/diagnostics/gemini', diagnoseGemini);
router.post('/consensus', generateConsensus);
router.post('/best-response', chooseBestResponse);
router.post('/optimize', validatePrompt, optimizePrompt);
router.post('/persona', createPersonaDraft);
router.post('/debate/step', debateStep);
router.post('/debate/summary', debateSummary);

export default router;
