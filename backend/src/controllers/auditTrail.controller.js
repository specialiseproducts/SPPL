/**
 * Audit Trail read API — append-only history; write path is AuditTrailService.log only.
 */

import * as AuditTrailService from '../services/auditTrail.service.js';
import { DEFAULT_QUERY_LIMIT } from '../utils/dynamoPagination.js';
import log from '../utils/logger.js';

export const listAuditTrail = async (req, res, next) => {
  try {
    const result = await AuditTrailService.listForUser(
      req.user,
      req.effectiveRole || req.user?.role,
      {
        module: req.query.module,
        employeeCode: req.query.employeeCode || req.query.employee,
        action: req.query.action,
        status: req.query.status,
        entityType: req.query.entityType || req.query.entity,
        entityId: req.query.entityId || req.query.referenceId,
        reference: req.query.reference || req.query.q,
        from: req.query.from || req.query.dateFrom,
        to: req.query.to || req.query.dateTo,
      },
      {
        limit: req.query.limit ?? DEFAULT_QUERY_LIMIT,
        cursor: req.query.cursor,
        sort: req.query.sort || 'newest',
      },
    );
    res.status(200).json({
      success: true,
      data: result.data,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    });
  } catch (error) {
    log.error('List audit trail error:', error);
    next(error);
  }
};

export const listEntityAuditTrail = async (req, res, next) => {
  try {
    const entityType = String(req.params.entityType || '').trim();
    const entityId = String(req.params.entityId || '').trim();
    const result = await AuditTrailService.listForEntity(
      req.user,
      req.effectiveRole || req.user?.role,
      entityType,
      entityId,
      {
        module: req.query.module,
        limit: req.query.limit ?? DEFAULT_QUERY_LIMIT,
        cursor: req.query.cursor,
        sort: req.query.sort || 'newest',
      },
    );
    res.status(200).json({
      success: true,
      data: result.data,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    });
  } catch (error) {
    log.error('List entity audit trail error:', error);
    next(error);
  }
};
