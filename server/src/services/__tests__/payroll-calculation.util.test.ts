/**
 * Unit tests for E1-F2-T1: computeWorkDayStats(), the day-counting
 * calculation extracted from three previously duplicated implementations in
 * payroll.service.ts (getPayrollPreview, processPayroll, getAbsentDates).
 *
 * computeWorkDayStats has no DB/Mongoose dependency — it's a pure function
 * of plain data — so this suite exercises it directly with constructed
 * fixtures, no DB or mocking required.
 *
 * Includes one dedicated test (see "two-pass vs single-pass equivalence"
 * below) that mechanically re-implements getAbsentDates' original two-pass
 * algorithm (unemployed-check deferred to a second pass over pre-collected
 * candidate days) and asserts it produces the identical missingPunchDates
 * result as computeWorkDayStats' single-pass structure, for the same
 * fixture. This is the executable form of the equivalence proof used to
 * justify this extraction being safe (see payroll-calculation.util.ts's
 * header comment) — a regression here would mean the extraction changed
 * real behavior, not just structure.
 *
 * Run with: node --import tsx --test src/services/__tests__/payroll-calculation.util.test.ts
 * (run from the `server/` directory)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    computeWorkDayStats,
    type ComputeWorkDayStatsInput,
    type WorkDayShiftAssignment,
    type WorkDayAttendanceRecord,
} from '../payroll-calculation.util.js';
import { getBDDateString, getBDWeekDay } from '../../utils/date.util.js';

function bdDate(dateStr: string): Date {
    // Construct a Date whose BD-local calendar day is exactly `dateStr`.
    return new Date(`${dateStr}T00:00:00+06:00`);
}

function daysInRange(startStr: string, endStr: string): Date[] {
    const days: Date[] = [];
    let cursor = bdDate(startStr);
    const end = bdDate(endStr);
    while (cursor.getTime() <= end.getTime()) {
        days.push(cursor);
        cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
    return days;
}

const ALL_WEEKDAYS_SHIFT = { workDays: [0, 1, 2, 3, 4, 5, 6] };

function assignment(overrides: Partial<WorkDayShiftAssignment> = {}): WorkDayShiftAssignment {
    return {
        startDate: bdDate('2026-01-01'),
        endDate: null,
        shiftId: ALL_WEEKDAYS_SHIFT,
        ...overrides,
    };
}

function baseInput(overrides: Partial<ComputeWorkDayStatsInput> = {}): ComputeWorkDayStatsInput {
    return {
        daysInMonth: daysInRange('2026-01-01', '2026-01-31'),
        shiftAssignments: [assignment()],
        attendanceRecords: [],
        shiftOffDateStrings: [],
        joinDate: null,
        exitDate: null,
        // Firmly after the whole month, so every day counts as "in the past".
        todayBDStr: '2026-02-15',
        ...overrides,
    };
}

describe('computeWorkDayStats — basic day resolution', () => {
    test('every day in the month is a work day when the shift covers all weekdays and staff was employed the whole month', () => {
        const result = computeWorkDayStats(baseInput());
        assert.equal(result.workDaysCount, 31);
        assert.equal(result.unemployedDays, 0);
        assert.equal(result.expectedWorkDates.length, 31);
    });

    test('with no attendance records at all, every past work day is a missing punch', () => {
        const result = computeWorkDayStats(baseInput());
        assert.equal(result.missingPunchDates.length, 31);
    });

    test('a matching attendance record removes that day from missingPunchDates but not from workDaysCount', () => {
        const attendanceRecords: WorkDayAttendanceRecord[] = [{ date: bdDate('2026-01-05') }];
        const result = computeWorkDayStats(baseInput({ attendanceRecords }));
        assert.equal(result.workDaysCount, 31);
        assert.equal(result.missingPunchDates.length, 30);
        assert.ok(!result.missingPunchDates.some((d) => getBDDateString(d) === '2026-01-05'));
    });

    test('attendance date supplied as a string produces the same result as a Date object', () => {
        const asDate = computeWorkDayStats(baseInput({ attendanceRecords: [{ date: bdDate('2026-01-05') }] }));
        const asString = computeWorkDayStats(baseInput({ attendanceRecords: [{ date: '2026-01-05T00:00:00+06:00' }] }));
        assert.equal(asDate.missingPunchDates.length, asString.missingPunchDates.length);
    });
});

describe('computeWorkDayStats — employment window (join/exit dates)', () => {
    test('days strictly before joinDate are counted as unemployed, not as work days', () => {
        const result = computeWorkDayStats(baseInput({ joinDate: bdDate('2026-01-10') }));
        // Jan 1-9 unemployed (9 days), Jan 10-31 employed (22 days)
        assert.equal(result.unemployedDays, 9);
        assert.equal(result.workDaysCount, 22);
    });

    test('days strictly after exitDate are counted as unemployed, not as work days', () => {
        const result = computeWorkDayStats(baseInput({ exitDate: bdDate('2026-01-20') }));
        // Jan 1-20 employed (20 days), Jan 21-31 unemployed (11 days)
        assert.equal(result.workDaysCount, 20);
        assert.equal(result.unemployedDays, 11);
    });

    test('joinDate and exitDate together bound employment to a mid-month window', () => {
        const result = computeWorkDayStats(
            baseInput({ joinDate: bdDate('2026-01-10'), exitDate: bdDate('2026-01-20') }),
        );
        assert.equal(result.workDaysCount, 11); // Jan 10-20 inclusive
        assert.equal(result.unemployedDays, 20); // 9 before + 11 after
    });

    test('unemployed days are never counted as missing punches, even with zero attendance records', () => {
        const result = computeWorkDayStats(baseInput({ joinDate: bdDate('2026-01-25') }));
        // Only Jan 25-31 (7 days) are employed/work days/missing punches; the other 24 are unemployed.
        assert.equal(result.workDaysCount, 7);
        assert.equal(result.missingPunchDates.length, 7);
    });
});

describe('computeWorkDayStats — shift resolution', () => {
    test('a day with no shift assignment covering it is excluded from workDaysCount entirely (not unemployed)', () => {
        const result = computeWorkDayStats(
            baseInput({ shiftAssignments: [assignment({ endDate: bdDate('2026-01-15') })] }),
        );
        assert.equal(result.workDaysCount, 15); // Jan 1-15 only
        assert.equal(result.unemployedDays, 0); // not unemployed, just unassigned
    });

    test('a shift that excludes a specific weekday drops matching days from workDaysCount', () => {
        // Find which weekday Jan 4, 2026 falls on (BD time) and exclude it from the shift.
        const excludedWeekday = getBDWeekDay(bdDate('2026-01-04'));
        const allExceptOne = [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== excludedWeekday);
        const result = computeWorkDayStats(
            baseInput({ shiftAssignments: [assignment({ shiftId: { workDays: allExceptOne } })] }),
        );
        assert.ok(!result.expectedWorkDates.some((d) => getBDDateString(d) === '2026-01-04'));
    });

    test('multiple shift assignments covering different sub-ranges resolve the correct shift per day', () => {
        const excludedWeekday = getBDWeekDay(bdDate('2026-01-20'));
        const restrictedShift = { workDays: [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== excludedWeekday) };
        const shiftAssignments: WorkDayShiftAssignment[] = [
            assignment({ startDate: bdDate('2026-01-01'), endDate: bdDate('2026-01-15') }),
            { startDate: bdDate('2026-01-16'), endDate: null, shiftId: restrictedShift },
        ];
        const result = computeWorkDayStats(baseInput({ shiftAssignments }));
        // The second shift's restriction should only affect days from Jan 16 onward.
        assert.ok(!result.expectedWorkDates.some((d) => getBDDateString(d) === '2026-01-20'));
    });
});

describe('computeWorkDayStats — shift off-dates', () => {
    test('a day matching a shift off-date is excluded from workDaysCount and missingPunchDates, even though the shift covers that weekday', () => {
        const result = computeWorkDayStats(baseInput({ shiftOffDateStrings: ['2026-01-15'] }));
        assert.equal(result.workDaysCount, 30);
        assert.ok(!result.expectedWorkDates.some((d) => getBDDateString(d) === '2026-01-15'));
        assert.ok(!result.missingPunchDates.some((d) => getBDDateString(d) === '2026-01-15'));
    });
});

describe('computeWorkDayStats — "today" boundary (future days excluded from missing punches)', () => {
    test('days on/after todayBDStr are counted in workDaysCount but never flagged as missing punches', () => {
        const result = computeWorkDayStats(baseInput({ todayBDStr: '2026-01-20' }));
        // Jan 1-19 are "in the past" (19 days); Jan 20-31 are today/future (12 days), not eligible for missing-punch.
        assert.equal(result.workDaysCount, 31);
        assert.equal(result.missingPunchDates.length, 19);
        assert.ok(!result.missingPunchDates.some((d) => getBDDateString(d) >= '2026-01-20'));
    });
});

describe('computeWorkDayStats — edge cases', () => {
    test('empty shiftAssignments array: every day is excluded from workDaysCount (no 22-day fallback here — that is a caller-side decision)', () => {
        const result = computeWorkDayStats(baseInput({ shiftAssignments: [] }));
        assert.equal(result.workDaysCount, 0);
        assert.equal(result.expectedWorkDates.length, 0);
        assert.equal(result.missingPunchDates.length, 0);
    });

    test('null joinDate/exitDate means no employment-window restriction at all', () => {
        const result = computeWorkDayStats(baseInput({ joinDate: null, exitDate: null }));
        assert.equal(result.unemployedDays, 0);
        assert.equal(result.workDaysCount, 31);
    });
});

describe('computeWorkDayStats — two-pass vs single-pass equivalence (the extraction safety proof)', () => {
    /**
     * Re-implements getAbsentDates' ORIGINAL two-pass algorithm exactly as
     * it existed before E1-F2-T1: pass 1 builds `expectedWorkDates` from
     * off-date + shift checks only (no unemployed check); pass 2 iterates
     * just those candidate days and applies the unemployed + attendance
     * checks to build the missing-punch list. This is deliberately
     * duplicated here, not imported from anywhere, so this test proves
     * equivalence against an independent re-derivation of the old logic,
     * not against the new implementation testing itself.
     */
    function legacyTwoPassMissingPunchDates(input: ComputeWorkDayStatsInput): Date[] {
        const { daysInMonth, shiftAssignments, attendanceRecords, shiftOffDateStrings, joinDate, exitDate, todayBDStr } =
            input;
        const joinStr = joinDate ? getBDDateString(joinDate) : null;
        const exitStr = exitDate ? getBDDateString(exitDate) : null;

        const expectedWorkDates: Date[] = [];
        for (const day of daysInMonth) {
            const dayStr = getBDDateString(day);
            if (shiftOffDateStrings.includes(dayStr)) continue;
            const dayAssignment = shiftAssignments.find((sa) => {
                const s = getBDDateString(sa.startDate);
                const e = sa.endDate ? getBDDateString(sa.endDate) : '9999-12-31';
                return dayStr >= s && dayStr <= e;
            });
            const shift = dayAssignment?.shiftId;
            if (shift && shift.workDays.includes(getBDWeekDay(day))) {
                expectedWorkDates.push(day);
            }
        }

        const missingPunches: Date[] = [];
        for (const day of expectedWorkDates) {
            const dayStr = getBDDateString(day);
            if (dayStr >= todayBDStr) continue;
            const isBeforeJoin = joinStr !== null && dayStr < joinStr;
            const isAfterExit = exitStr !== null && dayStr > exitStr;
            if (isBeforeJoin || isAfterExit) continue;
            const hasRecord = attendanceRecords.some((a) => getBDDateString(a.date) === dayStr);
            if (!hasRecord) missingPunches.push(day);
        }
        return missingPunches;
    }

    test('single-pass computeWorkDayStats matches the legacy two-pass algorithm on a combined fixture (unemployment + off-dates + partial attendance)', () => {
        const excludedWeekday = getBDWeekDay(bdDate('2026-01-08'));
        const shift = { workDays: [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== excludedWeekday) };
        const input = baseInput({
            shiftAssignments: [assignment({ shiftId: shift })],
            shiftOffDateStrings: ['2026-01-12', '2026-01-13'],
            joinDate: bdDate('2026-01-05'),
            exitDate: bdDate('2026-01-25'),
            attendanceRecords: [{ date: bdDate('2026-01-10') }, { date: bdDate('2026-01-18') }],
            todayBDStr: '2026-01-22',
        });

        const legacy = legacyTwoPassMissingPunchDates(input).map(getBDDateString).sort();
        const current = computeWorkDayStats(input).missingPunchDates.map(getBDDateString).sort();

        assert.deepEqual(current, legacy);
    });

    test('single-pass and legacy two-pass agree across a wide sweep of randomized-ish fixtures', () => {
        const scenarios: ComputeWorkDayStatsInput[] = [
            baseInput({ joinDate: bdDate('2026-01-03'), shiftOffDateStrings: ['2026-01-06', '2026-01-19'] }),
            baseInput({ exitDate: bdDate('2026-01-28'), attendanceRecords: [{ date: bdDate('2026-01-02') }] }),
            baseInput({
                joinDate: bdDate('2026-01-01'),
                exitDate: bdDate('2026-01-31'),
                shiftOffDateStrings: ['2026-01-01', '2026-01-31'],
                todayBDStr: '2026-01-16',
            }),
            baseInput({ shiftAssignments: [] }),
        ];

        for (const [i, scenario] of scenarios.entries()) {
            const legacy = legacyTwoPassMissingPunchDates(scenario).map(getBDDateString).sort();
            const current = computeWorkDayStats(scenario).missingPunchDates.map(getBDDateString).sort();
            assert.deepEqual(current, legacy, `scenario #${i} diverged`);
        }
    });
});
