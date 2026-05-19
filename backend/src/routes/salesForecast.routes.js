/**
 * Sales Forecast Routes
 */

import express from 'express';
import * as SalesForecastController from '../controllers/salesForecast.controller.js';
import { authenticateToken, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken, authorize('salesForecasting'));

router.get('/rates', SalesForecastController.getRates);
router.put('/rates', SalesForecastController.putRates);

router.get('/master-admin/:category', SalesForecastController.listMasterAdmin);
router.post('/master-admin/:category', SalesForecastController.adminAddMaster);
router.put('/master-admin/:category', SalesForecastController.adminUpdateMaster);
router.post('/master-admin/principal-map', SalesForecastController.adminUpsertPrincipal);

router.get('/master/:category', SalesForecastController.listMaster);
router.post('/master/:category/ensure', SalesForecastController.ensureMaster);

router.post('/', SalesForecastController.createOpportunity);

router.post('/:id/submit', SalesForecastController.submitOpportunity);
router.post('/:id/approve', SalesForecastController.approveOpportunity);
router.post('/:id/reject', SalesForecastController.rejectOpportunity);

router.get('/:id', SalesForecastController.getOpportunity);
router.put('/:id', SalesForecastController.updateOpportunity);
router.delete('/:id', SalesForecastController.deleteOpportunity);

router.get('/', SalesForecastController.listOpportunities);

export default router;
