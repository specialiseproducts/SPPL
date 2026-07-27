/**
 * Daily Planner controller
 */

import * as DailyPlannerService from '../services/dailyPlanner.service.js';
import log from '../utils/logger.js';

export const listMyMonth = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.listMyMonth(req.user, req.query.year, req.query.month);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner listMyMonth error:', error);
    next(error);
  }
};

export const listDayTasks = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.listDayTasks(req.user, req.query.date);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner listDayTasks error:', error);
    next(error);
  }
};

export const createTask = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.createManualTask(req.body || {}, req.user);
    res.status(201).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner createTask error:', error);
    next(error);
  }
};

export const updateTask = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.updateManualTask(req.params.id, req.body || {}, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner updateTask error:', error);
    next(error);
  }
};

export const completeTask = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.markTaskCompleted(req.params.id, req.body || {}, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner completeTask error:', error);
    next(error);
  }
};

export const notCompletedTask = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.markTaskNotCompleted(req.params.id, req.body || {}, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner notCompletedTask error:', error);
    next(error);
  }
};

export const deleteTask = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.deleteManualTask(req.params.id, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner deleteTask error:', error);
    next(error);
  }
};

export const getTask = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.getTask(req.params.id, req.user, req.effectiveRole);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner getTask error:', error);
    next(error);
  }
};

export const listTeamTasks = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.listTeamTasks(req.user, req.effectiveRole, req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner listTeamTasks error:', error);
    next(error);
  }
};

export const approveTask = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.approveTask(
      req.params.id,
      req.body || {},
      req.user,
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner approveTask error:', error);
    next(error);
  }
};

export const rejectTask = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.rejectTask(
      req.params.id,
      req.body || {},
      req.user,
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner rejectTask error:', error);
    next(error);
  }
};

export const requestNeedsRevision = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.requestNeedsRevision(
      req.params.id,
      req.body || {},
      req.user,
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner requestNeedsRevision error:', error);
    next(error);
  }
};

export const verifyTaskCompletion = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.verifyTaskCompletion(
      req.params.id,
      req.body || {},
      req.user,
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner verifyTaskCompletion error:', error);
    next(error);
  }
};

export const acceptRevisionSuggestion = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.acceptRevisionSuggestion(req.params.id, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner acceptRevisionSuggestion error:', error);
    next(error);
  }
};

export const editPriority = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.editTaskPriority(
      req.params.id,
      req.body || {},
      req.user,
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner editPriority error:', error);
    next(error);
  }
};

export const listTeamMappings = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.listTeamMappings(req.user, req.effectiveRole);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner listTeamMappings error:', error);
    next(error);
  }
};

export const assignTeamMapping = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.assignTeamMapping(
      req.body || {},
      req.user,
      req.effectiveRole,
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner assignTeamMapping error:', error);
    next(error);
  }
};

export const removeTeamMapping = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.removeTeamMapping(req.params.id, req.effectiveRole);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner removeTeamMapping error:', error);
    next(error);
  }
};

export const transferTeamMapping = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.transferTeamMapping(
      req.params.id,
      req.body || {},
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner transferTeamMapping error:', error);
    next(error);
  }
};

export const getPlanningConfig = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.getPlanningConfig(req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner getPlanningConfig error:', error);
    next(error);
  }
};

export const getMyPlanningProfile = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.getMyPlanningProfile(req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner getMyPlanningProfile error:', error);
    next(error);
  }
};

export const getEmployeePlanningProfile = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.getEmployeePlanningProfile(
      req.params.employeeCode,
      req.user,
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner getEmployeePlanningProfile error:', error);
    next(error);
  }
};

export const getTeamPerformance = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.getTeamPerformance(
      req.user,
      req.effectiveRole,
      req.query,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner getTeamPerformance error:', error);
    next(error);
  }
};

export const getPlanningDashboard = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.getPlanningDashboard(req.user, req.effectiveRole);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner getPlanningDashboard error:', error);
    next(error);
  }
};

export const getManagerPlanningDashboard = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.getManagerPlanningDashboard(
      req.user,
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner getManagerPlanningDashboard error:', error);
    next(error);
  }
};

export const getPlanningHistory = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.getPlanningHistory(
      req.user,
      req.effectiveRole,
      req.query,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner getPlanningHistory error:', error);
    next(error);
  }
};

export const getPlanningReport = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.getPlanningReport(
      req.user,
      req.effectiveRole,
      req.query,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner getPlanningReport error:', error);
    next(error);
  }
};

export const getTeamPlanningHistory = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.getTeamPlanningHistory(
      req.user,
      req.effectiveRole,
      req.query,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner getTeamPlanningHistory error:', error);
    next(error);
  }
};

export const getPlanningExportPayload = async (req, res, next) => {
  try {
    const data = await DailyPlannerService.getPlanningExportPayload(
      req.user,
      req.effectiveRole,
      req.query,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Daily planner getPlanningExportPayload error:', error);
    next(error);
  }
};
