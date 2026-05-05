/**
 * Authentication Routes
 * 
 * Defines all authentication-related API endpoints.
 */

import express from 'express';
import * as AuthController from '../controllers/auth.controller.js';
// import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refreshToken);
router.get('/verify', AuthController.verifyToken);

// Protected routes (uncomment when auth is implemented)
// router.get('/profile', authenticate, AuthController.getProfile);
// router.post('/logout', authenticate, AuthController.logout);

export default router;


