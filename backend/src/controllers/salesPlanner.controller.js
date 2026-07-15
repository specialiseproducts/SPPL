/**
 * Sales Planner controller
 */

import * as SalesPlannerService from '../services/salesPlanner.service.js';
import log from '../utils/logger.js';

export const listOrganizations = async (req, res, next) => {
  try {
    const data = await SalesPlannerService.listActiveOrganizations();
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('List planner organizations error:', error);
    next(error);
  }
};

export const listMonth = async (req, res, next) => {
  try {
    const year = req.query.year;
    const month = req.query.month;
    const employeeCode = req.query.employeeCode;
    log.info('Planner listMonth query params', {
      year,
      month,
      employeeCode: employeeCode || '',
      requesterEmployeeCode: req.user?.employeeCode || '',
      userId: req.user?.id || '',
    });
    const data = await SalesPlannerService.listPlannerMonth(
      req.user,
      year,
      month,
      employeeCode,
      req.effectiveRole
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('List planner month error:', error);
    next(error);
  }
};

export const getEvent = async (req, res, next) => {
  try {
    const data = await SalesPlannerService.getPlannerEvent(req.params.id, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Get planner event error:', error);
    next(error);
  }
};

export const createEvents = async (req, res, next) => {
  try {
    const data = await SalesPlannerService.createPlannerEvents(req.body || {}, req.user);
    res.status(201).json({ success: true, data });
  } catch (error) {
    log.error('Create planner events error:', error);
    next(error);
  }
};

export const updateEvent = async (req, res, next) => {
  try {
    const data = await SalesPlannerService.updatePlannerEventVisit(
      req.params.id,
      req.body || {},
      req.user,
      req.effectiveRole
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Update planner event error:', error);
    next(error);
  }
};
