/**
 * Expense Controller
 * 
 * Handles HTTP requests/responses for expense management endpoints.
 */

import * as ExpenseService from '../services/expense.service.js';
import log from '../utils/logger.js';

/**
 * Normalize `:id` route param (handles EXP#… and URL-encoded / double-encoded forms).
 */
function decodeExpenseRouteId(rawId) {
  let id = rawId == null ? '' : String(rawId);
  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(id);
      if (decoded === id) {
        break;
      }
      id = decoded;
    } catch {
      break;
    }
  }
  return id;
}

/**
 * Get expense by ID
 * GET /api/expenses/:id
 */
export const getExpenseById = async (req, res, next) => {
  try {
    const id = decodeExpenseRouteId(req.params.id);
    const expense = await ExpenseService.getExpenseById(id, req.user, req.effectiveRole);

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

    const result = await ExpenseService.getExpenses(filters, options, req.user, req.effectiveRole);

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
    const authUser = req.user;
    const file = req.file;

    log.info('Create expense: multipart fields', {
      keys: expenseData && typeof expenseData === 'object' ? Object.keys(expenseData) : [],
      hasFile: Boolean(file),
      employeeCode: authUser?.employeeCode || '',
    });

    const documents = file
      ? [
          {
            fileName: file.originalname,
            fileUrl: file.location,
          },
        ]
      : [];

    if (documents.length > 0) {
      console.log('Expense document fileUrl:', documents[0].fileUrl);
    }

    const expense = await ExpenseService.createExpense(
      expenseData,
      documents,
      authUser
    );

    res.status(201).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update expense
 * PUT /api/expenses/:id
 */
export const updateExpense = async (req, res, next) => {
  try {
    const id = decodeExpenseRouteId(req.params.id);
    log.info('Update expense:', { id, bodyKeys: req.body ? Object.keys(req.body) : [] });

    let updateData = {};

    if (req.body) {
      Object.keys(req.body).forEach((key) => {
        const value = req.body[key];

        if (value !== undefined && value !== '') {
          updateData[key] = value;
        }
      });
    }

    if (req.file) {
      updateData.documents = [
        {
          fileName: req.file.originalname,
          fileUrl: req.file.location,
        },
      ];
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No data to update',
      });
    }

    const updated = await ExpenseService.updateExpense(id, updateData, req.user, req.effectiveRole);

    return res.json({
      success: true,
      data: updated,
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
    const id = decodeExpenseRouteId(req.params.id);
    log.info('Delete expense route', { rawParam: req.params.id, decodedId: id });
    const userId = req.user?.id; // From auth middleware

    await ExpenseService.deleteExpense(id, userId, req.user, req.effectiveRole);

    res.status(200).json({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error) {
    log.error('Delete expense controller error:', error);
    next(error);
  }
};

/**
 * Get expense documents by expense ID
 * GET /api/expenses/:id/documents
 */
export const getExpenseDocuments = async (req, res, next) => {
  try {
    const id = decodeExpenseRouteId(req.params.id);
    const documents = await ExpenseService.getExpenseDocuments(id, req.user, req.effectiveRole);

    res.status(200).json({
      success: true,
      data: documents,
    });
  } catch (error) {
    log.error('Get expense documents controller error:', error);
    next(error);
  }
};


