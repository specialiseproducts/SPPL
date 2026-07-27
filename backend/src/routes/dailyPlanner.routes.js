/**
 * Daily Planner routes
 */

import express from 'express';
import * as DailyPlannerController from '../controllers/dailyPlanner.controller.js';
import { authenticateToken, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken, authorize('dailyPlanner'));

router.get('/planning/config', DailyPlannerController.getPlanningConfig);
router.get('/planning/me', DailyPlannerController.getMyPlanningProfile);
router.get('/planning/employee/:employeeCode', DailyPlannerController.getEmployeePlanningProfile);
router.get('/team-performance', DailyPlannerController.getTeamPerformance);
router.get('/planning/dashboard', DailyPlannerController.getPlanningDashboard);
router.get('/planning/manager-dashboard', DailyPlannerController.getManagerPlanningDashboard);
router.get('/planning/history', DailyPlannerController.getPlanningHistory);
router.get('/planning/report', DailyPlannerController.getPlanningReport);
router.get('/planning/team-history', DailyPlannerController.getTeamPlanningHistory);
router.get('/planning/export', DailyPlannerController.getPlanningExportPayload);

router.get('/tasks/month', DailyPlannerController.listMyMonth);
router.get('/tasks/day', DailyPlannerController.listDayTasks);
router.get('/tasks/team', DailyPlannerController.listTeamTasks);
router.get('/tasks/:id', DailyPlannerController.getTask);
router.post('/tasks', DailyPlannerController.createTask);
router.put('/tasks/:id', DailyPlannerController.updateTask);
router.post('/tasks/:id/complete', DailyPlannerController.completeTask);
router.post('/tasks/:id/not-completed', DailyPlannerController.notCompletedTask);
router.delete('/tasks/:id', DailyPlannerController.deleteTask);
router.post('/tasks/:id/approve', DailyPlannerController.approveTask);
router.post('/tasks/:id/reject', DailyPlannerController.rejectTask);
router.post('/tasks/:id/needs-revision', DailyPlannerController.requestNeedsRevision);
router.post('/tasks/:id/verify-completion', DailyPlannerController.verifyTaskCompletion);
router.post('/tasks/:id/accept-revision', DailyPlannerController.acceptRevisionSuggestion);
router.put('/tasks/:id/priority', DailyPlannerController.editPriority);

router.get('/team-mappings', DailyPlannerController.listTeamMappings);
router.post('/team-mappings', DailyPlannerController.assignTeamMapping);
router.delete('/team-mappings/:id', DailyPlannerController.removeTeamMapping);
router.put('/team-mappings/:id/transfer', DailyPlannerController.transferTeamMapping);

export default router;
