/**
 * Employee Controller
 *
 * Handles HTTP requests/responses for employee management endpoints.
 */

import * as EmployeeService from '../services/employee.service.js';
import { DEFAULT_QUERY_LIMIT } from '../utils/dynamoPagination.js';
import log from '../utils/logger.js';

function sanitizeEmployee(row) {
  if (!row || typeof row !== 'object') return row;
  const clone = { ...row };
  delete clone.password;
  delete clone.temporaryPassword;
  return clone;
}

function mergeUploadedFileUrls(files, target) {
  if (!files) return;
  if (files.documents?.[0]?.location) {
    target.documentsUrl = files.documents[0].location;
  }
  if (files.pastExperience?.[0]?.location) {
    target.pastExperienceUrl = files.pastExperience[0].location;
  }
  if (files.profilePhoto?.[0]?.location) {
    target.profilePhotoUrl = files.profilePhoto[0].location;
  }
}

/**
 * Get employee by ID
 * GET /api/employees/:id
 */
export const getEmployeeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const employee = await EmployeeService.getEmployeeById(id, req.user, req.effectiveRole);

    res.status(200).json({
      success: true,
      data: sanitizeEmployee(employee),
    });
  } catch (error) {
    log.error('Get employee controller error:', error);
    next(error);
  }
};

/**
 * Get all employees
 * GET /api/employees
 */
export const getAllEmployees = async (req, res, next) => {
  try {
    const filters = req.query;
    const options = {
      limit: req.query.limit ?? DEFAULT_QUERY_LIMIT,
      cursor: req.query.cursor ?? req.query.lastKey,
    };

    const result = await EmployeeService.getAllEmployees(filters, options, req.user, req.effectiveRole);
    const sanitizedItems = (result?.data || []).map(sanitizeEmployee);

    res.status(200).json({
      success: true,
      data: sanitizedItems,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    });
  } catch (error) {
    log.error('Get all employees controller error:', error);
    next(error);
  }
};

/**
 * Create new employee
 * POST /api/employees (multipart or JSON)
 */
export const createEmployee = async (req, res, next) => {
  try {
    const employeeData = { ...req.body };
    mergeUploadedFileUrls(req.files, employeeData);

    const authUser = req.user;
    const employee = await EmployeeService.createEmployee(employeeData, authUser);

    res.status(201).json({
      success: true,
      data: sanitizeEmployee(employee),
    });
  } catch (error) {
    log.error('Create employee controller error:', error);
    next(error);
  }
};

/**
 * Update employee
 * PUT /api/employees/:id
 */
export const updateEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    mergeUploadedFileUrls(req.files, updateData);

    const userId = req.user?.id;
    const employee = await EmployeeService.updateEmployee(id, updateData, userId, req.user, req.effectiveRole);

    res.status(200).json({
      success: true,
      data: sanitizeEmployee(employee),
    });
  } catch (error) {
    log.error('Update employee controller error:', error);
    next(error);
  }
};

/**
 * Delete employee
 * DELETE /api/employees/:id
 */
export const deleteEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    await EmployeeService.deleteEmployee(id, userId, req.user, req.effectiveRole);

    res.status(200).json({
      success: true,
      message: 'Employee deleted successfully',
    });
  } catch (error) {
    log.error('Delete employee controller error:', error);
    next(error);
  }
};
