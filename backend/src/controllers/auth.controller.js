/**
 * Authentication Controller
 * 
 * Handles HTTP requests/responses for authentication endpoints.
 * Validates input, calls service layer, and returns formatted responses.
 */

import * as AuthService from '../services/auth.service.js';
import log from '../utils/logger.js';

/**
 * Login endpoint handler
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: { message: 'Username and password are required' },
      });
    }

    // Call service layer
    const result = await AuthService.login(username, password);

    // Return success response
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    log.error('Login controller error:', error);
    next(error);
  }
};

/**
 * Verify token endpoint handler
 * GET /api/auth/verify
 */
export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { message: 'Token required' },
      });
    }

    const decoded = await AuthService.verifyToken(token);

    res.status(200).json({
      success: true,
      data: decoded,
    });
  } catch (error) {
    log.error('Token verification controller error:', error);
    next(error);
  }
};

/**
 * Refresh token endpoint handler
 * POST /api/auth/refresh
 */
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: { message: 'Refresh token is required' },
      });
    }

    const result = await AuthService.refreshToken(refreshToken);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    log.error('Token refresh controller error:', error);
    next(error);
  }
};


