import type { PayrollLeaveRequest } from '../../types/payroll';
import LeaveCalendarEventBlock from '../payroll/LeaveCalendarEventBlock';

/**
 * Payroll leave card inside a Daily Planner date cell.
 *
 * Must use LeaveCalendarEventBlock with default layout="fill" (flex: 1 1 0).
 * Height comes from the parent flex region (same pattern as MyCalendarTab),
 * not from a compact min-height — that was why cards looked like thin labels.
 */
export default function DailyPlannerLeaveChip({
  request,
}: {
  request: PayrollLeaveRequest;
}) {
  return <LeaveCalendarEventBlock request={request} interactive={false} layout="fill" />;
}
