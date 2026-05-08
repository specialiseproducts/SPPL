/**
 * Sales Forecast Routes
 * 
 * Defines all sales forecasting API endpoints.
 */

import express from 'express';
import * as SalesForecastController from '../controllers/salesForecast.controller.js';
import { authenticateToken, authorize } from '../middleware/auth.middleware.js';
// import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken, authorize('salesForecasting'));

// Sales forecast CRUD operations
router.get('/', SalesForecastController.getSalesForecasts);
router.post('/', SalesForecastController.createSalesForecast);
router.put('/:id', SalesForecastController.updateSalesForecast);
router.delete('/:id', SalesForecastController.deleteSalesForecast);

export default router;


