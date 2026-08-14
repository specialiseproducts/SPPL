/**
 * Notification Center routes — authenticated for all logged-in users.
 */

import express from 'express';
import * as NotificationController from '../controllers/notification.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', NotificationController.listNotifications);
router.get('/stream', NotificationController.streamNotifications);
router.get('/unread-count', NotificationController.unreadCount);
router.get('/settings', NotificationController.getSettings);
router.put('/settings', NotificationController.updateSettings);
router.get('/analytics', NotificationController.getAnalytics);
router.post('/mark-all-read', NotificationController.markAllRead);
router.post('/:id/read', NotificationController.markRead);
router.post('/:id/archive', NotificationController.markArchived);

export default router;
