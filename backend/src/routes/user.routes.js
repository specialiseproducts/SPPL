/**
 * User Routes (utility endpoints)
 */

import express from 'express';
import { getSignedFileUrl } from '../utils/s3SignedUrl.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import * as EmployeeModel from '../models/EmployeeMaster.js';
import * as ExpenseDocumentsModel from '../models/ExpenseDocuments.js';
import { canAccessAllRecords } from '../utils/accessControl.js';
import { logActivity } from '../utils/activityLogger.js';

const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/users/file-url?key=<s3 object key>
 */
router.get('/file-url', (req, res, next) => {
  (async () => {
    try {
    const key = req.query.key;
    if (!key) {
      return res.status(400).json({ success: false, message: 'key is required' });
    }
    const role = req.user?.role || 'User';
    if (!canAccessAllRecords(role)) {
      let authorized = false;
      const code = req.user?.employeeCode || '';
      if (String(key).startsWith('user-management/')) {
        const employee = await EmployeeModel.getEmployeeByCode(code);
        const allowedUrls = [
          employee?.documentsUrl,
          employee?.pastExperienceUrl,
          employee?.profilePhotoUrl,
        ].filter(Boolean);
        authorized = allowedUrls.some((url) => String(url).includes(String(key)));
      } else if (String(key).startsWith('expenses/')) {
        const docs = await ExpenseDocumentsModel.getDocumentsByExpenseId(String(req.query.expenseId || ''));
        authorized = docs.some((doc) => doc?.fileUrl && String(doc.fileUrl).includes(String(key)) && doc?.created_by_employee_code === code);
      }
      if (!authorized) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    }
    const url = getSignedFileUrl(key);
    await logActivity({
      actorEmployeeCode: req.user?.employeeCode,
      actorName: req.user?.fullName,
      actorRole: role,
      module: 'files',
      actionType: 'DOWNLOAD',
      targetEntity: 's3Object',
      targetId: String(key),
    });
    res.status(200).json({ success: true, url });
    } catch (err) {
      next(err);
    }
  })();
});

export default router;

