/**
 * Expense Routes
 * 
 * Defines all expense management API endpoints.
 */

import express from 'express';
import * as ExpenseController from '../controllers/expense.controller.js';
import * as ExpenseTravelRateSettingsController from '../controllers/expenseTravelRateSettings.controller.js';
import { upload } from '../config/s3.js';
import { authenticateToken, authorize } from '../middleware/auth.middleware.js';
import { isSuperAdmin } from '../utils/accessControl.js';
import log from '../utils/logger.js';
// import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken, authorize('expenses'));

function requireExpensesSuperAdmin(req, res, next) {
  if (!isSuperAdmin(req.effectiveRole)) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden',
    });
  }
  next();
}

function uploadExpenseFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      log.error('Expense multipart / upload error:', err);
      const e = err;
      if (!Number.isInteger(e.statusCode) || e.statusCode < 400 || e.statusCode > 599) {
        e.statusCode = 400;
      }
      return next(e);
    }
    next();
  });
}

/*
 * IMPORTANT: Static paths MUST stay above any "/:id" route.
 * GET is readable by any user with Expenses module access (for Car/Bike amount calculation).
 * PUT remains Super Admin only.
 */
router.get('/settings/travel-rates', ExpenseTravelRateSettingsController.getTravelRateSettings);
router.put(
  '/settings/travel-rates',
  requireExpensesSuperAdmin,
  ExpenseTravelRateSettingsController.putTravelRateSettings
);

// Expense CRUD operations
router.get('/', ExpenseController.getExpenses);
router.get('/audit/employees', ExpenseController.getAuditEmployeeDirectory);
router.get('/audit', ExpenseController.getExpensesForAudit);
router.get('/edit-requests/pending', ExpenseController.listPendingExpenseEditRequests);
router.post('/edit-requests/:requestId/approve', ExpenseController.approveExpenseEditRequest);
router.post('/edit-requests/:requestId/reject', ExpenseController.rejectExpenseEditRequest);
router.get('/export/pending-previous', ExpenseController.getPendingPreviousExportExpenses);
router.post('/export/mark-status', ExpenseController.markExpenseExportStatuses);
router.post('/:id/approve', ExpenseController.approveExpense);
router.post('/:id/reject', ExpenseController.rejectExpense);
router.get('/:id/full', ExpenseController.getExpenseFullDetails);
router.get('/:id/documents', ExpenseController.getExpenseDocuments);
router.get('/:id/edit-requests', ExpenseController.listExpenseEditRequests);
router.post('/:id/edit-requests', ExpenseController.createExpenseEditRequest);
router.get('/:id', ExpenseController.getExpenseById);
router.post('/', uploadExpenseFile, ExpenseController.createExpense);
router.put('/:id', uploadExpenseFile, ExpenseController.updateExpense);
router.delete('/:id', ExpenseController.deleteExpense);

export default router;


