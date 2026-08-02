/**
 * E1-F2-T1: shared day-counting calculation extracted from three previously
 * independent, near-duplicated implementations in payroll.service.ts
 * (getPayrollPreview, processPayroll, getAbsentDates).
 *
 * Equivalence note (verified before extraction, not assumed): the three
 * original implementations differed in loop structure — getPayrollPreview
 * and processPayroll resolved "unemployed" (before-join/after-exit) first
 * and returned early per day in a single pass; getAbsentDates resolved
 * off-date/shift/work-day first, collected candidate days, then applied the
 * unemployed check in a second pass over just those candidates. Both orders
 * evaluate the exact same set of boolean conditions per day (unemployed,
 * off-date, shift-resolves, is-work-day, before-today, has-attendance-
 * record) combined with AND, which is commutative — so both structures
 * necessarily produce the same final set of "missing punch" days, in the
 * same order (both iterate `daysInMonth` ascending). This function uses the
 * single-pass structure (matching two of the three original call sites).
 *
 * Deliberately NOT included here (kept at each call site, since they differ
 * per caller and are not part of the shared calculation itself):
 *   - The 22-day fallback when a staff member has zero shift assignments
 *     for the month (present in getPayrollPreview/processPayroll, absent
 *     in getAbsentDates by design — see that function's own comment).
 *   - Composing `absentDays` from `literalAbsentDays + missingPunches`.
 *   - Any DB fetching — all inputs here are plain, already-fetched data.
 */

import { getBDDateString, getBDWeekDay } from '../utils/date.util.js';

export interface WorkDayShiftAssignment {
    startDate: Date | string;
    endDate?: Date | string | null;
    shiftId: {
        workDays: number[];
    };
}

export interface WorkDayAttendanceRecord {
    date: Date | string;
}

export interface ComputeWorkDayStatsInput {
    /** Every calendar day in the target month (ascending order). */
    daysInMonth: Date[];
    /** Shift assignments already scoped to a single staff member. */
    shiftAssignments: WorkDayShiftAssignment[];
    /** Attendance records already scoped to a single staff member + month. */
    attendanceRecords: WorkDayAttendanceRecord[];
    /** Pre-flattened "YYYY-MM-DD" strings for this staff's shift off-dates. */
    shiftOffDateStrings: string[];
    joinDate?: Date | string | null;
    exitDate?: Date | string | null;
    /** "YYYY-MM-DD" for "today" in Bangladesh time (caller-supplied so this stays a pure function). */
    todayBDStr: string;
}

export interface WorkDayStats {
    /** Count of days that resolve to a work day (not unemployed, not off-date, shift covers the weekday). */
    workDaysCount: number;
    /** Count of days the staff member was unemployed (strictly before join or after exit). */
    unemployedDays: number;
    /** The actual Date objects that resolved to a work day, in ascending order. */
    expectedWorkDates: Date[];
    /** The subset of expectedWorkDates that are before "today" and have no matching attendance record. */
    missingPunchDates: Date[];
}

/**
 * Computes work-day / unemployed / missing-punch statistics for a single
 * staff member over a single month, from already-fetched data. No DB or
 * I/O of any kind — safe to unit test directly.
 */
export function computeWorkDayStats(input: ComputeWorkDayStatsInput): WorkDayStats {
    const { daysInMonth, shiftAssignments, attendanceRecords, shiftOffDateStrings, joinDate, exitDate, todayBDStr } =
        input;

    const joinStr = joinDate ? getBDDateString(joinDate) : null;
    const exitStr = exitDate ? getBDDateString(exitDate) : null;

    let workDaysCount = 0;
    let unemployedDays = 0;
    const expectedWorkDates: Date[] = [];
    const missingPunchDates: Date[] = [];

    for (const day of daysInMonth) {
        const dayStr = getBDDateString(day);

        // 1. Unemployed check (strictly before join or after exit).
        const isBeforeJoin = joinStr !== null && dayStr < joinStr;
        const isAfterExit = exitStr !== null && dayStr > exitStr;
        if (isBeforeJoin || isAfterExit) {
            unemployedDays++;
            continue;
        }

        // 2. Resolve the shift assignment covering this specific day.
        const dayAssignment = shiftAssignments.find((sa) => {
            const s = getBDDateString(sa.startDate);
            const e = sa.endDate ? getBDDateString(sa.endDate) : '9999-12-31';
            return dayStr >= s && dayStr <= e;
        });

        const shift = dayAssignment?.shiftId;
        if (!shift) continue;

        // 3. Skip if it's a specific "Off Date" for this shift.
        if (shiftOffDateStrings.includes(dayStr)) continue;

        // 4. Is it a work day for this shift?
        if (!shift.workDays.includes(getBDWeekDay(day))) continue;

        workDaysCount++;
        expectedWorkDates.push(day);

        // 5. Missing-punch check (only for days already in the past).
        if (dayStr < todayBDStr) {
            const hasRecord = attendanceRecords.some((a) => getBDDateString(a.date) === dayStr);
            if (!hasRecord) {
                missingPunchDates.push(day);
            }
        }
    }

    return { workDaysCount, unemployedDays, expectedWorkDates, missingPunchDates };
}

/**
 * E1-F2-T2: the payroll-amount confirmation decision, extracted as a pure
 * function so it's directly unit-testable without mocking Mongoose — same
 * rationale as `computeWorkDayStats` above. `processPayroll` in
 * payroll.service.ts calls this with `expectedAmount`/`receivedAmount`
 * already resolved from a DB-backed computation, and — critically — calls
 * it *before* opening any Mongo session/transaction, so the "no writes
 * before confirmation" guarantee holds by construction.
 */

/** Rounding tolerance below which a received/expected amount difference is not a mismatch. */
export const PAYROLL_AMOUNT_MISMATCH_TOLERANCE = 2;

export interface PayrollAmountConfirmationInput {
    expectedAmount: number;
    receivedAmount: number;
    bonus: number;
    deduction: number;
    /** Whether the caller has already acknowledged an out-of-tolerance amount. */
    confirm: boolean;
}

export type PayrollAmountConfirmationResult =
    | {
          /** Difference is within tolerance, or the caller confirmed an out-of-tolerance amount. */
          requiresConfirmation: false;
          difference: number;
          /** `bonus`/`deduction` folded to absorb a confirmed out-of-tolerance difference (unchanged if in-tolerance). */
          bonus: number;
          deduction: number;
      }
    | {
          /** Out of tolerance and not yet confirmed — caller must not proceed to any write. */
          requiresConfirmation: true;
          difference: number;
      };

/**
 * Decides whether a payroll amount mismatch requires explicit confirmation
 * before proceeding, and — when confirmed or in-tolerance — returns the
 * (possibly adjusted) `bonus`/`deduction` values to use, preserving this
 * codebase's pre-existing "fold the difference into bonus/deduction"
 * behavior for the confirmed case exactly as it was before this function
 * existed.
 */
export function resolvePayrollAmountConfirmation({
    expectedAmount,
    receivedAmount,
    bonus,
    deduction,
    confirm,
}: PayrollAmountConfirmationInput): PayrollAmountConfirmationResult {
    const difference = receivedAmount - expectedAmount;

    if (Math.abs(difference) <= PAYROLL_AMOUNT_MISMATCH_TOLERANCE) {
        return { requiresConfirmation: false, difference, bonus, deduction };
    }

    if (!confirm) {
        return { requiresConfirmation: true, difference };
    }

    // Confirmed: fold the discrepancy into bonus/deduction, exactly as this
    // codebase has always done once an override is acknowledged.
    let nextBonus = bonus;
    let nextDeduction = deduction;
    if (difference > 0) {
        nextBonus += difference;
    } else {
        nextDeduction -= difference;
    }
    return { requiresConfirmation: false, difference, bonus: nextBonus, deduction: nextDeduction };
}
