/**
 * Sales History API controller.
 */

import * as SalesHistoryService from '../services/salesHistory.service.js';
import log from '../utils/logger.js';

export const listSalesHistory = async (req, res, next) => {
  try {
    const result = await SalesHistoryService.listRecords(req.user, req.effectiveRole, req.query);
    res.status(200).json({
      success: true,
      data: result.data,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    });
  } catch (error) {
    log.error('List sales history error:', error);
    next(error);
  }
};

export const getSalesHistory = async (req, res, next) => {
  try {
    const data = await SalesHistoryService.getRecord(req.params.id, req.effectiveRole);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Get sales history error:', error);
    next(error);
  }
};

export const createSalesHistory = async (req, res, next) => {
  try {
    const data = await SalesHistoryService.createRecord(req.body || {}, req.user, req.effectiveRole);
    res.status(201).json({ success: true, data });
  } catch (error) {
    log.error('Create sales history error:', error);
    next(error);
  }
};

export const updateSalesHistory = async (req, res, next) => {
  try {
    const data = await SalesHistoryService.updateRecord(
      req.params.id,
      req.body || {},
      req.user,
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Update sales history error:', error);
    next(error);
  }
};

export const deleteSalesHistory = async (req, res, next) => {
  try {
    const data = await SalesHistoryService.deleteRecord(req.params.id, req.effectiveRole);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Delete sales history error:', error);
    next(error);
  }
};
