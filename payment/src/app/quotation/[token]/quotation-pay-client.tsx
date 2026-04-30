"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    CreditCard,
    FileText,
    Layers,
    Loader2,
    Lock,
    PartyPopper,
    ReceiptText,
    Shield,
    Sparkles,
    Wallet,
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import StripePhaseCheckout from "./stripe-phase-checkout";
import PayPalPhaseCheckout from "./paypal-phase-checkout";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type PaymentProvider = "stripe" | "paypal";
type Phase = "upfront" | "delivery" | "final";

type QuotationPhase = {
    title?: string;
    description?: string;
    items?: string[];
    startDate?: string;
    endDate?: string;
};

type AdditionalService = {
    title: string;
    price: number;
    billingCycle?: string;
    description?: string;
};

type PaymentMilestone = {
    label: string;
    percentage: number;
    note?: string;
};

type Quotation = {
    _id: string;
    quotationGroupId: string;
    quotationNumber: string;
    status: string;
    currency?: string;
    totals?: { subtotal?: number; taxAmount?: number; grandTotal?: number };
    pricing?: { basePrice?: number; taxRate?: number; discount?: number };
    details?: { title?: string; date?: string; validUntil?: string };
    overview?: string;
    client?: { contactName?: string; companyName?: string; email?: string };
    company?: { name?: string };
    techStack?: { frontend?: string; backend?: string; database?: string; tools?: string[] };
    workflow?: string[];
    phases?: QuotationPhase[];
    additionalServices?: AdditionalService[];
    paymentMilestones?: PaymentMilestone[];
};

type OrderAsset = {
    _id: string;
    label: string;
    type: string;
    isLocked: boolean;
};

type QuotationPaymentTracker = {
    quotationGroupId: string;
    currency: string;
    /** Grand total in **smallest currency unit** (cents). */
    totalAmount: number;
    phases: Record<
        Phase,
        {
            status: "pending" | "processing" | "partial" | "paid" | "failed";
            percentage: number;
            amountDue: number;
            amountPaid: number;
            paidAt?: string;
            paymentIntentId?: string;
            provider?: string;
        }
    >;
    summary?: {
        paidPhases: Phase[];
        totalPaid: number;
        remainingAmount: number;
        nextPayablePhase: Phase | null;
        progressPercent: number;
        allPaid: boolean;
    };
    order?: {
        status: string;
        orderNumber: string;
        assets: OrderAsset[];
    } | null;
};

const stripePromise = loadStripe(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
);

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function formatMoney(amount: number, currency: string) {
    try {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency || "USD",
        }).format(amount);
    } catch {
        return `${amount} ${currency || ""}`.trim();
    }
}

function phaseLabel(phase: Phase) {
    if (phase === "upfront") return "Upfront";
    if (phase === "delivery") return "Delivery";
    return "Final";
}

function phasePrerequisitesMet(phase: Phase, tracker: QuotationPaymentTracker | null) {
    if (!tracker) return false;
    if (phase === "upfront") return true;
    if (phase === "delivery") return tracker.phases.upfront.status === "paid";
    return tracker.phases.delivery.status === "paid";
}

/** Derive a summary locally if the backend hasn't provided one. */
function computeSummary(tracker: QuotationPaymentTracker) {
    if (tracker.summary) return tracker.summary;
    const phases: Phase[] = ["upfront", "delivery", "final"];
    const paidPhases = phases.filter((p) => tracker.phases[p].status === "paid");
    const totalPaid = phases.reduce((s, p) => s + tracker.phases[p].amountPaid, 0);
    const remainingAmount = tracker.totalAmount - totalPaid;
    const nextPayablePhase: Phase | null =
        tracker.phases.upfront.status !== "paid"
            ? "upfront"
            : tracker.phases.delivery.status !== "paid"
                ? "delivery"
                : tracker.phases.final.status !== "paid"
                    ? "final"
                    : null;
    const progressPercent =
        tracker.totalAmount > 0
            ? Math.round((totalPaid / tracker.totalAmount) * 100)
            : 0;
    return {
        paidPhases,
        totalPaid,
        remainingAmount,
        nextPayablePhase,
        progressPercent,
        allPaid: paidPhases.length === 3,
    };
}

function formatDate(raw?: string) {
    if (!raw) return "—";
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) return raw;
    try {
        return new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }).format(d);
    } catch {
        return raw;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Small, presentational, Tailwind-only sub-components
// ──────────────────────────────────────────────────────────────────────────────

function SectionShell({
    icon,
    title,
    subtitle,
    children,
    className = "",
}: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section
            className={`rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] ${className}`}
        >
            <div className="flex items-start gap-3 mb-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                    {icon}
                </span>
                <div>
                    <h2 className="text-lg font-semibold text-slate-900 leading-tight">
                        {title}
                    </h2>
                    {subtitle ? (
                        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
                    ) : null}
                </div>
            </div>
            {children}
        </section>
    );
}

function ProgressBar({
    progressPercent,
    paidCount,
}: {
    progressPercent: number;
    paidCount: number;
}) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{paidCount} of 3 phases paid</span>
                <span className="font-semibold text-slate-700">{progressPercent}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                    className="h-full rounded-full bg-linear-to-r from-teal-500 to-emerald-500 transition-all duration-700"
                    style={{ width: `${Math.max(progressPercent, 4)}%` }}
                />
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        accepted: "bg-teal-50 text-teal-700 ring-teal-200",
        sent: "bg-blue-50 text-blue-700 ring-blue-200",
        viewed: "bg-indigo-50 text-indigo-700 ring-indigo-200",
        change_requested: "bg-purple-50 text-purple-700 ring-purple-200",
        rejected: "bg-red-50 text-red-700 ring-red-200",
        expired: "bg-orange-50 text-orange-700 ring-orange-200",
        draft: "bg-slate-50 text-slate-700 ring-slate-200",
    };
    const cls = map[status] || map.draft;
    const label = status.replace(/_/g, " ");
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ${cls}`}
        >
            {status === "accepted" && <CheckCircle2 className="h-3 w-3" />}
            {label}
        </span>
    );
}

function SuccessCard({ 
    phase, 
    data, 
    currency 
}: { 
    phase: Phase; 
    data: any; 
    currency: string; 
}) {
    return (
        <div className="mt-2 rounded-xl border border-teal-100 bg-teal-50/30 p-4 space-y-3 animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-2 text-teal-700">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Payment Successful</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Amount Paid</p>
                    <p className="text-sm font-bold text-slate-900">{formatMoney(data.amountPaid / 100, currency)}</p>
                </div>
                <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Paid On</p>
                    <p className="text-sm font-medium text-slate-900">{formatDate(data.paidAt)}</p>
                </div>
                <div className="col-span-2">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Transaction ID</p>
                    <p className="text-[11px] font-mono text-slate-700 break-all">{data.paymentIntentId || "N/A"}</p>
                </div>
            </div>
        </div>
    );
}

function DeliverablesSection({ 
    order, 
    isDeliveryPaid 
}: { 
    order: QuotationPaymentTracker['order'], 
    isDeliveryPaid: boolean 
}) {
    if (!order || !order.assets?.length) return null;

    return (
        <SectionShell
            icon={<Layers className="h-5 w-5" />}
            title="Project deliverables"
            subtitle={isDeliveryPaid ? "Access your project assets below." : "Assets are locked until delivery payment is confirmed."}
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {order.assets.map((asset) => (
                    <div 
                        key={asset._id}
                        className={`group relative overflow-hidden rounded-2xl border p-4 transition-all ${
                            !isDeliveryPaid 
                                ? "bg-slate-50/50 border-slate-200" 
                                : "bg-white border-slate-100 hover:border-teal-200 hover:shadow-md"
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                !isDeliveryPaid ? "bg-slate-200 text-slate-400" : "bg-teal-50 text-teal-600"
                            }`}>
                                <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className={`text-sm font-semibold truncate ${!isDeliveryPaid ? "text-slate-400 blur-[2px]" : "text-slate-900"}`}>
                                    {asset.label}
                                </p>
                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">
                                    {asset.type} Deliverable
                                </p>
                            </div>
                            {!isDeliveryPaid && (
                                <Lock className="h-4 w-4 text-slate-400 shrink-0" />
                            )}
                        </div>
                        {!isDeliveryPaid && (
                            <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-1 rounded-full shadow-sm border border-slate-100">
                                    Locked
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {!isDeliveryPaid && (
                <div className="mt-4 rounded-xl bg-amber-50 border border-amber-100 p-3 flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                        The deliverables above are currently locked. Complete the <strong>Delivery (30%)</strong> milestone to unlock instant access to all files.
                    </p>
                </div>
            )}
        </SectionShell>
    );
}

function CollapsibleCard({
    title,
    summary,
    children,
    defaultOpen = false,
}: {
    title: string;
    summary?: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/60"
            >
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                        {title}
                    </div>
                    {summary ? (
                        <div className="text-xs text-slate-500 truncate">{summary}</div>
                    ) : null}
                </div>
                <ChevronDown
                    className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${
                        open ? "rotate-180" : ""
                    }`}
                />
            </button>
            <div
                className={`grid transition-all duration-300 ${
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
            >
                <div className="overflow-hidden">
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100">{children}</div>
                </div>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main client component
// ──────────────────────────────────────────────────────────────────────────────

export default function QuotationPayClient({ token }: { token: string }) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

    const [quotation, setQuotation] = useState<Quotation | null>(null);
    const [tracker, setTracker] = useState<QuotationPaymentTracker | null>(null);

    const [activeProvider, setActiveProvider] = useState<PaymentProvider>("stripe");
    const [activePhase, setActivePhase] = useState<Phase>("upfront");

    const [isLoading, setIsLoading] = useState(true);
    const [isAccepting, setIsAccepting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedPaidPhase, setExpandedPaidPhase] = useState<Phase | null>(null);

    /**
     * Always pull canonical state from the backend. Two guarantees:
     *   - `quotation.status` (especially `accepted`) is never trusted from a
     *     local optimistic update — every transition is reflected here only after
     *     the server confirms it.
     *   - The tracker is reset (not left stale) when the server says it has none.
     *
     * `silent` skips the full-page loading spinner so background polling /
     * focus-refresh does not flicker the UI.
     */
    const loadAll = useCallback(
        async ({ silent = false }: { silent?: boolean } = {}) => {
            if (!silent) setIsLoading(true);
            setError(null);
            try {
                const qRes = await fetch(`${apiBase}/api/quotations/client/${token}`, {
                    cache: "no-store",
                });
                const qJson = await qRes.json();
                if (!qRes.ok) throw new Error(qJson?.message || "Failed to load quotation");
                setQuotation(qJson?.data ?? null);

                const sRes = await fetch(
                    `${apiBase}/api/quotation-payments/client/${token}/status`,
                    { cache: "no-store" },
                );
                if (sRes.ok) {
                    const sJson = await sRes.json();
                    setTracker(sJson?.data ?? null);
                } else {
                    setTracker(null);
                }
            } catch (e) {
                if (!silent) setError((e as Error).message);
            } finally {
                if (!silent) setIsLoading(false);
            }
        },
        [apiBase, token],
    );

    useEffect(() => {
        void loadAll();
    }, [loadAll]);

    // Keep the UI in lock-step with backend state:
    //  - revalidate when the tab regains focus (covers users who paid in another tab),
    //  - poll every 20s while not yet accepted so newly-emailed acceptance flows
    //    or a staff-side state change are reflected without a manual refresh.
    useEffect(() => {
        const onFocus = () => void loadAll({ silent: true });
        const onVisibility = () => {
            if (document.visibilityState === "visible") void loadAll({ silent: true });
        };
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisibility);

        const status = quotation?.status;
        const allPaid = tracker?.summary?.allPaid;
        const shouldPoll = status !== "accepted" || (status === "accepted" && !allPaid);

        let intervalId: ReturnType<typeof setInterval> | null = null;
        if (shouldPoll) {
            intervalId = setInterval(() => {
                if (document.visibilityState === "visible") {
                    void loadAll({ silent: true });
                }
            }, 20_000);
        }

        return () => {
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisibility);
            if (intervalId) clearInterval(intervalId);
        };
    }, [loadAll, quotation?.status, tracker?.summary?.allPaid]);

    const canPay = quotation?.status === "accepted";

    const currency = tracker?.currency || quotation?.currency || "USD";

    const milestoneText = useMemo(() => {
        if (!tracker) return null;
        const p = tracker.phases[activePhase];
        return `${formatMoney(p.amountDue / 100, currency)} (${p.percentage}%)`;
    }, [tracker, currency, activePhase]);

    useEffect(() => {
        // If user is on a locked phase, fall back to the earliest eligible.
        if (!tracker) return;
        if (!phasePrerequisitesMet(activePhase, tracker)) {
            if (tracker.phases.upfront.status !== "paid") setActivePhase("upfront");
            else if (tracker.phases.delivery.status !== "paid") setActivePhase("delivery");
            else setActivePhase("final");
        }
    }, [tracker, activePhase]);

    const acceptQuotation = async () => {
        // Re-entrancy guard: avoid double-fires if the user clicks twice
        // before React commits the `isAccepting` state change.
        if (isAccepting) return;
        setIsAccepting(true);
        setError(null);
        try {
            const res = await fetch(
                `${apiBase}/api/quotations/client/${token}/accept`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                },
            );
            const json = await res.json();
            if (!res.ok) throw new Error(json?.message || "Failed to accept quotation");

            // Always re-fetch after accept — never trust local optimistic state.
            // The server is the source of truth for both the quotation status
            // transition AND the freshly-initialised payment tracker.
            await loadAll({ silent: true });

            // Bring the user to the payment block once the tracker is initialised.
            requestAnimationFrame(() => {
                document
                    .getElementById("payment-section")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsAccepting(false);
        }
    };

    // ── Loading / error gates ─────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center px-6">
                <div className="flex items-center gap-3 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-medium">Loading your quotation…</span>
                </div>
            </div>
        );
    }

    if (error || !quotation) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center px-6">
                <div className="w-full max-w-xl rounded-2xl border border-red-100 bg-red-50/40 p-6">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-red-600">
                            <AlertCircle className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="font-semibold text-red-900">
                                Unable to open this quotation
                            </div>
                            <div className="text-sm text-red-700/80 mt-1">
                                {error || "The link may be invalid or expired."}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Derived data ─────────────────────────────────────────────────────
    const grandTotal = quotation.totals?.grandTotal ?? 0;
    const subtotal = quotation.totals?.subtotal ?? 0;
    const taxAmount = quotation.totals?.taxAmount ?? 0;
    const additionalTotal =
        quotation.additionalServices?.reduce(
            (s, x) => s + (Number(x.price) || 0),
            0,
        ) ?? 0;
    const summary = tracker ? computeSummary(tracker) : null;

    const techPills = [
        quotation.techStack?.frontend,
        quotation.techStack?.backend,
        quotation.techStack?.database,
        ...(quotation.techStack?.tools || []),
    ].filter(Boolean) as string[];

    return (
        <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50">
            {/* Premium hero */}
            <header className="border-b border-slate-100 bg-white">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6"
                    >
                        <div className="space-y-3 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/5 px-2.5 py-1 text-[11px] font-mono text-slate-700">
                                    {quotation.quotationNumber}
                                </span>
                                <StatusBadge status={quotation.status} />
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 leading-tight">
                                {quotation.details?.title || "Project Quotation"}
                            </h1>
                            <p className="text-sm text-slate-500">
                                Prepared for{" "}
                                <span className="font-medium text-slate-700">
                                    {quotation.client?.contactName ||
                                        quotation.client?.companyName ||
                                        "you"}
                                </span>
                                {quotation.details?.validUntil
                                    ? ` • Valid until ${formatDate(quotation.details.validUntil)}`
                                    : null}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 sm:min-w-[260px]">
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                Project total
                            </p>
                            <p className="mt-1 text-3xl font-bold text-slate-900 tracking-tight">
                                {formatMoney(grandTotal, currency)}
                            </p>
                            {summary ? (
                                <div className="mt-3 pt-3 border-t border-slate-100">
                                    <ProgressBar
                                        progressPercent={summary.progressPercent}
                                        paidCount={summary.paidPhases.length}
                                    />
                                    {summary.remainingAmount > 0 && (
                                        <p className="mt-2 text-xs text-amber-700 font-medium">
                                            {formatMoney(summary.remainingAmount / 100, currency)} remaining
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="mt-3 text-xs text-slate-500">
                                    Accept the quotation to start payments
                                </p>
                            )}
                        </div>
                    </motion.div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                    {/* ─── LEFT: Quotation review ─── */}
                    <div className="lg:col-span-7 space-y-6">
                        {quotation.overview ? (
                            <SectionShell
                                icon={<Sparkles className="h-5 w-5" />}
                                title="Project overview"
                                subtitle="A quick summary of what we'll be building together."
                            >
                                <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                                    {quotation.overview}
                                </p>
                            </SectionShell>
                        ) : null}

                        {techPills.length || (quotation.workflow?.length ?? 0) > 0 ? (
                            <SectionShell
                                icon={<Layers className="h-5 w-5" />}
                                title="Scope of work"
                                subtitle="The technology, tools, and process behind your project."
                            >
                                {techPills.length ? (
                                    <div className="mb-5">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                                            Stack & tools
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {techPills.map((t) => (
                                                <span
                                                    key={t}
                                                    className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                                                >
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                                {quotation.workflow?.length ? (
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                                            Workflow
                                        </p>
                                        <ol className="space-y-2">
                                            {quotation.workflow.map((step, idx) => (
                                                <li key={idx} className="flex items-start gap-3">
                                                    <span className="flex h-5 w-5 mt-0.5 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[10px] font-bold text-teal-700 ring-1 ring-teal-100">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="text-sm text-slate-700">
                                                        {step}
                                                    </span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                ) : null}
                            </SectionShell>
                        ) : null}

                        {quotation.phases?.length ? (
                            <SectionShell
                                icon={<FileText className="h-5 w-5" />}
                                title="Deliverables & phases"
                                subtitle="What you'll receive at every stage of the project."
                            >
                                <div className="space-y-3">
                                    {quotation.phases.map((p, idx) => (
                                        <CollapsibleCard
                                            key={idx}
                                            title={`Phase ${idx + 1}: ${p.title || "Untitled"}`}
                                            summary={
                                                p.startDate || p.endDate
                                                    ? `${formatDate(p.startDate)} → ${formatDate(p.endDate)}`
                                                    : p.description
                                                        ? p.description.slice(0, 80)
                                                        : undefined
                                            }
                                            defaultOpen={idx === 0}
                                        >
                                            {p.description ? (
                                                <p className="text-sm text-slate-700 mb-3">
                                                    {p.description}
                                                </p>
                                            ) : null}
                                            {p.items?.length ? (
                                                <ul className="space-y-1.5">
                                                    {p.items.map((it, i) => (
                                                        <li
                                                            key={i}
                                                            className="flex items-start gap-2 text-sm text-slate-700"
                                                        >
                                                            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-teal-600" />
                                                            <span>{it}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-xs italic text-slate-500">
                                                    No deliverables listed for this phase.
                                                </p>
                                            )}
                                        </CollapsibleCard>
                                    ))}
                                </div>
                            </SectionShell>
                        ) : null}

                        {tracker?.order && (
                            <DeliverablesSection 
                                order={tracker.order} 
                                isDeliveryPaid={tracker.phases.delivery.status === "paid"} 
                            />
                        )}

                        <SectionShell
                            icon={<ReceiptText className="h-5 w-5" />}
                            title="Pricing breakdown"
                            subtitle="Transparent, line-by-line."
                        >
                            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 space-y-2.5">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">Base price</span>
                                    <span className="font-medium text-slate-900">
                                        {formatMoney(quotation.pricing?.basePrice ?? 0, currency)}
                                    </span>
                                </div>
                                {quotation.additionalServices?.length ? (
                                    <>
                                        {quotation.additionalServices.map((s, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center justify-between text-sm"
                                            >
                                                <span className="text-slate-600 truncate pr-3">
                                                    + {s.title}
                                                    {s.billingCycle ? (
                                                        <span className="text-slate-400 text-xs">
                                                            {" "}
                                                            ({s.billingCycle})
                                                        </span>
                                                    ) : null}
                                                </span>
                                                <span className="font-medium text-slate-900">
                                                    {formatMoney(s.price, currency)}
                                                </span>
                                            </div>
                                        ))}
                                    </>
                                ) : null}
                                {(quotation.pricing?.discount ?? 0) > 0 ? (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-600">
                                            Discount ({quotation.pricing?.discount}%)
                                        </span>
                                        <span className="font-medium text-rose-600">
                                            −{" "}
                                            {formatMoney(
                                                ((quotation.pricing?.basePrice ?? 0) +
                                                    additionalTotal) *
                                                    ((quotation.pricing?.discount ?? 0) / 100),
                                                currency,
                                            )}
                                        </span>
                                    </div>
                                ) : null}
                                <div className="my-2 h-px bg-slate-200" />
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">Subtotal</span>
                                    <span className="font-medium text-slate-900">
                                        {formatMoney(subtotal, currency)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">
                                        Tax ({quotation.pricing?.taxRate ?? 0}%)
                                    </span>
                                    <span className="font-medium text-slate-900">
                                        {formatMoney(taxAmount, currency)}
                                    </span>
                                </div>
                                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                                    <span className="text-sm font-semibold text-slate-900">
                                        Grand total
                                    </span>
                                    <span className="text-xl font-bold text-teal-700">
                                        {formatMoney(grandTotal, currency)}
                                    </span>
                                </div>
                            </div>
                        </SectionShell>

                        {quotation.paymentMilestones?.length ? (
                            <SectionShell
                                icon={<Wallet className="h-5 w-5" />}
                                title="Payment milestones"
                                subtitle="When and how the project is billed."
                            >
                                <ol className="space-y-2.5">
                                    {quotation.paymentMilestones.map((m, idx) => {
                                        const amount = (grandTotal * (m.percentage || 0)) / 100;
                                        return (
                                            <li
                                                key={idx}
                                                className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xs font-bold text-teal-700">
                                                        {idx + 1}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-semibold text-slate-900 truncate">
                                                            {m.label}
                                                        </div>
                                                        {m.note ? (
                                                            <div className="text-xs text-slate-500 truncate">
                                                                {m.note}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-bold text-teal-700">
                                                        {m.percentage}%
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {formatMoney(amount, currency)}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </SectionShell>
                        ) : null}
                    </div>

                    {/* ─── RIGHT: Sticky payment column ─── */}
                    <div className="lg:col-span-5">
                        <div className="lg:sticky lg:top-8 space-y-6" id="payment-section">
                            <SectionShell
                                icon={<Wallet className="h-5 w-5" />}
                                title="Payment"
                                subtitle={
                                    canPay
                                        ? "Pay one milestone at a time, securely."
                                        : "Accept the quotation to enable payments."
                                }
                            >
                                {!canPay ? (
                                    <div className="space-y-4">
                                        <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5">
                                            <div className="flex items-start gap-3">
                                                <CheckCircle2 className="h-5 w-5 text-teal-600 mt-0.5 shrink-0" />
                                                <div className="space-y-1">
                                                    <p className="text-sm font-semibold text-teal-900">
                                                        Ready to move forward?
                                                    </p>
                                                    <p className="text-xs text-teal-800/80">
                                                        Accepting unlocks the secure payment flow:
                                                        upfront, delivery, and final milestones.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={acceptQuotation}
                                            disabled={
                                                isAccepting ||
                                                quotation.status === "accepted" ||
                                                quotation.status === "expired" ||
                                                quotation.status === "rejected" ||
                                                quotation.status === "superseded"
                                            }
                                            aria-busy={isAccepting}
                                            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-[0_8px_24px_rgba(15,23,42,0.18)]"
                                        >
                                            {isAccepting ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Accepting…
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    Accept &amp; continue to payment
                                                </>
                                            )}
                                        </button>
                                        <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                                            <Shield className="h-3 w-3" />
                                            Secure 256-bit encryption • Stripe & PayPal
                                        </p>
                                    </div>
                                ) : tracker ? (
                                    <div className="space-y-5">
                                        {summary?.allPaid ? (
                                            <div className="flex flex-col items-center gap-3 py-6 text-center">
                                                <div className="rounded-full bg-teal-50 p-3 ring-1 ring-teal-100">
                                                    <PartyPopper className="h-7 w-7 text-teal-600" />
                                                </div>
                                                <div className="font-semibold text-slate-900">
                                                    All milestones complete!
                                                </div>
                                                <div className="text-sm text-slate-500">
                                                    {formatMoney(tracker.totalAmount / 100, currency)}{" "}
                                                    paid in full.
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {summary && (
                                                    <ProgressBar
                                                        progressPercent={summary.progressPercent}
                                                        paidCount={summary.paidPhases.length}
                                                    />
                                                )}
                                                {summary && summary.remainingAmount > 0 && (
                                                    <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-2.5 flex items-center justify-between">
                                                        <span className="text-xs text-amber-700 font-semibold uppercase tracking-wider">
                                                            Remaining
                                                        </span>
                                                        <span className="text-sm font-bold text-amber-900">
                                                            {formatMoney(
                                                                summary.remainingAmount / 100,
                                                                currency,
                                                            )}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Phase selector */}
                                                <div className="space-y-2.5">
                                                    {(["upfront", "delivery", "final"] as const).map(
                                                        (phase) => {
                                                            const row = tracker.phases[phase];
                                                            const prereqMet = phasePrerequisitesMet(
                                                                phase,
                                                                tracker,
                                                            );
                                                            const isPaid = row.status === "paid";
                                                            const isNext = prereqMet && !isPaid;
                                                            const isActive = activePhase === phase;
                                                            const isExpanded = expandedPaidPhase === phase;
                                                            const disabled = !prereqMet;

                                                            return (
                                                                <div key={phase} className="space-y-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (isPaid) {
                                                                                setExpandedPaidPhase(isExpanded ? null : phase);
                                                                            } else if (!disabled) {
                                                                                setActivePhase(phase);
                                                                            }
                                                                        }}
                                                                        disabled={!isPaid && disabled}
                                                                        className={[
                                                                            "w-full text-left rounded-2xl border p-4 transition-all",
                                                                            isPaid
                                                                                ? "border-teal-200 bg-teal-50/50 cursor-pointer hover:bg-teal-100/40"
                                                                                : isActive
                                                                                    ? "border-teal-500 bg-white ring-2 ring-teal-500/20"
                                                                                    : "border-slate-200 bg-white hover:border-slate-300",
                                                                            !isPaid && disabled
                                                                                ? "opacity-60 cursor-not-allowed"
                                                                                : "",
                                                                        ].join(" ")}
                                                                    >
                                                                        <div className="flex items-center justify-between gap-3">
                                                                            <div className="flex items-center gap-3 min-w-0">
                                                                                <span
                                                                                    className={[
                                                                                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
                                                                                        isPaid
                                                                                            ? "bg-teal-600 text-white"
                                                                                            : isNext
                                                                                                ? "bg-amber-500 text-white"
                                                                                                : "bg-slate-100 text-slate-400",
                                                                                    ].join(" ")}
                                                                                >
                                                                                    {isPaid ? (
                                                                                        <CheckCircle2 className="h-4 w-4" />
                                                                                    ) : !prereqMet ? (
                                                                                        <Lock className="h-3.5 w-3.5" />
                                                                                    ) : (
                                                                                        row.percentage + "%"
                                                                                    )}
                                                                                </span>
                                                                                <div className="min-w-0">
                                                                                    <div className="text-sm font-semibold text-slate-900 truncate">
                                                                                        {phaseLabel(phase)}
                                                                                    </div>
                                                                                    <div className="text-xs text-slate-500 truncate">
                                                                                        {formatMoney(
                                                                                            row.amountDue / 100,
                                                                                            currency,
                                                                                        )}{" "}
                                                                                        • {row.percentage}%
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <span
                                                                                    className={[
                                                                                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1",
                                                                                        isPaid
                                                                                            ? "bg-teal-50 text-teal-700 ring-teal-200"
                                                                                            : isNext
                                                                                                ? "bg-amber-50 text-amber-700 ring-amber-200"
                                                                                                : "bg-slate-50 text-slate-500 ring-slate-200",
                                                                                    ].join(" ")}
                                                                                >
                                                                                    {isPaid ? "Paid" : isNext ? "Due next" : "Locked"}
                                                                                </span>
                                                                                {isPaid && (
                                                                                    <ChevronDown className={`h-3 w-3 text-teal-600 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </button>
                                                                    {isPaid && isExpanded && (
                                                                        <SuccessCard phase={phase} data={row} currency={currency} />
                                                                    )}
                                                                </div>
                                                            );
                                                        },
                                                    )}
                                                </div>

                                                <div className="h-px bg-slate-100" />

                                                {/* Active phase pay area */}
                                                <div>
                                                    <div className="flex items-center justify-between gap-3 mb-3">
                                                        <div>
                                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                                Now paying
                                                            </p>
                                                            <p className="text-base font-semibold text-slate-900">
                                                                {phaseLabel(activePhase)}{" "}
                                                                <span className="text-slate-500 text-sm font-normal">
                                                                    {milestoneText
                                                                        ? `— ${milestoneText}`
                                                                        : ""}
                                                                </span>
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Provider tabs (Tailwind only) */}
                                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveProvider("stripe")}
                                                            className={[
                                                                "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                                                                activeProvider === "stripe"
                                                                    ? "border-teal-500 bg-teal-50/50 text-teal-700 ring-1 ring-teal-500/30"
                                                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                                                            ].join(" ")}
                                                        >
                                                            <CreditCard className="h-4 w-4" />
                                                            Card
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveProvider("paypal")}
                                                            className={[
                                                                "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                                                                activeProvider === "paypal"
                                                                    ? "border-[#003087] bg-[#003087]/5 text-[#003087] ring-1 ring-[#003087]/30"
                                                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                                                            ].join(" ")}
                                                        >
                                                            <Wallet className="h-4 w-4" />
                                                            PayPal
                                                        </button>
                                                    </div>

                                                    <AnimatePresence mode="wait">
                                                        <motion.div
                                                            key={`${activeProvider}-${activePhase}`}
                                                            initial={{ opacity: 0, y: 6 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: 6 }}
                                                            transition={{ duration: 0.2 }}
                                                        >
                                                            {tracker.phases[activePhase].status === "paid" ? (
                                                                <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-5 text-sm text-teal-800">
                                                                    This milestone is already paid. Select another
                                                                    milestone above.
                                                                </div>
                                                            ) : !phasePrerequisitesMet(activePhase, tracker) ? (
                                                                <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500 flex items-start gap-2">
                                                                    <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                                                                    <span>
                                                                        Complete the previous milestone to unlock
                                                                        this payment.
                                                                    </span>
                                                                </div>
                                                            ) : activeProvider === "stripe" ? (
                                                                <StripePhaseCheckout
                                                                    apiBase={apiBase}
                                                                    token={token}
                                                                    phase={activePhase}
                                                                    currency={currency}
                                                                    onPaid={loadAll}
                                                                    stripe={stripePromise}
                                                                />
                                                            ) : (
                                                                <PayPalPhaseCheckout
                                                                    apiBase={apiBase}
                                                                    token={token}
                                                                    phase={activePhase}
                                                                    currency={currency}
                                                                    onPaid={loadAll}
                                                                />
                                                            )}
                                                        </motion.div>
                                                    </AnimatePresence>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
                                        Initialising payment plan…
                                    </div>
                                )}

                                {error && (
                                    <div className="mt-5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl p-4">
                                        {error}
                                    </div>
                                )}
                            </SectionShell>

                            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-500 flex items-start gap-3">
                                <Shield className="h-4 w-4 mt-0.5 shrink-0 text-teal-600" />
                                <p>
                                    Your payment is processed by Stripe or PayPal. We never store
                                    card numbers — only a reference to confirm your milestone is
                                    paid.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
