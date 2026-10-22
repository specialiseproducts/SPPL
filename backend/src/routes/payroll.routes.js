/**
 * Payroll routes — module-isolated from Daily Planner.
 */

import express from 'express';
import * as PayrollController from '../controllers/payroll.controller.js';
import { authenticateToken, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken, authorize('payroll'));

router.get('/employees', PayrollController.listPayrollEmployees);
router.get('/team-mappings', PayrollController.listTeamMappings);
router.post('/team-mappings', PayrollController.assignTeamMapping);
router.delete('/team-mappings/:id', PayrollController.removeTeamMapping);
router.put('/team-mappings/:id/transfer', PayrollController.transferTeamMapping);

router.get('/leave-requests/me', PayrollController.listMyLeaveRequests);
router.get(
  '/leave-requests/pending-approvals',
  PayrollController.listPendingLeaveApprovals,
);
router.get(
  '/leave-requests/team/:employeeCode',
  PayrollController.listTeamMemberLeaveRequests,
);
router.post('/leave-requests', PayrollController.createLeaveRequest);
router.put('/leave-requests/:id', PayrollController.updateLeaveRequest);
router.delete('/leave-requests/:id', PayrollController.deleteLeaveRequest);
router.post('/leave-requests/:id/approve', PayrollController.approveLeaveRequest);
router.post('/leave-requests/:id/reject', PayrollController.rejectLeaveRequest);

export default router;
