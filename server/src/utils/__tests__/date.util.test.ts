/**
 * Unit tests for E6-F2-T4: `date.util.ts`'s Bangladesh-timezone date
 * helpers. These are pure, dependency-free functions with no DB/network
 * I/O, but had zero dedicated test coverage despite being load-bearing for
 * every payroll day-counting computation this session touched
 * (`computeWorkDayStats`, `processPayroll`, `getPayrollPreview`,
 * `getAbsentDates` all call `getBDDateString`/`getBDWeekDay` directly).
 *
 * These are characterization tests for existing, documented behavior — no
 * production code was changed to write them.
 *
 * Run with: node --import tsx --test src/utils/__tests__/date.util.test.ts
 * (run from the `server/` directory)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    getBDNow,
    getBDStartOfDay,
    getBDEndOfDay,
    getBDMonthRange,
    getBDWeekDay,
    formatBD,
    getBDDateString,
    getPreviousMonthRange,
} from '../date.util.js';

describe('getBDDateString', () => {
    test('a UTC instant that is still "yesterday" in Dhaka returns the earlier date', () => {
        // 17:00 UTC + 6h offset = 23:00 same calendar day in Dhaka.
        assert.equal(getBDDateString(new Date('2026-01-15T17:00:00Z')), '2026-01-15');
    });

    test('a UTC instant exactly at the Dhaka midnight boundary rolls over to the next date', () => {
        // 18:00 UTC + 6h offset = 00:00 the next calendar day in Dhaka.
        assert.equal(getBDDateString(new Date('2026-01-15T18:00:00Z')), '2026-01-16');
    });

    test('accepts a string input identically to a Date object for the same instant', () => {
        const instant = '2026-06-10T10:00:00Z';
        assert.equal(getBDDateString(instant), getBDDateString(new Date(instant)));
    });

    test('accepts a numeric epoch-ms timestamp identically to a Date object for the same instant', () => {
        const ms = Date.parse('2026-06-10T10:00:00Z');
        assert.equal(getBDDateString(ms), getBDDateString(new Date(ms)));
    });

    test('always returns a zero-padded YYYY-MM-DD string', () => {
        assert.equal(getBDDateString(new Date('2026-03-05T12:00:00+06:00')), '2026-03-05');
        assert.equal(getBDDateString(new Date('2026-11-09T12:00:00+06:00')), '2026-11-09');
    });
});

describe('getBDStartOfDay / getBDEndOfDay', () => {
    test('getBDStartOfDay resolves to 00:00:00 Dhaka time for the given instant', () => {
        const start = getBDStartOfDay(new Date('2026-01-15T20:00:00Z')); // 2026-01-16 02:00 Dhaka
        assert.equal(getBDDateString(start), '2026-01-16');
        assert.equal(start.toISOString(), '2026-01-15T18:00:00.000Z'); // 00:00 Dhaka == 18:00 UTC previous day
    });

    test('getBDEndOfDay is exactly 24h minus 1ms after getBDStartOfDay for the same input', () => {
        const input = new Date('2026-01-15T20:00:00Z');
        const start = getBDStartOfDay(input);
        const end = getBDEndOfDay(input);
        assert.equal(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000 - 1);
    });

    test('getBDStartOfDay defaults to "now" when called with no argument', () => {
        // Just confirm it doesn't throw and returns a valid Date close to now,
        // rather than asserting an exact value (which would be flaky).
        const start = getBDStartOfDay();
        assert.ok(start instanceof Date && !Number.isNaN(start.getTime()));
        assert.ok(Math.abs(Date.now() - start.getTime()) < 25 * 60 * 60 * 1000);
    });

    test('getBDStartOfDay accepts a string and a numeric timestamp, matching the Date-object result', () => {
        const dateObj = new Date('2026-07-04T09:30:00Z');
        const start = getBDStartOfDay(dateObj);
        assert.equal(getBDStartOfDay('2026-07-04T09:30:00Z').getTime(), start.getTime());
        assert.equal(getBDStartOfDay(dateObj.getTime()).getTime(), start.getTime());
    });
});

describe('getBDWeekDay', () => {
    test('resolves the correct 0(Sun)-6(Sat) weekday index for a known week (2026-01-01 is a Thursday)', () => {
        const expected = [
            ['2026-01-01', 4], // Thursday
            ['2026-01-02', 5], // Friday
            ['2026-01-03', 6], // Saturday
            ['2026-01-04', 0], // Sunday
            ['2026-01-05', 1], // Monday
            ['2026-01-06', 2], // Tuesday
            ['2026-01-07', 3], // Wednesday
        ] as const;

        for (const [dateStr, weekday] of expected) {
            assert.equal(
                getBDWeekDay(new Date(`${dateStr}T12:00:00+06:00`)),
                weekday,
                `expected ${dateStr} to resolve to weekday index ${weekday}`,
            );
        }
    });

    test('resolves the Dhaka-local weekday, not the UTC weekday, near the day boundary', () => {
        // 2026-01-03T19:00:00Z is already 2026-01-04 01:00 in Dhaka (Sunday),
        // even though the UTC calendar day is still Saturday.
        assert.equal(getBDWeekDay(new Date('2026-01-03T19:00:00Z')), 0);
    });
});

describe('getBDMonthRange', () => {
    test('returns the correct start/end instants and parsed year/month for a normal month', () => {
        const { startDate, endDate, year, monthNum } = getBDMonthRange('2026-06');
        assert.equal(year, 2026);
        assert.equal(monthNum, 6);
        assert.equal(getBDDateString(startDate), '2026-06-01');
        assert.equal(getBDDateString(endDate), '2026-06-30');
        assert.equal(startDate.toISOString(), '2026-05-31T18:00:00.000Z'); // 2026-06-01 00:00 Dhaka
    });

    test('resolves the correct last day for a leap-year February', () => {
        const { endDate } = getBDMonthRange('2024-02');
        assert.equal(getBDDateString(endDate), '2024-02-29');
    });

    test('resolves the correct last day for a non-leap-year February', () => {
        const { endDate } = getBDMonthRange('2026-02');
        assert.equal(getBDDateString(endDate), '2026-02-28');
    });

    test('endDate is at the last millisecond of the month (23:59:59.999 Dhaka)', () => {
        const { endDate } = getBDMonthRange('2026-04');
        assert.equal(getBDDateString(endDate), '2026-04-30');
        // One millisecond later must roll into the next month.
        assert.equal(getBDDateString(new Date(endDate.getTime() + 1)), '2026-05-01');
    });
});

describe('getPreviousMonthRange', () => {
    test('for a mid-year month, returns the immediately preceding month with no year rollover', () => {
        // getPreviousMonthRange is anchored on getBDNow() (today), so we only
        // assert the structural invariant (previous calendar month, correct
        // year) relative to whatever "today" resolves to, rather than a
        // hardcoded date — otherwise this test would go stale and start
        // failing for reasons unrelated to the function's correctness.
        const now = getBDNow();
        const nowParts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Dhaka',
            year: 'numeric',
            month: 'numeric',
        }).formatToParts(now);
        const currentYear = Number(nowParts.find((p) => p.type === 'year')?.value);
        const currentMonth = Number(nowParts.find((p) => p.type === 'month')?.value);

        const { month, year } = getPreviousMonthRange();

        if (currentMonth === 1) {
            assert.equal(month, 12);
            assert.equal(year, currentYear - 1);
        } else {
            assert.equal(month, currentMonth - 1);
            assert.equal(year, currentYear);
        }
    });

    test('startDate/endDate/monthName are internally consistent with the returned month/year', () => {
        const { startDate, endDate, month, year, monthName } = getPreviousMonthRange();

        assert.equal(getBDDateString(startDate), `${year}-${String(month).padStart(2, '0')}-01`);
        assert.ok(startDate instanceof Date && endDate instanceof Date);
        assert.ok(endDate.getTime() > startDate.getTime());
        assert.ok(typeof monthName === 'string' && monthName.length > 0);
    });
});

describe('formatBD', () => {
    test('formats a known instant into a readable Dhaka-local string containing the expected date and time', () => {
        // 2026-01-15T20:00:00Z == 2026-01-16 02:00 AM in Dhaka.
        const formatted = formatBD(new Date('2026-01-15T20:00:00Z'));
        assert.match(formatted, /2026/);
        assert.match(formatted, /January/);
        assert.match(formatted, /16/);
        assert.match(formatted, /02:00/);
        assert.match(formatted, /AM/i);
    });
});
