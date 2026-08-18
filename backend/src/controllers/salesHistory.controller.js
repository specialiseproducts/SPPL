/**
 * Sales History API controller.
 */

import * as SalesHistoryService from '../services/salesHistory.service.js';
import { normalizeRecordId } from '../models/SalesHistory.js';
import log from '../utils/logger.js';

/**
 * PK is `HIST#uuid`. A raw `#` in the URL is treated as a fragment, so params.id
 * can arrive as `HIST`. Prefer the recordId sent in the JSON body when present.
 */
function resolveHistoryRecordId(req) {
  const fromBody = normalizeRecordId(req.body?.recordId);
  if (fromBody) return fromBody;
  return normalizeRecordId(req.params.id);
}

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
    const data = await SalesHistoryService.getRecord(resolveHistoryRecordId(req), req.effectiveRole);
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
    const recordId = resolveHistoryRecordId(req);
    const body = { ...(req.body || {}) };
    delete body.recordId;
    log.info('Update sales history', recordId);
    const data = await SalesHistoryService.updateRecord(
      recordId,
      body,
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
    const data = await SalesHistoryService.deleteRecord(
      resolveHistoryRecordId(req),
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Delete sales history error:', error);
    next(error);
  }
};
