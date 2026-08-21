/**
 * Verifies task-based planning score scenarios.
 * Run: node scripts/test-planning-score-scenarios.js
 */

import {
  computeTaskPlanningContribution,
  computeTaskCompletionContribution,
  computeWorkingDayPlanningScore,
  countPlannedTasksForDate,
  sumPlannedHoursForDate,
  TASK_PLANNING_SCORE_PREVIOUS_DAY,
  TASK_PLANNING_SCORE_MORNING,
  TASK_COMPLETION_SCORE_COMPLETED,
  TASK_COMPLETION_SCORE_NOT_COMPLETED,
  PLANNING_SOURCE_MANUAL,
  PLANNING_SOURCE_IMPORTED,
  PLANNING_SOURCE_RESCHEDULED,
  MIN_PLANNED_TASKS_PER_WORKING_DAY,
  MIN_PLANNED_HOURS_PER_WORKING_DAY,
} from '../src/utils/planningRecognition.js';
import {
  isCompanyHolidayDateKey,
  EMPLOYEE_LOCATION_FACTORY,
  EMPLOYEE_LOCATION_OFFICE,
} from '../src/utils/companyWorkingDays.js';

const TARGET = '2026-07-15'; // Wednesday
const PREVIOUS = '2026-07-14'; // Tuesday
const THIRD_SAT = '2026-07-18'; // 3rd Saturday of July 2026

function istIso(dateKey, hour, minute = 0) {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${dateKey}T${hh}:${mm}:00.000+05:30`;
}

function manualTask(id, createdDateKey, hour, minute = 0, overrides = {}) {
  const ts = istIso(createdDateKey, hour, minute);
  const planningScore = computeTaskPlanningContribution(TARGET, ts, EMPLOYEE_LOCATION_OFFICE);
  const status = overrides.status || 'Pending';
  const completionScore =
    overrides.completionScore !== undefined
      ? overrides.completionScore
      : computeTaskCompletionContribution(status);
  return {
    plannerTaskId: id,
    date: TARGET,
    planningCategory: 'Regular',
    source: PLANNING_SOURCE_MANUAL,
    status,
    planningTimestamp: ts,
    createdAt: ts,
    planningScore,
    completionScore,
    finalScore: planningScore + completionScore,
    ...overrides,
  };
}

const scenarios = [
  {
    name: 'Holiday — Office: 3rd Saturday is holiday',
    run: () => isCompanyHolidayDateKey(THIRD_SAT, EMPLOYEE_LOCATION_OFFICE) === true,
  },
  {
    name: 'Holiday — Factory: 3rd Saturday is working day',
    run: () => isCompanyHolidayDateKey(THIRD_SAT, EMPLOYEE_LOCATION_FACTORY) === false,
  },
  {
    name: 'Holiday — both: Sunday is holiday',
    run: () =>
      isCompanyHolidayDateKey('2026-07-19', EMPLOYEE_LOCATION_OFFICE) &&
      isCompanyHolidayDateKey('2026-07-19', EMPLOYEE_LOCATION_FACTORY),
  },
  {
    name: 'Task planning +1 previous day',
    run: () =>
      computeTaskPlanningContribution(
        TARGET,
        istIso(PREVIOUS, 18, 0),
        EMPLOYEE_LOCATION_OFFICE,
      ) === TASK_PLANNING_SCORE_PREVIOUS_DAY,
  },
  {
    name: 'Task planning +0.5 morning',
    run: () =>
      computeTaskPlanningContribution(
        TARGET,
        istIso(TARGET, 9, 0),
        EMPLOYEE_LOCATION_OFFICE,
      ) === TASK_PLANNING_SCORE_MORNING,
  },
  {
    name: 'Completion +2 / terminate -1',
    run: () =>
      computeTaskCompletionContribution('Completed') === TASK_COMPLETION_SCORE_COMPLETED &&
      computeTaskCompletionContribution('Terminated') === TASK_COMPLETION_SCORE_NOT_COMPLETED,
  },
  {
    name: 'Example day score — 8 prior + 2 morning; 8 done + 2 terminated = 23',
    run: () => {
      const tasks = [
        ...Array.from({ length: 8 }, (_, i) =>
          manualTask(`p${i}`, PREVIOUS, 18, i, {
            status: 'Completed',
            completionScore: 2,
            finalScore: 1 + 2,
            planningScore: 1,
          }),
        ),
        ...Array.from({ length: 2 }, (_, i) =>
          manualTask(`m${i}`, TARGET, 9, i, {
            status: 'Terminated',
            completionScore: -1,
            finalScore: 0.5 - 1,
            planningScore: 0.5,
          }),
        ),
      ];
      // Fix final scores on morning terminated
      for (const t of tasks.slice(8)) {
        t.finalScore = t.planningScore + t.completionScore;
      }
      const score = computeWorkingDayPlanningScore(TARGET, tasks, EMPLOYEE_LOCATION_OFFICE);
      return score === 23;
    },
  },
  {
    name: 'Planned tasks count helper still works',
    run: () => {
      const tasks = Array.from({ length: 7 }, (_, i) => manualTask(`t${i}`, PREVIOUS, 18, i));
      return countPlannedTasksForDate(tasks, TARGET) === 7;
    },
  },
  {
    name: 'Sum planned hours for date',
    run: () => {
      const tasks = [
        { ...manualTask('a', PREVIOUS, 18, 0), hoursRequired: 2 },
        { ...manualTask('b', PREVIOUS, 18, 1), hoursRequired: 1.5 },
        { ...manualTask('c', PREVIOUS, 18, 2), hoursRequired: 3.5 },
        { ...manualTask('d', PREVIOUS, 18, 3), status: 'Rescheduled', hoursRequired: 9 },
      ];
      return sumPlannedHoursForDate(tasks, TARGET) === 7;
    },
  },
  {
    name: 'Rescheduled source excluded from day score',
    run: () => {
      const tasks = [
        {
          plannerTaskId: 'r1',
          date: TARGET,
          planningCategory: 'Regular',
          source: PLANNING_SOURCE_RESCHEDULED,
          status: 'Pending',
          planningScore: 1,
          completionScore: 0,
          finalScore: 1,
          planningTimestamp: istIso(PREVIOUS, 18, 0),
          createdAt: istIso(PREVIOUS, 18, 0),
        },
      ];
      return computeWorkingDayPlanningScore(TARGET, tasks, EMPLOYEE_LOCATION_OFFICE) === 0;
    },
  },
  {
    name: 'Imported task excluded from day score',
    run: () => {
      const tasks = [
        {
          plannerTaskId: 'imp',
          date: TARGET,
          planningCategory: 'Regular',
          source: PLANNING_SOURCE_IMPORTED,
          status: 'Pending',
          planningScore: 1,
          completionScore: 0,
          finalScore: 1,
          planningTimestamp: istIso(PREVIOUS, 18, 0),
          createdAt: istIso(PREVIOUS, 18, 0),
        },
      ];
      return computeWorkingDayPlanningScore(TARGET, tasks, EMPLOYEE_LOCATION_OFFICE) === 0;
    },
  },
  {
    name: `Constant MIN_PLANNED_TASKS (score ceiling) is ${MIN_PLANNED_TASKS_PER_WORKING_DAY}`,
    run: () => MIN_PLANNED_TASKS_PER_WORKING_DAY === 10,
  },
  {
    name: `Constant MIN_PLANNED_HOURS is ${MIN_PLANNED_HOURS_PER_WORKING_DAY}`,
    run: () => MIN_PLANNED_HOURS_PER_WORKING_DAY === 7,
  },
];

let failed = 0;
for (const scenario of scenarios) {
  const ok = scenario.run();
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${scenario.name}`);
}

if (failed > 0) {
  console.error(`\n${failed} scenario(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${scenarios.length} scenarios passed.`);
