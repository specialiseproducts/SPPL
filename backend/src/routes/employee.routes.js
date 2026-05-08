/**
 * Employee Routes
 *
 * Defines all employee management API endpoints.
 */

import express from 'express';
import * as EmployeeController from '../controllers/employee.controller.js';
import { uploadUserManagementFiles } from '../config/s3UserManagement.js';
import { authenticateToken, authorize } from '../middleware/auth.middleware.js';
// import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

const userUploads = uploadUserManagementFiles.fields([
  { name: 'documents', maxCount: 1 },
  { name: 'pastExperience', maxCount: 1 },
  { name: 'profilePhoto', maxCount: 1 },
]);

function optionalUserUploads(req, res, next) {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) {
    return userUploads(req, res, next);
  }
  next();
}

router.use(authenticateToken, authorize('userManagement'));

router.get('/', EmployeeController.getAllEmployees);
router.get('/:id', EmployeeController.getEmployeeById);
router.post('/', optionalUserUploads, EmployeeController.createEmployee);
router.put('/:id', optionalUserUploads, EmployeeController.updateEmployee);
router.delete('/:id', EmployeeController.deleteEmployee);

export default router;
