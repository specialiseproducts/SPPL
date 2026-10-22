import * as PayrollTeamService from '../services/payrollTeam.service.js';
import * as PayrollLeaveService from '../services/payrollLeave.service.js';
import { DEFAULT_QUERY_LIMIT } from '../utils/dynamoPagination.js';
import log from '../utils/logger.js';

/**
 * Employee directory for Payroll Team assign/transfer UI.
 * GET /api/payroll/employees
 */
export const listPayrollEmployees = async (req, res, next) => {
  try {
    const options = {
      limit: req.query.limit ?? DEFAULT_QUERY_LIMIT,
      cursor: req.query.cursor ?? req.query.lastKey,
    };
    const result = await PayrollTeamService.listPayrollEmployeeDirectory(
      options,
      req.effectiveRole,
    );
    res.status(200).json({
      success: true,
      data: result.data,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    });
  } catch (error) {
    log.error('Payroll listPayrollEmployees error:', error);
    next(error);
  }
};

export const listTeamMappings = async (req, res, next) => {
  try {
    const data = await PayrollTeamService.listTeamMappings(req.user, req.effectiveRole);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Payroll listTeamMappings error:', error);
    next(error);
  }
};

export const assignTeamMapping = async (req, res, next) => {
  try {
    const data = await PayrollTeamService.assignTeamMapping(
      req.body || {},
      req.user,
      req.effectiveRole,
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    log.error('Payroll assignTeamMapping error:', error);
    next(error);
  }
};

export const removeTeamMapping = async (req, res, next) => {
  try {
    const data = await PayrollTeamService.removeTeamMapping(req.params.id, req.effectiveRole);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Payroll removeTeamMapping error:', error);
    next(error);
  }
};

export const transferTeamMapping = async (req, res, next) => {
  try {
    const data = await PayrollTeamService.transferTeamMapping(
      req.params.id,
      req.body || {},
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Payroll transferTeamMapping error:', error);
    next(error);
  }
};

export const listMyLeaveRequests = async (req, res, next) => {
  try {
    const data = await PayrollLeaveService.listMyLeaveRequests(req.user, req.query || {});
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Payroll listMyLeaveRequests error:', error);
    next(error);
  }
};

export const createLeaveRequest = async (req, res, next) => {
  try {
    const data = await PayrollLeaveService.createLeaveRequest(req.body || {}, req.user);
    const status = data?.duplicate ? 200 : 201;
    res.status(status).json({ success: true, data });
  } catch (error) {
    log.error('Payroll createLeaveRequest error:', error);
    next(error);
  }
};

export const updateLeaveRequest = async (req, res, next) => {
  try {
    const data = await PayrollLeaveService.updateLeaveRequest(
      req.params.id,
      req.body || {},
      req.user,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Payroll updateLeaveRequest error:', error);
    next(error);
  }
};

export const deleteLeaveRequest = async (req, res, next) => {
  try {
    const data = await PayrollLeaveService.deleteLeaveRequest(req.params.id, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Payroll deleteLeaveRequest error:', error);
    next(error);
  }
};

export const listPendingLeaveApprovals = async (req, res, next) => {
  try {
    const data = await PayrollLeaveService.listPendingLeaveApprovals(
      req.user,
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Payroll listPendingLeaveApprovals error:', error);
    next(error);
  }
};

export const listTeamMemberLeaveRequests = async (req, res, next) => {
  try {
    const data = await PayrollLeaveService.listTeamMemberLeaveRequests(
      req.params.employeeCode,
      req.user,
      req.effectiveRole,
      req.query || {},
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Payroll listTeamMemberLeaveRequests error:', error);
    next(error);
  }
};

export const approveLeaveRequest = async (req, res, next) => {
  try {
    const data = await PayrollLeaveService.approveLeaveRequest(
      req.params.id,
      req.user,
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Payroll approveLeaveRequest error:', error);
    next(error);
  }
};

export const rejectLeaveRequest = async (req, res, next) => {
  try {
    const data = await PayrollLeaveService.rejectLeaveRequest(
      req.params.id,
      req.body || {},
      req.user,
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Payroll rejectLeaveRequest error:', error);
    next(error);
  }
};
