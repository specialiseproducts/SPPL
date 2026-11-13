/**
 * Daily Planner routes
 */

import express from 'express';
import * as DailyPlannerController from '../controllers/dailyPlanner.controller.js';
import { authenticateToken, authorize } from '../middleware/auth.middleware.js';
import { uploadDailyPlannerDocument } from '../config/s3.js';

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
router.get('/project-progress', DailyPlannerController.getProjectProgress);
router.get('/project-progress/:projectKey', DailyPlannerController.getProjectDetails);
router.post(
  '/project-progress/:projectKey/observations',
  DailyPlannerController.addProjectObservation,
);

router.get('/managed-projects', DailyPlannerController.listManagedProjects);
router.get('/managed-projects/assignees', DailyPlannerController.listAssignableProjectEmployees);
router.get('/managed-projects/form-options', DailyPlannerController.listProjectFormOptions);
router.get('/managed-projects/:projectKey', DailyPlannerController.getManagedProject);
router.post('/managed-projects', DailyPlannerController.createManagedProject);
router.put('/managed-projects/:projectKey', DailyPlannerController.updateManagedProject);
router.delete('/managed-projects/:projectKey', DailyPlannerController.deactivateManagedProject);

router.get('/tasks/month', DailyPlannerController.listMyMonth);
router.get('/tasks/day', DailyPlannerController.listDayTasks);
router.get('/tasks/team', DailyPlannerController.listTeamTasks);
router.get('/leave/approved', DailyPlannerController.listApprovedLeaveForPlanner);
router.get(
  '/completion-approvals/pending',
  DailyPlannerController.listPendingCompletionApprovals,
);
router.get('/tasks/:id', DailyPlannerController.getTask);
router.post('/tasks/batch', DailyPlannerController.createTaskBatch);
router.post('/tasks/batch-complete', DailyPlannerController.batchCompleteTasks);
router.post('/tasks/for-employee', DailyPlannerController.createTaskForEmployee);
router.post('/tasks/day/submit-completion', DailyPlannerController.submitDayCompletion);
router.post('/tasks/day/submit-completion-review', DailyPlannerController.submitDayCompletionReview);
router.post(
  '/leave/half-day-task-selection',
  DailyPlannerController.applyHalfDayLeaveTaskSelection,
);
router.post('/tasks', DailyPlannerController.createTask);
router.put('/tasks/:id', DailyPlannerController.updateTask);
router.put('/tasks/:id/for-employee', DailyPlannerController.updateTaskForEmployee);
router.post('/tasks/:id/complete', DailyPlannerController.completeTask);
router.post('/tasks/:id/not-completed', DailyPlannerController.notCompletedTask);
router.post('/tasks/:id/reschedule-steps', DailyPlannerController.rescheduleTaskSteps);
router.delete('/tasks/:id', DailyPlannerController.deleteTask);
router.post('/tasks/:id/approve', DailyPlannerController.approveTask);
router.post('/tasks/:id/reject', DailyPlannerController.rejectTask);
router.post('/tasks/:id/needs-revision', DailyPlannerController.requestNeedsRevision);
router.post('/tasks/:id/reopen', DailyPlannerController.reopenApprovedTask);
router.post('/tasks/:id/manager-reschedule', DailyPlannerController.rescheduleTaskBySuperAdmin);
router.post('/tasks/:id/manager-delete', DailyPlannerController.deleteTaskBySuperAdmin);
router.post('/tasks/:id/verify-completion', DailyPlannerController.verifyTaskCompletion);
router.post('/tasks/:id/review-completion', DailyPlannerController.reviewTaskCompletion);
router.post(
  '/tasks/:id/superadmin-review-comment',
  DailyPlannerController.submitSuperadminReviewComment,
);
router.post('/tasks/:id/accept-revision', DailyPlannerController.acceptRevisionSuggestion);
router.put('/tasks/:id/priority', DailyPlannerController.editPriority);
router.post(
  '/tasks/:id/document',
  (req, res, next) => {
    // Accept either `file` (single) or `files` (up to 10, combined into one PDF).
    uploadDailyPlannerDocument.fields([
      { name: 'file', maxCount: 1 },
      { name: 'files', maxCount: 10 },
    ])(req, res, (err) => {
      if (err) {
        err.statusCode = err.statusCode || 400;
        return next(err);
      }
      next();
    });
  },
  DailyPlannerController.uploadTaskDocument,
);
router.get('/tasks/:id/document', DailyPlannerController.getTaskDocumentUrl);
router.post('/tasks/:id/flag', DailyPlannerController.raiseTaskFlag);
router.post('/tasks/:id/flag/accept', DailyPlannerController.acceptTaskFlag);

router.get('/projects', DailyPlannerController.listProjects);
router.get('/projects/observations', DailyPlannerController.listProjectObservations);
router.get(
  '/projects/:projectKey/completed-tasks',
  DailyPlannerController.listProjectCompletedTasks,
);
router.post('/projects', DailyPlannerController.upsertProject);
router.post('/plans/finalize', DailyPlannerController.finalizeEmployeePlan);
router.get('/planning/next-working-day', DailyPlannerController.getNextWorkingDay);

router.get('/team-mappings', DailyPlannerController.listTeamMappings);
router.post('/team-mappings', DailyPlannerController.assignTeamMapping);
router.delete('/team-mappings/:id', DailyPlannerController.removeTeamMapping);
router.put('/team-mappings/:id/transfer', DailyPlannerController.transferTeamMapping);

export default router;
