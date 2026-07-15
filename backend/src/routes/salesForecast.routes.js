/**
 * Sales Forecast Routes
 */

import express from 'express';
import * as SalesForecastController from '../controllers/salesForecast.controller.js';
import * as SalesPlannerController from '../controllers/salesPlanner.controller.js';
import { authenticateToken, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken, authorize('salesForecasting'));

router.get('/planner/organizations', SalesPlannerController.listOrganizations);
router.get('/planner/events', SalesPlannerController.listMonth);
router.get('/planner/events/:id', SalesPlannerController.getEvent);
router.post('/planner/events', SalesPlannerController.createEvents);
router.put('/planner/events/:id', SalesPlannerController.updateEvent);

router.get('/bootstrap', SalesForecastController.getBootstrap);

router.get('/rates', SalesForecastController.getRates);
router.put('/rates', SalesForecastController.putRates);

router.get('/models', SalesForecastController.listModels);
router.get('/master-admin/models', SalesForecastController.listModelsAdmin);
router.post('/master-admin/models', SalesForecastController.adminUpsertModel);
router.post('/master-admin/principal-map', SalesForecastController.adminUpsertPrincipal);
router.get('/master-admin/parts', SalesForecastController.listPartsAdmin);
router.post('/master-admin/parts', SalesForecastController.adminUpsertPart);
router.post('/master-admin/organization-map', SalesForecastController.adminUpsertOrganization);

router.get('/master-admin/:category', SalesForecastController.listMasterAdmin);
router.post('/master-admin/:category', SalesForecastController.adminAddMaster);
router.put('/master-admin/:category', SalesForecastController.adminUpdateMaster);

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
