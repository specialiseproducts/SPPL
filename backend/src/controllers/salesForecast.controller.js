/**
 * Sales Forecast Controller — opportunities, masters, rates, workflow.
 */

import * as SalesForecastService from '../services/salesForecast.service.js';
import { DEFAULT_QUERY_LIMIT } from '../utils/dynamoPagination.js';
import log from '../utils/logger.js';

export const getBootstrap = async (req, res, next) => {
  try {
    const data = await SalesForecastService.getBootstrap(req.user, req.effectiveRole);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Sales bootstrap error:', error);
    next(error);
  }
};

export const listOpportunities = async (req, res, next) => {
  try {
    const result = await SalesForecastService.listOpportunities(req.user, req.effectiveRole, {
      limit: req.query.limit ?? DEFAULT_QUERY_LIMIT,
      cursor: req.query.cursor,
    });
    res.status(200).json({
      success: true,
      data: result.data,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    });
  } catch (error) {
    log.error('List opportunities error:', error);
    next(error);
  }
};

export const getOpportunity = async (req, res, next) => {
  try {
    const row = await SalesForecastService.getOpportunity(req.params.id, req.user, req.effectiveRole);
    res.status(200).json({ success: true, data: row });
  } catch (error) {
    log.error('Get opportunity error:', error);
    next(error);
  }
};

export const createOpportunity = async (req, res, next) => {
  try {
    const row = await SalesForecastService.createOpportunity(req.body, req.user, req.effectiveRole);
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    log.error('Create opportunity error:', error);
    next(error);
  }
};

export const updateOpportunity = async (req, res, next) => {
  try {
    const row = await SalesForecastService.updateOpportunity(
      req.params.id,
      req.body,
      req.user,
      req.effectiveRole
    );
    res.status(200).json({ success: true, data: row });
  } catch (error) {
    log.error('Update opportunity error:', error);
    next(error);
  }
};

export const submitOpportunity = async (req, res, next) => {
  try {
    const row = await SalesForecastService.submitOpportunity(req.params.id, req.user, req.effectiveRole);
    res.status(200).json({ success: true, data: row });
  } catch (error) {
    log.error('Submit opportunity error:', error);
    next(error);
  }
};

export const approveOpportunity = async (req, res, next) => {
  try {
    const row = await SalesForecastService.approveOpportunity(req.params.id, req.user, req.effectiveRole);
    res.status(200).json({ success: true, data: row });
  } catch (error) {
    log.error('Approve opportunity error:', error);
    next(error);
  }
};

export const rejectOpportunity = async (req, res, next) => {
  try {
    const row = await SalesForecastService.rejectOpportunity(
      req.params.id,
      req.body,
      req.user,
      req.effectiveRole
    );
    res.status(200).json({ success: true, data: row });
  } catch (error) {
    log.error('Reject opportunity error:', error);
    next(error);
  }
};

export const deleteOpportunity = async (req, res, next) => {
  try {
    const row = await SalesForecastService.deleteOpportunity(req.params.id, req.user, req.effectiveRole);
    res.status(200).json({ success: true, data: row });
  } catch (error) {
    log.error('Delete opportunity error:', error);
    next(error);
  }
};

export const listMaster = async (req, res, next) => {
  try {
    const data = await SalesForecastService.listMasterCategory(req.params.category);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('List master error:', error);
    next(error);
  }
};

export const ensureMaster = async (req, res, next) => {
  try {
    const { value } = req.body || {};
    const result = await SalesForecastService.ensureMasterCategoryValue(req.params.category, value, req.effectiveRole);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    log.error('Ensure master error:', error);
    next(error);
  }
};

export const listMasterAdmin = async (req, res, next) => {
  try {
    const data = await SalesForecastService.listMasterAdminCategory(req.params.category, req.effectiveRole);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('List master admin error:', error);
    next(error);
  }
};

export const adminAddMaster = async (req, res, next) => {
  try {
    const { value } = req.body || {};
    const data = await SalesForecastService.adminAddMasterListItem(req.params.category, value, req.effectiveRole);
    res.status(201).json({ success: true, data });
  } catch (error) {
    log.error('Admin add master error:', error);
    next(error);
  }
};

export const adminUpdateMaster = async (req, res, next) => {
  try {
    const { sk, value, isActive } = req.body || {};
    const data = await SalesForecastService.adminUpdateMasterListItem(
      req.params.category,
      sk,
      { value, isActive },
      req.effectiveRole
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Admin update master error:', error);
    next(error);
  }
};

export const adminUpsertPrincipal = async (req, res, next) => {
  try {
    const data = await SalesForecastService.adminUpsertPrincipalMap(req.body || {}, req.effectiveRole);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Admin upsert principal error:', error);
    next(error);
  }
};

export const listModels = async (req, res, next) => {
  try {
    const principalId = req.query.principalId;
    const activeOnly = req.query.activeOnly !== 'false';
    const data = await SalesForecastService.listPrincipalModels(principalId, { activeOnly });
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('List principal models error:', error);
    next(error);
  }
};

export const listModelsAdmin = async (req, res, next) => {
  try {
    const principalId = req.query.principalId;
    const data = await SalesForecastService.listPrincipalModelsAdmin(principalId, req.effectiveRole);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('List principal models admin error:', error);
    next(error);
  }
};

export const adminUpsertModel = async (req, res, next) => {
  try {
    const data = await SalesForecastService.adminUpsertPrincipalModel(req.body || {}, req.effectiveRole);
    res.status(201).json({ success: true, data });
  } catch (error) {
    log.error('Admin upsert model error:', error);
    next(error);
  }
};

export const getRates = async (req, res, next) => {
  try {
    const data = await SalesForecastService.getExchangeRatesForSales();
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Get sales rates error:', error);
    next(error);
  }
};

export const putRates = async (req, res, next) => {
  try {
    const data = await SalesForecastService.saveExchangeRatesForSales(req.body || {}, req.effectiveRole);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Put sales rates error:', error);
    next(error);
  }
};
