/**
 * Enterprise Audit Trail routes — authenticated read APIs.
 * Writes happen only via AuditTrailService.log() from modules.
 */

import express from 'express';
import * as AuditTrailController from '../controllers/auditTrail.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', AuditTrailController.listAuditTrail);
router.get('/entity/:entityType/:entityId', AuditTrailController.listEntityAuditTrail);

export default router;
