/**
 * Expense Routes
 * 
 * Defines all expense management API endpoints.
 */

import express from 'express';
import * as ExpenseController from '../controllers/expense.controller.js';
import { upload } from '../config/s3.js';
import { authenticateToken, authorize } from '../middleware/auth.middleware.js';
import log from '../utils/logger.js';
// import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken, authorize('expenses'));

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

// Expense CRUD operations
router.get('/', ExpenseController.getExpenses);
router.get('/:id/documents', ExpenseController.getExpenseDocuments);
router.get('/:id', ExpenseController.getExpenseById);
router.post('/', uploadExpenseFile, ExpenseController.createExpense);
router.put('/:id', uploadExpenseFile, ExpenseController.updateExpense);
router.delete('/:id', ExpenseController.deleteExpense);

export default router;


