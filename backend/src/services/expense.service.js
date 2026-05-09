/**
 * Expense Service
 * 
 * Business logic layer for expense management operations.
 * Handles expense CRUD operations and business rules.
 */

import * as ExpenseModel from '../models/Expenses.js';
import * as ExpenseDocumentsModel from '../models/ExpenseDocuments.js';
import {
  isCanonicalExpenseHead,
  validateSubCategoryForHead,
  EXPENSE_SUBCATEGORY_MAP,
} from '../constants/expenseSubCategories.js';
import { buildAuditFields } from '../utils/audit.js';
import { canAccessAllRecords, isOwnedByUser } from '../utils/accessControl.js';
import { withApprovalDefaults } from '../utils/approval.js';
import { buildSoftDeleteFields } from '../utils/softDelete.js';
import { logActivity } from '../utils/activityLogger.js';
import log from '../utils/logger.js';

const SUB_OR_HEAD_KEYS = ['expenseHead', 'subCategory'];
const OTHER_FORM_FIELDS = [
  'locationPurpose',
  'serviceProvider',
  'billNumber',
  'date',
  'monthYear',
  'employeeName',
];

function validateMergedSubCategoryOnUpdate(merged, updateData) {
  if (!isCanonicalExpenseHead(merged.expenseHead)) {
    return;
  }
  const sub = merged.subCategory != null ? String(merged.subCategory).trim() : '';
  if (sub) {
    if (!EXPENSE_SUBCATEGORY_MAP[merged.expenseHead].includes(sub)) {
      throw new Error('subCategory does not match expense head');
    }
    return;
  }
  const headOrSubTouched = SUB_OR_HEAD_KEYS.some((k) =>
    Object.prototype.hasOwnProperty.call(updateData, k)
  );
  if (headOrSubTouched) {
    throw new Error('subCategory is required');
  }
  const otherFormTouched = OTHER_FORM_FIELDS.some((k) =>
    Object.prototype.hasOwnProperty.call(updateData, k)
  );
  if (otherFormTouched) {
    throw new Error('subCategory is required');
  }
}

/**
 * Get expense by ID
 * @param {string} expenseId - Expense ID
 * @returns {Promise<Object>} Expense record with documents
 */
export const getExpenseById = async (expenseId, authUser = null, effectiveRole = 'User') => {
  try {
    if (!expenseId) {
      throw new Error('expenseId is required');
    }

    log.info('Getting expense:', expenseId);
    const expense = await ExpenseModel.getExpenseById(expenseId);
    if (!expense) {
      throw new Error('Expense not found');
    }

    if (authUser && !canAccessAllRecords(effectiveRole) && !isOwnedByUser(expense, authUser)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    const documentsFromTable = await ExpenseDocumentsModel.getDocumentsByExpenseId(expenseId);
    const inlineDocuments = Array.isArray(expense.documents) ? expense.documents : [];
    const documents = inlineDocuments.length > 0 ? inlineDocuments : documentsFromTable;
    return {
      ...expense,
      documents,
    };
  } catch (error) {
    log.error('Error getting expense:', error);
    throw error;
  }
};

/**
 * Get expenses with filters
 * @param {Object} filters - Filter criteria
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} List of expenses
 */
export const getExpenses = async (filters = {}, options = {}, authUser = null, effectiveRole = 'User') => {
  try {
    log.info('Getting expenses with filters:', filters);
    const rows = await ExpenseModel.getAllExpenses(filters, options);
    if (!authUser || canAccessAllRecords(effectiveRole)) {
      return rows;
    }
    return rows.filter((row) => isOwnedByUser(row, authUser));
  } catch (error) {
    log.error('Error getting expenses:', error);
    throw error;
  }
};

/**
 * Create new expense
 * @param {Object} expenseData - Expense data
 * @param {string} userId - User ID creating the expense (for audit)
 * @returns {Promise<Object>} Created expense record
 */
export const createExpense = async (expenseData, documents = [], authUser = null) => {
  try {
    if (!expenseData?.expenseHead) {
      throw new Error('expenseHead is required');
    }
    if (!expenseData?.locationPurpose) {
      throw new Error('locationPurpose is required');
    }
    if (!expenseData?.serviceProvider) {
      throw new Error('serviceProvider is required');
    }
    if (!expenseData?.billNumber) {
      throw new Error('billNumber is required');
    }
    if (!expenseData?.date) {
      throw new Error('date is required');
    }
    if (Number.isNaN(Number(expenseData?.amount))) {
      throw new Error('amount must be a number');
    }
    if (!expenseData?.employeeName) {
      throw new Error('employeeName is required');
    }

    validateSubCategoryForHead(expenseData.expenseHead, expenseData.subCategory);

    const auditFields = authUser ? buildAuditFields(authUser) : {};
    const payload = {
      ...withApprovalDefaults(expenseData),
      ...auditFields,
      documents: Array.isArray(documents) ? documents : [],
      // Keep existing camelCase timestamp conventions in current models
      createdAt: expenseData.createdAt || auditFields.created_at || undefined,
      updatedAt: auditFields.updated_at || undefined,
    };

    log.info('Creating expense:', payload);
    const expense = await ExpenseModel.createExpense(payload);
    await logActivity({
      actorEmployeeCode: authUser?.employeeCode || '',
      actorName: authUser?.fullName || '',
      actorRole: authUser?.role || '',
      module: 'expenses',
      actionType: 'CREATE',
      targetEntity: 'expense',
      targetId: expense.expenseId,
    });

    const mergedDocuments = [];
    if (Array.isArray(documents)) {
      mergedDocuments.push(...documents);
    }
    if (Array.isArray(expenseData.documents)) {
      mergedDocuments.push(...expenseData.documents);
    }
    const savedDocuments = [];

    for (const document of mergedDocuments) {
      if (!document?.fileName || !document?.fileUrl) {
        continue;
      }

      const saved = await ExpenseDocumentsModel.createDocument({
        expenseId: expense.expenseId,
        fileName: document.fileName,
        fileUrl: document.fileUrl,
        created_by_employee_code: auditFields.created_by_employee_code || '',
        created_by_name: auditFields.created_by_name || '',
        created_by_role: auditFields.created_by_role || '',
        created_by_user_id: auditFields.created_by_user_id || '',
        created_by_first_name: auditFields.created_by_first_name || '',
        created_by_last_name: auditFields.created_by_last_name || '',
        created_by: auditFields.created_by || '',
      });

      savedDocuments.push(saved);
    }

    return {
      ...expense,
      documents: savedDocuments,
    };
  } catch (error) {
    log.error('Error creating expense:', error);
    throw error;
  }
};

/**
 * Update expense
 * @param {string} expenseId - Expense ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object>} Updated expense record
 */
export const updateExpense = async (expenseId, updateData, authUser = null, effectiveRole = 'User') => {
  try {
    if (!expenseId) {
      throw new Error('expenseId is required');
    }

    if (updateData?.amount !== undefined && Number.isNaN(Number(updateData.amount))) {
      throw new Error('amount must be a number');
    }

    const existing = await ExpenseModel.getExpenseById(expenseId);
    if (!existing) {
      throw new Error('Expense not found');
    }
    if (authUser && !canAccessAllRecords(effectiveRole) && !isOwnedByUser(existing, authUser)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    const updatePayload = {
      ...updateData,
    };

    const merged = {
      ...existing,
      ...updatePayload,
    };
    validateMergedSubCategoryOnUpdate(merged, updatePayload);

    log.info('Updating expense:', expenseId);
    const updated = await ExpenseModel.updateExpense(expenseId, updatePayload);
    await logActivity({
      actorEmployeeCode: authUser?.employeeCode || '',
      actorName: authUser?.fullName || '',
      actorRole: authUser?.role || '',
      module: 'expenses',
      actionType: 'UPDATE',
      targetEntity: 'expense',
      targetId: expenseId,
    });
    return updated;
  } catch (error) {
    log.error('Error updating expense:', error);
    throw error;
  }
};

/**
 * Delete expense
 * @param {string} expenseId - Expense ID
 * @param {string} userId - User ID making the deletion (for audit)
 * @returns {Promise<Object>} Deletion result
 */
export const deleteExpense = async (expenseId, userId, authUser = null, effectiveRole = 'User') => {
  try {
    if (!expenseId) {
      throw new Error('expenseId is required');
    }

    const existing = await ExpenseModel.getExpenseById(expenseId);
    if (!existing) {
      throw new Error('Expense not found');
    }
    if (authUser && !canAccessAllRecords(effectiveRole) && !isOwnedByUser(existing, authUser)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    log.info('Deleting expense:', expenseId);
    const documents = await ExpenseDocumentsModel.getDocumentsByExpenseId(expenseId);
    for (const document of documents) {
      await ExpenseDocumentsModel.deleteDocument(document.documentId);
    }

    const deleted = await ExpenseModel.updateExpense(expenseId, buildSoftDeleteFields(authUser));
    await logActivity({
      actorEmployeeCode: authUser?.employeeCode || '',
      actorName: authUser?.fullName || '',
      actorRole: authUser?.role || '',
      module: 'expenses',
      actionType: 'DELETE',
      targetEntity: 'expense',
      targetId: expenseId,
    });
    return deleted;
  } catch (error) {
    log.error('Error deleting expense:', error);
    throw error;
  }
};

export const getExpenseDocuments = async (expenseId, authUser = null, effectiveRole = 'User') => {
  try {
    if (!expenseId) {
      throw new Error('expenseId is required');
    }

    const expense = await ExpenseModel.getExpenseById(expenseId);
    if (!expense) {
      throw new Error('Expense not found');
    }
    if (authUser && !canAccessAllRecords(effectiveRole) && !isOwnedByUser(expense, authUser)) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    log.info('Getting expense documents:', expenseId);
    return await ExpenseDocumentsModel.getDocumentsByExpenseId(expenseId);
  } catch (error) {
    log.error('Error getting expense documents:', error);
    throw error;
  }
};


