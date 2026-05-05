/**
 * Employee Routes
 * 
 * Defines all employee management API endpoints.
 */

import express from 'express';
import * as EmployeeController from '../controllers/employee.controller.js';
// import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// All employee routes (uncomment authenticate when auth is implemented)
// router.use(authenticate);

// Employee CRUD operations
router.get('/', EmployeeController.getAllEmployees);
router.get('/:id', EmployeeController.getEmployeeById);
router.post('/', EmployeeController.createEmployee);
router.put('/:id', EmployeeController.updateEmployee);
router.delete('/:id', EmployeeController.deleteEmployee);

export default router;


