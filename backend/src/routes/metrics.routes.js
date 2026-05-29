import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import * as MetricsController from '../controllers/metrics.controller.js';

const router = express.Router();

router.get('/', authenticateToken, MetricsController.getMetrics);
router.post('/frontend-events', authenticateToken, MetricsController.ingestFrontendEvents);

export default router;
