import express from 'express';
import * as AccessControlController from '../controllers/accessControl.controller.js';
import { authenticateToken, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken, authorize('userManagement'));
router.get('/', AccessControlController.getAll);
router.get('/:employeeCode', AccessControlController.getByEmployeeCode);
router.post('/', AccessControlController.create);
router.put('/:employeeCode', AccessControlController.update);
router.delete('/:employeeCode', AccessControlController.remove);

export default router;

