/**
 * Expense Routes
 * 
 * Defines all expense management API endpoints.
 */

import express from 'express';
import * as ExpenseController from '../controllers/expense.controller.js';
// import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// All expense routes (uncomment authenticate when auth is implemented)
// router.use(authenticate);

// Expense CRUD operations
router.get('/', ExpenseController.getExpenses);
router.get('/:id', ExpenseController.getExpenseById);
router.post('/', ExpenseController.createExpense);
router.put('/:id', ExpenseController.updateExpense);
router.delete('/:id', ExpenseController.deleteExpense);

export default router;


