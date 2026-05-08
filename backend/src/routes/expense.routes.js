/**
 * Expense Routes
 * 
 * Defines all expense management API endpoints.
 */

import express from 'express';
import * as ExpenseController from '../controllers/expense.controller.js';
import { upload } from '../config/s3.js';
import { authenticateToken, authorize } from '../middleware/auth.middleware.js';
// import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken, authorize('expenses'));

// Expense CRUD operations
router.get('/', ExpenseController.getExpenses);
router.get('/:id/documents', ExpenseController.getExpenseDocuments);
router.get('/:id', ExpenseController.getExpenseById);
router.post('/', upload.single('file'), ExpenseController.createExpense);
router.put('/:id', upload.single('file'), ExpenseController.updateExpense);
router.delete('/:id', ExpenseController.deleteExpense);

export default router;


