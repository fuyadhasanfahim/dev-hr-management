// E1-F2-T2 frontend companion: pure helpers for the payroll amount-mismatch
// confirmation flow (single payment) and the bulk-payment result summary.
// Kept dependency-free (no RTK/React import) so these are directly
// unit-testable, same approach as src/constants/orderStatusWorkflow.ts.

export interface PayrollAmountMismatchDetails {
    expectedAmount: number;
    receivedAmount: number;
    difference: number;
}

/**
 * Recognizes the backend's `409 PAYROLL_AMOUNT_MISMATCH` response shape
 * (server/src/controllers/payroll.controller.ts's `processPayment`) from an
 * RTK Query error object and extracts its structured details. Returns
 * `null` for anything else — including a 409 for an unrelated reason, or a
 * malformed body — so callers can safely fall back to generic error
 * handling instead of crashing on an unexpected shape.
 */
export function getPayrollAmountMismatchDetails(error: unknown): PayrollAmountMismatchDetails | null {
    if (!error || typeof error !== "object") return null;

    const status = (error as { status?: unknown }).status;
    if (status !== 409) return null;

    const body = (error as { data?: unknown }).data;
    if (!body || typeof body !== "object") return null;

    const code = (body as { code?: unknown }).code;
    if (code !== "PAYROLL_AMOUNT_MISMATCH") return null;

    const data = (body as { data?: unknown }).data;
    if (!data || typeof data !== "object") return null;

    const { expectedAmount, receivedAmount, difference } = data as Record<string, unknown>;
    if (
        typeof expectedAmount !== "number" ||
        typeof receivedAmount !== "number" ||
        typeof difference !== "number"
    ) {
        return null;
    }

    return { expectedAmount, receivedAmount, difference };
}

export interface BulkPayrollSuccessItem {
    staffId: string;
    status: "success";
    expenseId: string;
}

export interface BulkPayrollErrorItem {
    staffId: string;
    status: "failed";
    message: string;
}

export interface BulkPayrollResult {
    results: BulkPayrollSuccessItem[];
    errors: BulkPayrollErrorItem[];
}

export interface BulkPayrollSummary {
    successCount: number;
    failureCount: number;
    /** Whether any staff member failed — the caller must not claim unconditional success when true. */
    hasFailures: boolean;
    /** Up to `maxLines` "<label>: <message>" lines, for compact display. */
    errorLines: string[];
    /** How many further failures exist beyond errorLines. */
    additionalErrorCount: number;
}

/**
 * Summarizes a bulk-payment API result (server/src/services/payroll.service.ts's
 * `bulkProcessPayment`, which always responds `200` and reports per-staff
 * outcomes in `results`/`errors` rather than failing the whole request) into
 * counts and a bounded list of error lines suitable for a toast.
 */
export function summarizeBulkPayrollResult(
    result: BulkPayrollResult,
    getStaffLabel: (staffId: string) => string,
    maxLines = 3,
): BulkPayrollSummary {
    const successCount = result.results?.length ?? 0;
    const errors = result.errors ?? [];
    const failureCount = errors.length;
    const errorLines = errors.slice(0, maxLines).map((e) => `${getStaffLabel(e.staffId)}: ${e.message}`);
    const additionalErrorCount = Math.max(0, failureCount - errorLines.length);

    return {
        successCount,
        failureCount,
        hasFailures: failureCount > 0,
        errorLines,
        additionalErrorCount,
    };
}
