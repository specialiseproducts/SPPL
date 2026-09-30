/**
 * Expense Controller
 * 
 * Handles HTTP requests/responses for expense management endpoints.
 */

import * as ExpenseService from '../services/expense.service.js';
import * as ExpenseEditRequestService from '../services/expenseEditRequest.service.js';
import * as ExpenseDashboardService from '../services/expenseDashboard.service.js';
import { DEFAULT_QUERY_LIMIT } from '../utils/dynamoPagination.js';
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
 * Full expense + documents for Audit Eye view.
 * GET /api/expenses/:id/full
 */
export const getExpenseFullDetails = async (req, res, next) => {
  try {
    const id = decodeExpenseRouteId(req.params.id);
    const data = await ExpenseService.getExpenseFullDetails(id, req.user, req.effectiveRole);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    log.error('Get expense full details controller error:', error);
    next(error);
  }
};

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
 * Employee directory for Audit Expenses filter dropdown.
 * GET /api/expenses/audit/employees
 */
export const getAuditEmployeeDirectory = async (req, res, next) => {
  try {
    const options = {
      limit: req.query.limit ?? DEFAULT_QUERY_LIMIT,
      cursor: req.query.cursor ?? req.query.lastKey,
    };

    const result = await ExpenseService.getAuditEmployeeDirectory(options, req.effectiveRole);

    res.status(200).json({
      success: true,
      data: result.data,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    });
  } catch (error) {
    log.error('Get audit employee directory controller error:', error);
    next(error);
  }
};

/**
 * Organization-wide expense list for Audit Expenses tab.
 * GET /api/expenses/audit
 */
export const getExpensesForAudit = async (req, res, next) => {
  try {
    const filters = {
      employeeId: req.query.employeeId || req.query.employeeCode || '',
      month: req.query.month || '',
      year: req.query.year || '',
    };
    const options = {
      limit: req.query.limit ?? DEFAULT_QUERY_LIMIT,
      cursor: req.query.cursor,
    };

    const result = await ExpenseService.getExpensesForAudit(
      filters,
      options,
      req.user,
      req.effectiveRole
    );

    res.status(200).json({
      success: true,
      data: result.data,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    });
  } catch (error) {
    log.error('Get audit expenses controller error:', error);
    next(error);
  }
};

/**
 * Approved-only total for Audit Expenses filters.
 * GET /api/expenses/audit/approved-total
 */
export const getAuditApprovedTotal = async (req, res, next) => {
  try {
    const filters = {
      employeeId: req.query.employeeId || req.query.employeeCode || '',
      month: req.query.month || '',
      year: req.query.year || '',
    };
    const data = await ExpenseService.getAuditApprovedTotal(
      filters,
      req.user,
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Get audit approved total controller error:', error);
    next(error);
  }
};

/**
 * Master dropdown values for Service Provider Name.
 * GET /api/expenses/masters/service-providers
 */
export const listExpenseServiceProviders = async (req, res, next) => {
  try {
    const data = await ExpenseService.listExpenseServiceProviders();
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('List expense service providers controller error:', error);
    next(error);
  }
};

/**
 * Shared Location master values (Location / From / To).
 * GET /api/expenses/masters/locations
 */
export const listExpenseLocations = async (req, res, next) => {
  try {
    const data = await ExpenseService.listExpenseLocations();
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('List expense locations controller error:', error);
    next(error);
  }
};

export const listPendingExpenseEditRequests = async (req, res, next) => {
  try {
    const data = await ExpenseEditRequestService.listPendingExpenseEditRequests(
      req.user,
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('List pending expense edit requests controller error:', error);
    next(error);
  }
};

export const listExpenseEditRequests = async (req, res, next) => {
  try {
    const id = decodeExpenseRouteId(req.params.id);
    const data = await ExpenseEditRequestService.listExpenseEditRequests(
      id,
      req.user,
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('List expense edit requests controller error:', error);
    next(error);
  }
};

export const createExpenseEditRequest = async (req, res, next) => {
  try {
    const id = decodeExpenseRouteId(req.params.id);
    const data = await ExpenseEditRequestService.createExpenseEditRequest(
      id,
      req.body || {},
      req.user,
      req.effectiveRole,
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    log.error('Create expense edit request controller error:', error);
    next(error);
  }
};

export const approveExpenseEditRequest = async (req, res, next) => {
  try {
    const data = await ExpenseEditRequestService.approveExpenseEditRequest(
      req.params.requestId,
      req.user,
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Approve expense edit request controller error:', error);
    next(error);
  }
};

export const rejectExpenseEditRequest = async (req, res, next) => {
  try {
    const data = await ExpenseEditRequestService.rejectExpenseEditRequest(
      req.params.requestId,
      req.body || {},
      req.user,
      req.effectiveRole,
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Reject expense edit request controller error:', error);
    next(error);
  }
};

/**
 * Approve expense (audit)
 * POST /api/expenses/:id/approve
 */
export const approveExpense = async (req, res, next) => {
  try {
    const id = decodeExpenseRouteId(req.params.id);
    const updated = await ExpenseService.approveExpense(id, req.user, req.effectiveRole);
    res.json({ success: true, data: updated });
  } catch (error) {
    log.error('Approve expense controller error:', error);
    next(error);
  }
};

/**
 * Pending previous-month expenses for Export Data workflow.
 * GET /api/expenses/export/pending-previous?month=MM&year=YYYY&employeeCode=
 */
export const getPendingPreviousExportExpenses = async (req, res, next) => {
  try {
    const data = await ExpenseService.getPendingPreviousExportExpenses(
      {
        month: req.query.month,
        year: req.query.year,
        employeeCode: req.query.employeeCode || req.query.employeeId,
      },
      req.user,
      req.effectiveRole
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Get pending previous export expenses controller error:', error);
    next(error);
  }
};

/**
 * Mark expenses as Exported or Skipped after export actions.
 * POST /api/expenses/export/mark-status
 */
export const markExpenseExportStatuses = async (req, res, next) => {
  try {
    const data = await ExpenseService.markExpenseExportStatuses(
      req.body || {},
      req.user,
      req.effectiveRole
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('Mark expense export statuses controller error:', error);
    next(error);
  }
};

/**
 * Reject expense (audit)
 * POST /api/expenses/:id/reject
 */
export const rejectExpense = async (req, res, next) => {
  try {
    const id = decodeExpenseRouteId(req.params.id);
    const updated = await ExpenseService.rejectExpense(id, req.body, req.user, req.effectiveRole);
    res.json({ success: true, data: updated });
  } catch (error) {
    log.error('Reject expense controller error:', error);
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
      limit: req.query.limit ?? DEFAULT_QUERY_LIMIT,
      cursor: req.query.cursor,
    };

    const result = await ExpenseService.getExpenses(filters, options, req.user, req.effectiveRole);

    res.status(200).json({
      success: true,
      data: result.data,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
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
    const expenseData = { ...req.body };
    const authUser = req.user;
    const file = req.file;

    log.info('Create expense: multipart fields', {
      keys: expenseData && typeof expenseData === 'object' ? Object.keys(expenseData) : [],
      hasFile: Boolean(file),
      employeeCode: authUser?.employeeCode || '',
    });

    const sdRaw = String(expenseData.supportingDocument || '').trim().toLowerCase();
    const supportingDocument =
      sdRaw === 'yes' ? 'Yes' : sdRaw === 'no' ? 'No' : file ? 'Yes' : 'No';
    expenseData.supportingDocument = supportingDocument;

    const documents =
      supportingDocument === 'No'
        ? []
        : file
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

    const supNorm = String(req.body?.supportingDocument ?? updateData.supportingDocument ?? '')
      .trim()
      .toLowerCase();
    if (supNorm === 'yes') {
      updateData.supportingDocument = 'Yes';
    } else if (supNorm === 'no') {
      updateData.supportingDocument = 'No';
    }

    if (req.file && supNorm !== 'no') {
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
 * Super Admin — Company Overview analytics for a selected month range.
 * GET /api/expenses/dashboard/company-overview?from=YYYY-MM&to=YYYY-MM
 * Phase 2B — Expense Head analysis:
 * GET /api/expenses/dashboard/company-overview?from=YYYY-MM&to=YYYY-MM&expenseHead=Travel
 * Phase 2C — Subcategory transactions:
 * GET /api/expenses/dashboard/company-overview?from=YYYY-MM&to=YYYY-MM&expenseHead=Travel&subCategory=Flight
 * Phase 2D — optional employeeCode scopes Approved analytics to one employee.
 * Omitting both from and to defaults to the latest 12 calendar months (overview only).
 */
export const getCompanyOverview = async (req, res, next) => {
  try {
    const from = req.query?.from;
    const to = req.query?.to;
    const employeeCodeRaw = req.query?.employeeCode ?? req.query?.employeeId;
    const employeeCode =
      employeeCodeRaw != null && String(employeeCodeRaw).trim() !== ''
        ? String(employeeCodeRaw).trim()
        : '';
    const locationRaw = req.query?.location;
    const location =
      locationRaw != null && String(locationRaw).trim() !== ''
        ? String(locationRaw).trim()
        : '';
    const expenseHeadRaw = req.query?.expenseHead;
    const expenseHead =
      expenseHeadRaw != null && String(expenseHeadRaw).trim() !== ''
        ? String(expenseHeadRaw).trim()
        : '';
    const subCategoryRaw = req.query?.subCategory;
    const subCategory =
      subCategoryRaw != null && String(subCategoryRaw).trim() !== ''
        ? String(subCategoryRaw).trim()
        : '';

    let data;
    if (expenseHead && subCategory) {
      data = await ExpenseDashboardService.getExpenseSubcategoryAnalysis({
        from,
        to,
        expenseHead,
        subCategory,
        employeeCode,
        location,
      });
    } else if (expenseHead) {
      data = await ExpenseDashboardService.getExpenseHeadAnalysis({
        from,
        to,
        expenseHead,
        employeeCode,
        location,
      });
    } else {
      data = await ExpenseDashboardService.getCompanyOverview({
        from,
        to,
        employeeCode,
        location,
      });
    }

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    log.error('Get company overview dashboard error:', error);
    next(error);
  }
};

/**
 * Super Admin — employees with at least one non-deleted expense (for analytics filter).
 * GET /api/expenses/dashboard/employees
 */
export const getDashboardEmployees = async (req, res, next) => {
  try {
    const data = await ExpenseDashboardService.getDashboardEmployees();
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    log.error('Get dashboard employees error:', error);
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


