/**
 * Expense Controller
 * 
 * Handles HTTP requests/responses for expense management endpoints.
 */

import * as ExpenseService from '../services/expense.service.js';
import log from '../utils/logger.js';

/**
 * Get expense by ID
 * GET /api/expenses/:id
 */
export const getExpenseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const expense = await ExpenseService.getExpenseById(id);

    res.status(200).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    log.error('Get expense controller error:', error);
    next(error);
  }
};

/**
 * Get all expenses
 * GET /api/expenses
 */
export const getExpenses = async (req, res, next) => {
  try {
    const filters = req.query;
    const options = {
      limit: parseInt(req.query.limit) || 50,
      lastKey: req.query.lastKey,
    };

    const result = await ExpenseService.getExpenses(filters, options);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    log.error('Get expenses controller error:', error);
    next(error);
  }
};

/**
 * Create new expense
 * POST /api/expenses
 */
export const createExpense = async (req, res, next) => {
  try {
    const expenseData = req.body;
    const userId = req.user?.id; // From auth middleware

    const expense = await ExpenseService.createExpense(expenseData, userId);

    res.status(201).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    log.error('Create expense controller error:', error);
    next(error);
  }
};

/**
 * Update expense
 * PUT /api/expenses/:id
 */
export const updateExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user?.id; // From auth middleware

    const expense = await ExpenseService.updateExpense(id, updateData, userId);

    res.status(200).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    log.error('Update expense controller error:', error);
    next(error);
  }
};

/**
 * Delete expense
 * DELETE /api/expenses/:id
 */
export const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id; // From auth middleware

    await ExpenseService.deleteExpense(id, userId);

    res.status(200).json({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error) {
    log.error('Delete expense controller error:', error);
    next(error);
  }
};


