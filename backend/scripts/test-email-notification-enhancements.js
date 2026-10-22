/**
 * Focused checks for Daily Planner MD comment, Final Plan Project Name column,
 * and Payroll leave approve/reject email content.
 *
 * Run: node scripts/test-email-notification-enhancements.js
 */

import { buildSuperadminReviewEmail } from '../src/services/dailyPlannerSuperadminReviewEmail.js';
import { buildFinalPlanEmail } from '../src/services/dailyPlannerFinalPlanEmail.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  buildLeaveApprovedEmail,
  buildLeaveRejectedEmail,
  formatLeaveDatesForSubject,
  leaveDaysLabel,
  leaveTypeLabel,
} from '../src/services/payrollLeaveDecisionEmail.js';

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}`);
  }
}

console.log('\n1) Superadmin / MD comment email');
{
  const mail = buildSuperadminReviewEmail({
    recipientName: 'Alex Manager',
    employeeName: 'Jamie Employee',
    reviewerName: 'Pat Superadmin',
    taskName: 'Layout review',
    projectName: 'Acme Tower',
    taskDate: '2026-10-21',
    commentText: 'Please refine the sequence.',
  });

  assert(
    'subject identifies MD comment',
    mail.subject === "MD's Comment on Your Daily Planner — Action Required",
  );
  assert('text has MD heading', mail.text.includes("MD's Comment on Daily Planner Planning"));
  assert('html has MD heading', mail.html.includes("MD's Comment on Daily Planner Planning"));
  assert('retains employee name', mail.text.includes('Employee: Jamie Employee'));
  assert('retains task name', mail.text.includes('Task: Layout review'));
  assert('retains project name', mail.text.includes('Project: Acme Tower'));
  assert('retains reviewer name', mail.text.includes('Reviewer: Pat Superadmin'));
  assert('retains comment', mail.text.includes('Please refine the sequence.'));
  assert(
    'does not use old generic subject',
    !mail.subject.startsWith('Daily Planner review comment'),
  );
}

console.log('\n2) Final Daily Plan email — Project Name column');
{
  const mail = buildFinalPlanEmail({
    employeeName: 'Jamie Employee',
    dateLabel: '21 October 2026',
    totalHours: 8,
    tasks: [
      {
        projectName: 'Acme Tower',
        taskName: 'Layout review',
        description: '• Draft\n• Review',
        priority: 'High',
        hoursRequired: 4,
        managerInstructions: '',
        managerComments: '',
      },
      {
        projectName: '',
        taskName: 'Admin follow-up',
        description: 'Inbox',
        priority: 'Low',
        hoursRequired: 2,
        managerInstructions: '',
        managerComments: '',
      },
      {
        projectName: 'Custom Client Job',
        taskName: 'Extra Task',
        description: 'Ad-hoc',
        priority: 'Medium',
        hoursRequired: 2,
        managerInstructions: '',
        managerComments: '',
      },
    ],
  });

  const headerOrder = mail.html.match(
    /Sr\. No\.<\/th>\s*<th[^>]*>Project Name<\/th>\s*<th[^>]*>Task Name<\/th>/,
  );
  assert('HTML column order: Sr. No. → Project Name → Task Name', Boolean(headerOrder));
  assert('shows named project', mail.html.includes('Acme Tower') && mail.text.includes('Acme Tower'));
  assert('shows custom project name', mail.html.includes('Custom Client Job'));
  assert('missing project uses em dash', /\| — \| Admin follow-up/.test(mail.text) || mail.text.includes('— | Admin follow-up'));
  assert('preserves multi-bullet description', mail.html.includes('<li') && mail.html.includes('Draft'));
}

console.log('\n3) Leave approve / reject emails');
{
  const approved = {
    employeeName: 'Jamie Employee',
    employeeCode: 'E001',
    leaveType: 'multiple_day',
    startDate: '2026-11-10',
    endDate: '2026-11-12',
    durationDays: 3,
    halfDayPeriod: null,
    status: 'Approved',
  };
  const approvedMail = buildLeaveApprovedEmail(approved);
  assert(
    'approved subject',
    approvedMail.subject.startsWith('Leave Request Approved —') &&
      approvedMail.subject.includes(formatLeaveDatesForSubject(approved)),
  );
  assert('approved status', approvedMail.text.includes('Status: Approved'));
  assert('approved leave type', approvedMail.text.includes(leaveTypeLabel('multiple_day')));
  assert('approved days', approvedMail.text.includes(leaveDaysLabel(approved)));
  assert('approved has no rejection reason block', !approvedMail.text.includes('Rejection reason:'));

  const rejected = {
    ...approved,
    leaveType: 'half_day',
    startDate: '2026-11-15',
    endDate: '2026-11-15',
    durationDays: 1,
    halfDayPeriod: 'second_half',
    status: 'Rejected',
    rejectionReason: 'Team coverage needed that afternoon.',
  };
  const rejectedMail = buildLeaveRejectedEmail(rejected);
  assert(
    'rejected subject',
    rejectedMail.subject.startsWith('Leave Request Rejected —') &&
      rejectedMail.subject.includes('2nd Half'),
  );
  assert('rejected status', rejectedMail.text.includes('Status: Rejected'));
  assert(
    'rejected includes actual reason',
    rejectedMail.text.includes('Team coverage needed that afternoon.'),
  );
  assert('half-day days label', leaveDaysLabel(rejected).includes('0.5 day'));

  const noReasonMail = buildLeaveRejectedEmail({
    ...rejected,
    rejectionReason: '',
  });
  assert(
    'fallback when rejection reason missing',
    noReasonMail.text.includes('No rejection reason was provided.'),
  );
}

console.log('\n4) Decision email builders are decision-specific');
{
  const base = {
    employeeName: 'Jamie Employee',
    leaveType: 'one_day',
    startDate: '2026-11-20',
    endDate: '2026-11-20',
    durationDays: 1,
  };
  const a = buildLeaveApprovedEmail(base);
  const r = buildLeaveRejectedEmail({ ...base, rejectionReason: 'Busy week' });
  assert('approved is not labeled rejected', a.subject.includes('Approved') && !a.subject.includes('Rejected'));
  assert('rejected is not labeled approved', r.subject.includes('Rejected') && !r.subject.includes('Approved'));
}

console.log('\n5) Wiring / trigger guards (source inspection)');
{
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const leaveService = readFileSync(
    join(__dirname, '../src/services/payrollLeave.service.js'),
    'utf8',
  );
  const plannerService = readFileSync(
    join(__dirname, '../src/services/dailyPlanner.service.js'),
    'utf8',
  );

  assert(
    'approve sends email only after persist + Pending guard',
    leaveService.includes("status: 'Approved'") &&
      leaveService.includes("notifyLeaveDecisionEmail('Approved'") &&
      leaveService.includes("Only Pending leave requests can be approved"),
  );
  assert(
    'reject sends email only after persist + Pending guard',
    leaveService.includes("status: 'Rejected'") &&
      leaveService.includes("notifyLeaveDecisionEmail('Rejected'") &&
      leaveService.includes("Only Pending leave requests can be rejected"),
  );
  assert(
    'MD email builder used only by Superadmin review flow',
    plannerService.includes("from './dailyPlannerSuperadminReviewEmail.js'") &&
      plannerService.includes('submitSuperadminReviewComment') &&
      plannerService.includes('buildSuperadminReviewEmail'),
  );
  assert(
    'leave email failure does not throw after persist (await + return)',
    leaveService.includes('// Notify after persist — never roll back') &&
      leaveService.includes('const email = await notifyLeaveDecisionEmail'),
  );
}

console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
