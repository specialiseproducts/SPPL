/**
 * Employee Controller
 * 
 * Handles HTTP requests/responses for employee management endpoints.
 */

import * as EmployeeService from '../services/employee.service.js';
import log from '../utils/logger.js';

/**
 * Get employee by ID
 * GET /api/employees/:id
 */
export const getEmployeeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const employee = await EmployeeService.getEmployeeById(id);

    res.status(200).json({
      success: true,
      data: employee,
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
    const filters = req.query; // Extract filters from query params
    const options = {
      limit: parseInt(req.query.limit) || 50,
      lastKey: req.query.lastKey,
    };

    const result = await EmployeeService.getAllEmployees(filters, options);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    log.error('Get all employees controller error:', error);
    next(error);
  }
};

/**
 * Create new employee
 * POST /api/employees
 */
export const createEmployee = async (req, res, next) => {
  try {
    const employeeData = req.body;
    const userId = req.user?.id; // From auth middleware

    const employee = await EmployeeService.createEmployee(employeeData, userId);

    res.status(201).json({
      success: true,
      data: employee,
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
    const updateData = req.body;
    const userId = req.user?.id; // From auth middleware

    const employee = await EmployeeService.updateEmployee(id, updateData, userId);

    res.status(200).json({
      success: true,
      data: employee,
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
    const userId = req.user?.id; // From auth middleware

    await EmployeeService.deleteEmployee(id, userId);

    res.status(200).json({
      success: true,
      message: 'Employee deleted successfully',
    });
  } catch (error) {
    log.error('Delete employee controller error:', error);
    next(error);
  }
};


