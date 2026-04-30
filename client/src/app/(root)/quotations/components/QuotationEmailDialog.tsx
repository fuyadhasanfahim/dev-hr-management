"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Loader2,
    Mail,
    Star,
    Users,
    X,
    AlertTriangle,
    CheckCircle2,
    XCircle,
} from "lucide-react";
import { useGetClientEmailsQuery } from "@/redux/features/client/clientApi";
import type { ClientEmail } from "@/types/client.type";
import type { RecipientSendStatus } from "@/redux/features/quotation/quotationApi";

export interface QuotationEmailDialogProps {
    open: boolean;
    onClose: () => void;
    /** Mongo `_id` of the client that owns this quotation. */
    clientId: string;
    /** Display info shown in the dialog header. */
    quotationLabel?: string;
    /** Extra emails to include in the list (e.g. manually entered on a builder). */
    extraEmails?: string[];
    /**
     * Called when the user confirms. Implementer is responsible for sequential sending.
     * Should resolve with the list of per-recipient delivery results so the dialog can
     * render an actionable summary; resolving with `void` falls back to a generic toast.
     */
    onSend: (
        selectedEmails: string[],
    ) => Promise<RecipientSendStatus[] | void> | RecipientSendStatus[] | void;
    isSending?: boolean;
}

interface EmailOption {
    email: string;
    label: string;
    /** "primary" (first client email) | "client" (other client emails) | "team_member" | "manual" */
    type: "primary" | "client" | "team_member" | "manual";
}

/** Group entries so we can render section labels without re-sorting. */
function groupOptions(options: EmailOption[]) {
    const primary = options.filter((o) => o.type === "primary");
    const client = options.filter((o) => o.type === "client");
    const team = options.filter((o) => o.type === "team_member");
    const manual = options.filter((o) => o.type === "manual");
    return { primary, client, team, manual };
}

/**
 * Tailwind-only modal that lets the staff user pick which client/team emails
 * should receive a quotation. Pre-selects the primary email by default.
 */
export function QuotationEmailDialog({
    open,
    onClose,
    clientId,
    quotationLabel,
    extraEmails = [],
    onSend,
    isSending = false,
}: QuotationEmailDialogProps) {
    const { data: clientEmails, isLoading } = useGetClientEmailsQuery(
        clientId,
        { skip: !clientId || !open },
    );

    const options = useMemo<EmailOption[]>(() => {
        const map = new Map<string, EmailOption>();

        // Server-provided labeled list. Backend already marks the first client
        // email with "(Primary)" in its label and uses type "client" for it.
        // We elevate the FIRST one labeled with "(Primary)" to type "primary".
        let primaryAssigned = false;
        (clientEmails || []).forEach((e: ClientEmail) => {
            const email = (e.email || "").trim();
            if (!email) return;
            const key = email.toLowerCase();
            if (map.has(key)) return;

            const isPrimary =
                !primaryAssigned &&
                e.type === "client" &&
                /\(Primary\)/i.test(e.label || "");

            if (isPrimary) primaryAssigned = true;

            map.set(key, {
                email,
                label: e.label || email,
                type: isPrimary
                    ? "primary"
                    : e.type === "team_member"
                        ? "team_member"
                        : "client",
            });
        });

        // Fallback: if the server list returned no "(Primary)" hint but did
        // return at least one client-typed email, mark the first one primary.
        if (!primaryAssigned) {
            for (const opt of map.values()) {
                if (opt.type === "client") {
                    opt.type = "primary";
                    break;
                }
            }
        }

        // Manual extras (e.g. typed in builder form).
        for (const raw of extraEmails) {
            const email = (raw || "").trim();
            if (!email) continue;
            const key = email.toLowerCase();
            if (!map.has(key)) {
                map.set(key, { email, label: "Manual", type: "manual" });
            }
        }

        return Array.from(map.values());
    }, [clientEmails, extraEmails]);

    const [selected, setSelected] = useState<string[]>([]);
    const [results, setResults] = useState<RecipientSendStatus[] | null>(null);

    // Re-entrancy guard: prevents double-submits when a user clicks the
    // confirm button rapidly before the parent's `isSending` flag flips on
    // (RTK Query's `isLoading` state is not synchronous with the click).
    const submitLockRef = useRef(false);

    // Pre-select primary when dialog opens / options change. Also clear any
    // previous send results so the dialog opens on the picker step.
    useEffect(() => {
        if (!open) return;
        submitLockRef.current = false;
        setResults(null);
        const primary = options.find((o) => o.type === "primary");
        if (primary) {
            setSelected([primary.email]);
        } else if (options.length > 0) {
            setSelected([options[0].email]);
        } else {
            setSelected([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, options.length]);

    if (!open) return null;

    const inFlight = isSending || submitLockRef.current;
    const hasResults = Array.isArray(results) && results.length > 0;

    const toggle = (email: string) => {
        if (inFlight || hasResults) return;
        setSelected((prev) =>
            prev.includes(email)
                ? prev.filter((e) => e !== email)
                : Array.from(new Set([...prev, email])),
        );
    };

    const grouped = groupOptions(options);
    const noneSelected = selected.length === 0;

    const handleConfirm = async () => {
        if (noneSelected || inFlight) return;
        // Lock first, *then* call onSend. This prevents a second click from
        // starting another in-flight request before React commits state.
        submitLockRef.current = true;
        try {
            const out = await onSend(selected);
            if (Array.isArray(out)) {
                setResults(out);
            }
        } finally {
            submitLockRef.current = false;
        }
    };

    const handleClose = () => {
        if (inFlight) return;
        setResults(null);
        onClose();
    };

    const successCount = hasResults
        ? results!.filter((r) => r.status === "sent").length
        : 0;
    const failedCount = hasResults
        ? results!.filter((r) => r.status === "failed").length
        : 0;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quotation-email-dialog-title"
            aria-busy={inFlight}
        >
            <button
                type="button"
                aria-label="Close"
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] transition-opacity"
                onClick={handleClose}
            />

            <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-100">
                    <div className="flex items-start gap-3 min-w-0">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                            <Mail className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                            <h2
                                id="quotation-email-dialog-title"
                                className="text-base font-semibold text-slate-900 truncate"
                            >
                                {hasResults
                                    ? "Delivery summary"
                                    : "Send quotation to client"}
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                                {quotationLabel
                                    ? hasResults
                                        ? `Results for ${quotationLabel}`
                                        : `Recipients for ${quotationLabel}`
                                    : "Select one or more recipients."}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={inFlight}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-5">
                    {hasResults ? (
                        <ResultsView
                            results={results!}
                            successCount={successCount}
                            failedCount={failedCount}
                        />
                    ) : isLoading ? (
                        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-10 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading recipient list…
                        </div>
                    ) : options.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
                            <p className="text-sm font-medium text-slate-700">
                                No emails available for this client.
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                Add at least one email to the client profile or team members
                                first.
                            </p>
                        </div>
                    ) : (
                        <fieldset
                            disabled={inFlight}
                            className="max-h-[55vh] overflow-y-auto pr-1 space-y-5 disabled:opacity-70"
                        >
                            {grouped.primary.length > 0 && (
                                <Section title="Primary recipient">
                                    {grouped.primary.map((opt) => (
                                        <EmailRow
                                            key={opt.email}
                                            opt={opt}
                                            checked={selected.includes(opt.email)}
                                            onToggle={() => toggle(opt.email)}
                                            disabled={inFlight}
                                        />
                                    ))}
                                </Section>
                            )}

                            {grouped.client.length > 0 && (
                                <Section title="Other client emails">
                                    {grouped.client.map((opt) => (
                                        <EmailRow
                                            key={opt.email}
                                            opt={opt}
                                            checked={selected.includes(opt.email)}
                                            onToggle={() => toggle(opt.email)}
                                            disabled={inFlight}
                                        />
                                    ))}
                                </Section>
                            )}

                            {grouped.team.length > 0 && (
                                <Section title="Team members">
                                    {grouped.team.map((opt) => (
                                        <EmailRow
                                            key={opt.email}
                                            opt={opt}
                                            checked={selected.includes(opt.email)}
                                            onToggle={() => toggle(opt.email)}
                                            disabled={inFlight}
                                        />
                                    ))}
                                </Section>
                            )}

                            {grouped.manual.length > 0 && (
                                <Section title="Other">
                                    {grouped.manual.map((opt) => (
                                        <EmailRow
                                            key={opt.email}
                                            opt={opt}
                                            checked={selected.includes(opt.email)}
                                            onToggle={() => toggle(opt.email)}
                                            disabled={inFlight}
                                        />
                                    ))}
                                </Section>
                            )}
                        </fieldset>
                    )}

                    {!hasResults && noneSelected && options.length > 0 && (
                        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                            <span>Please select at least one recipient.</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100 p-5">
                    {hasResults ? (
                        <>
                            <p className="text-[11px] text-slate-500">
                                {successCount > 0 && `${successCount} sent`}
                                {successCount > 0 && failedCount > 0 ? " • " : ""}
                                {failedCount > 0 && `${failedCount} failed`}
                            </p>
                            <div className="flex items-center gap-2 sm:justify-end">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                                >
                                    Done
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-[11px] text-slate-500">
                                {selected.length > 0
                                    ? `${selected.length} recipient${selected.length === 1 ? "" : "s"} selected • emails are sent one by one`
                                    : "Pick at least one recipient."}
                            </p>
                            <div className="flex items-center gap-2 sm:justify-end">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={inFlight}
                                    className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={inFlight || noneSelected || options.length === 0}
                                    aria-disabled={inFlight || noneSelected || options.length === 0}
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-teal-600/20"
                                >
                                    {inFlight ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Sending…
                                        </>
                                    ) : (
                                        <>
                                            <Mail className="h-4 w-4" />
                                            Send to {selected.length || 0}
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {title}
            </h3>
            <div className="space-y-2">{children}</div>
        </section>
    );
}

function EmailRow({
    opt,
    checked,
    onToggle,
    disabled = false,
}: {
    opt: EmailOption;
    checked: boolean;
    onToggle: () => void;
    disabled?: boolean;
}) {
    const isPrimary = opt.type === "primary";
    const isTeam = opt.type === "team_member";

    return (
        <label
            className={[
                "group flex items-start gap-3 rounded-xl border p-3 transition-colors",
                disabled ? "cursor-not-allowed" : "cursor-pointer",
                checked
                    ? "border-teal-500 bg-teal-50/60 ring-1 ring-teal-500/30"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                isPrimary && !checked ? "border-teal-200 bg-teal-50/30" : "",
            ].join(" ")}
        >
            <input
                type="checkbox"
                checked={checked}
                onChange={onToggle}
                disabled={disabled}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-500 disabled:cursor-not-allowed"
            />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-900 truncate">
                        {opt.email}
                    </span>
                    {isPrimary && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-teal-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
                            <Star className="h-3 w-3" />
                            Primary
                        </span>
                    )}
                    {isTeam && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            <Users className="h-3 w-3" />
                            Team
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{opt.label}</p>
            </div>
        </label>
    );
}

function ResultsView({
    results,
    successCount,
    failedCount,
}: {
    results: RecipientSendStatus[];
    successCount: number;
    failedCount: number;
}) {
    return (
        <div className="space-y-3">
            <div
                className={[
                    "rounded-xl border p-3 text-xs",
                    failedCount === 0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : successCount === 0
                            ? "border-red-200 bg-red-50 text-red-800"
                            : "border-amber-200 bg-amber-50 text-amber-800",
                ].join(" ")}
            >
                {failedCount === 0
                    ? `All ${successCount} email${successCount === 1 ? "" : "s"} delivered.`
                    : successCount === 0
                        ? `Delivery failed for all ${failedCount} recipient${failedCount === 1 ? "" : "s"}.`
                        : `Delivered to ${successCount}, failed for ${failedCount}.`}
            </div>

            <ul className="max-h-[55vh] overflow-y-auto pr-1 space-y-2">
                {results.map((r) => {
                    const ok = r.status === "sent";
                    return (
                        <li
                            key={r.email}
                            className={[
                                "flex items-start gap-3 rounded-xl border p-3",
                                ok
                                    ? "border-emerald-200 bg-emerald-50/40"
                                    : "border-red-200 bg-red-50/40",
                            ].join(" ")}
                        >
                            {ok ? (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-slate-900 truncate">
                                        {r.email}
                                    </span>
                                    <span
                                        className={[
                                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                            ok
                                                ? "bg-emerald-600/10 text-emerald-700"
                                                : "bg-red-600/10 text-red-700",
                                        ].join(" ")}
                                    >
                                        {ok ? "Sent" : "Failed"}
                                    </span>
                                </div>
                                {!ok && r.error && (
                                    <p className="text-xs text-red-700/90 mt-0.5 wrap-break-word">
                                        {r.error}
                                    </p>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default QuotationEmailDialog;
