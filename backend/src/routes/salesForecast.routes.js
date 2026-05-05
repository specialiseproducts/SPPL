/**
 * Sales Forecast Routes
 * 
 * Defines all sales forecasting API endpoints.
 */

import express from 'express';
import * as SalesForecastController from '../controllers/salesForecast.controller.js';
// import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// All sales forecast routes (uncomment authenticate when auth is implemented)
// router.use(authenticate);

// Sales forecast CRUD operations
router.get('/', SalesForecastController.getSalesForecasts);
router.get('/:id', SalesForecastController.getSalesForecastById);
router.post('/', SalesForecastController.createSalesForecast);
router.put('/:id', SalesForecastController.updateSalesForecast);
router.delete('/:id', SalesForecastController.deleteSalesForecast);

export default router;


