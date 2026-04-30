"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    CheckCircle2,
    CreditCard,
    FileText,
    Loader2,
    Lock,
    PartyPopper,
    Wallet,
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import StripePhaseCheckout from "./stripe-phase-checkout";
import PayPalPhaseCheckout from "./paypal-phase-checkout";
import { useRouter } from "next/navigation";

type PaymentProvider = "stripe" | "paypal";
type Phase = "upfront" | "delivery" | "final";

type Quotation = {
    _id: string;
    quotationGroupId: string;
    quotationNumber: string;
    status: string;
    currency?: string;
    totals?: { grandTotal?: number };
    details?: { title?: string };
    client?: { contactName?: string; companyName?: string };
    company?: { name?: string };
};

type QuotationPaymentTracker = {
    quotationGroupId: string;
    currency: string;
    totalAmount: number;
    phases: Record<
        Phase,
        {
            status: "pending" | "processing" | "partial" | "paid" | "failed";
            percentage: number;
            amountDue: number;
            amountPaid: number;
            paidAt?: string;
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
};

const stripePromise = loadStripe(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
);

function formatMoney(amount: number, currency: string) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
    }).format(amount);
}

function phaseLabel(phase: Phase) {
    if (phase === "upfront") return "Upfront";
    if (phase === "delivery") return "Delivery";
    return "Final";
}

function statusBadgeVariant(status: string) {
    if (status === "paid") return "default";
    if (status === "processing") return "secondary";
    if (status === "failed") return "destructive";
    return "outline";
}

function phasePrerequisitesMet(phase: Phase, tracker: QuotationPaymentTracker | null) {
    if (!tracker) return false;
    if (phase === "upfront") return true;
    if (phase === "delivery") return tracker.phases.upfront.status === "paid";
    return tracker.phases.delivery.status === "paid";
}

/** Derive summary locally — used when the API hasn't returned one yet. */
function computeSummary(tracker: QuotationPaymentTracker) {
    if (tracker.summary) return tracker.summary;
    const phases: Phase[] = ["upfront", "delivery", "final"];
    const paidPhases = phases.filter((p) => tracker.phases[p].status === "paid");
    const totalPaid = phases.reduce((s, p) => s + tracker.phases[p].amountPaid, 0);
    const remainingAmount = tracker.totalAmount - totalPaid;
    const nextPayablePhase: Phase | null =
        tracker.phases.upfront.status !== "paid"   ? "upfront"
        : tracker.phases.delivery.status !== "paid" ? "delivery"
        : tracker.phases.final.status !== "paid"    ? "final"
        : null;
    const progressPercent =
        tracker.totalAmount > 0 ? Math.round((totalPaid / tracker.totalAmount) * 100) : 0;
    return { paidPhases, totalPaid, remainingAmount, nextPayablePhase, progressPercent, allPaid: paidPhases.length === 3 };
}

function PaymentProgressBar({ progressPercent, paidCount }: { progressPercent: number; paidCount: number }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{paidCount} of 3 phases paid</span>
                <span>{progressPercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                    className="h-full rounded-full bg-teal-500 transition-all duration-700"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>
        </div>
    );
}

export default function QuotationPayClient({ token }: { token: string }) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

    const [quotation, setQuotation] = useState<Quotation | null>(null);
    const [tracker, setTracker] = useState<QuotationPaymentTracker | null>(null);

    const [activeProvider, setActiveProvider] =
        useState<PaymentProvider>("stripe");
    const [activePhase, setActivePhase] = useState<Phase>("upfront");

    const [isLoading, setIsLoading] = useState(true);
    const [isAccepting, setIsAccepting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadAll = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const qRes = await fetch(`${apiBase}/api/quotations/client/${token}`, {
                cache: "no-store",
            });
            const qJson = await qRes.json();
            if (!qRes.ok) throw new Error(qJson?.message || "Failed to load quotation");
            setQuotation(qJson?.data);

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
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [apiBase, token]);

    useEffect(() => {
        void loadAll();
    }, [loadAll]);

    const canPay = quotation?.status === "accepted";

    const currency = tracker?.currency || quotation?.currency || "USD";

    const milestoneText = useMemo(() => {
        if (!tracker) return null;
        const p = tracker.phases[activePhase];
        return `${formatMoney(p.amountDue / 100, currency)} (${p.percentage}%)`;
    }, [tracker, currency, activePhase]);

    useEffect(() => {
        // If user is on a locked phase, auto-fallback to the earliest eligible.
        if (!tracker) return;
        if (!phasePrerequisitesMet(activePhase, tracker)) {
            if (tracker.phases.upfront.status !== "paid") setActivePhase("upfront");
            else if (tracker.phases.delivery.status !== "paid") setActivePhase("delivery");
            else setActivePhase("final");
        }
    }, [tracker, activePhase]);

    const acceptQuotation = async () => {
        setIsAccepting(true);
        setError(null);
        try {
            const res = await fetch(`${apiBase}/api/quotations/client/${token}/accept`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.message || "Failed to accept quotation");
            await loadAll();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsAccepting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center px-6">
                <div className="flex items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-medium">Loading quotation…</span>
                </div>
            </div>
        );
    }

    if (error || !quotation) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center px-6">
                <Card className="w-full max-w-xl p-6">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-red-600">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="font-semibold">Unable to open this quotation</div>
                            <div className="text-sm text-muted-foreground mt-1">
                                {error || "The link may be invalid or expired."}
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
                <div className="flex flex-col gap-6">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
                    >
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="rounded-full">
                                    {quotation.quotationNumber}
                                </Badge>
                                <Badge
                                    variant={quotation.status === "accepted" ? "default" : "outline"}
                                    className="rounded-full"
                                >
                                    {quotation.status}
                                </Badge>
                            </div>
                            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
                                {quotation.details?.title || "Quotation"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {quotation.company?.name ? `${quotation.company.name} • ` : ""}
                                {quotation.client?.contactName || quotation.client?.companyName || "Client"}
                            </div>
                        </div>

                        {!canPay && (
                            <Button
                                onClick={acceptQuotation}
                                disabled={isAccepting}
                                className="h-11 rounded-xl bg-gray-900 hover:bg-gray-800"
                            >
                                {isAccepting ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Accepting…
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Accept & continue to payment
                                    </span>
                                )}
                            </Button>
                        )}
                    </motion.div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <Card className="lg:col-span-5 p-6 rounded-3xl border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground">
                                        Payment plan
                                    </div>
                                    <div className="text-xl font-semibold mt-1">
                                        Payment milestones
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Lock className="h-3 w-3" />
                                    Secure
                                </div>
                            </div>

                            <Separator className="my-5" />

                            {tracker ? (() => {
                                const summary = computeSummary(tracker);

                                if (summary.allPaid) {
                                    return (
                                        <div className="flex flex-col items-center gap-3 py-6 text-center">
                                            <div className="rounded-full bg-teal-50 p-3">
                                                <PartyPopper className="h-6 w-6 text-teal-600" />
                                            </div>
                                            <div className="font-semibold text-gray-900">All phases complete!</div>
                                            <div className="text-sm text-muted-foreground">
                                                {formatMoney(tracker.totalAmount / 100, currency)} paid in full.
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="space-y-4">
                                        <PaymentProgressBar
                                            progressPercent={summary.progressPercent}
                                            paidCount={summary.paidPhases.length}
                                        />

                                        {summary.remainingAmount > 0 && (
                                            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-2.5 flex items-center justify-between">
                                                <span className="text-xs text-amber-700 font-medium">Remaining</span>
                                                <span className="text-sm font-semibold text-amber-800">
                                                    {formatMoney(summary.remainingAmount / 100, currency)}
                                                </span>
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            {(["upfront", "delivery", "final"] as const).map((phase) => {
                                                const row = tracker.phases[phase];
                                                const prereqMet = phasePrerequisitesMet(phase, tracker);
                                                const isPaid = row.status === "paid";
                                                const isNext = prereqMet && !isPaid;
                                                const disabled = !canPay || !prereqMet || isPaid;

                                                return (
                                                    <button
                                                        key={phase}
                                                        type="button"
                                                        onClick={() => setActivePhase(phase)}
                                                        disabled={disabled}
                                                        className={[
                                                            "w-full text-left rounded-2xl border p-4 transition",
                                                            isPaid
                                                                ? "border-teal-200 bg-teal-50/50 cursor-default"
                                                                : activePhase === phase
                                                                    ? "border-teal-600 bg-teal-50/40"
                                                                    : "border-gray-900/15 bg-gray-900/5",
                                                            !isPaid && disabled ? "opacity-50 cursor-not-allowed" : "",
                                                            !disabled && !isPaid ? "hover:border-teal-600/60" : "",
                                                        ].join(" ")}
                                                    >
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="space-y-0.5">
                                                                <div className="flex items-center gap-2">
                                                                    {isPaid ? (
                                                                        <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                                                                    ) : !prereqMet ? (
                                                                        <Lock className="h-4 w-4 text-gray-400 shrink-0" />
                                                                    ) : null}
                                                                    <span className="font-semibold text-gray-900">
                                                                        {phaseLabel(phase)}
                                                                    </span>
                                                                    <Badge
                                                                        variant={statusBadgeVariant(row.status)}
                                                                        className="rounded-full text-[11px]"
                                                                    >
                                                                        {isPaid ? "paid" : isNext ? "due next" : "locked"}
                                                                    </Badge>
                                                                </div>
                                                                <div className="text-sm text-muted-foreground pl-6">
                                                                    {formatMoney(row.amountDue / 100, currency)} • {row.percentage}%
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })() : (
                                <div className="text-sm text-muted-foreground">
                                    Accept the quotation to enable payments.
                                </div>
                            )}
                        </Card>

                        <Card className="lg:col-span-7 p-6 sm:p-8 rounded-3xl border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground">
                                        Payment method
                                    </div>
                                    <div className="text-xl font-semibold mt-1">
                                        Pay {milestoneText || "securely"}
                                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                                            ({phaseLabel(activePhase)})
                                        </span>
                                    </div>
                                </div>
                                {tracker && (() => {
                                    const s = computeSummary(tracker);
                                    if (s.allPaid) return null;
                                    return (
                                        <div className="text-right shrink-0">
                                            <div className="text-xs text-muted-foreground">Remaining</div>
                                            <div className="text-sm font-semibold text-amber-700">
                                                {formatMoney(s.remainingAmount / 100, currency)}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            <Separator className="my-5" />

                            <Tabs
                                value={activeProvider}
                                onValueChange={(v) => setActiveProvider(v as PaymentProvider)}
                                className="w-full"
                            >
                                <TabsList className="grid grid-cols-2 w-full bg-transparent p-0 gap-3">
                                    <TabsTrigger
                                        value="stripe"
                                        className="rounded-2xl border border-gray-200 data-[state=active]:border-teal-600 data-[state=active]:bg-teal-50/30 data-[state=active]:ring-1 data-[state=active]:ring-teal-600/30 py-3"
                                    >
                                        <span className="flex items-center gap-2">
                                            <CreditCard className="h-4 w-4" />
                                            Card
                                        </span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="paypal"
                                        className="rounded-2xl border border-gray-200 data-[state=active]:border-[#003087] data-[state=active]:bg-[#003087]/5 data-[state=active]:ring-1 data-[state=active]:ring-[#003087]/25 py-3"
                                    >
                                        <span className="flex items-center gap-2">
                                            <Wallet className="h-4 w-4" />
                                            PayPal
                                        </span>
                                    </TabsTrigger>
                                </TabsList>

                                <div className="mt-6">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={activeProvider}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 6 }}
                                            transition={{ duration: 0.25 }}
                                        >
                                            {activeProvider === "stripe" ? (
                                                canPay && tracker ? (
                                                    tracker.phases[activePhase].status === "paid" ? (
                                                        <div className="rounded-2xl border border-gray-200 p-6 text-sm text-muted-foreground">
                                                            This phase is already paid. Select another milestone.
                                                        </div>
                                                    ) : (
                                                    <StripePhaseCheckout
                                                        apiBase={apiBase}
                                                        token={token}
                                                        phase={activePhase}
                                                        currency={currency}
                                                        onPaid={loadAll}
                                                        stripe={stripePromise}
                                                    />
                                                    )
                                                ) : (
                                                    <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-muted-foreground">
                                                        Accept the quotation to enable payment.
                                                    </div>
                                                )
                                            ) : canPay && tracker ? (
                                                tracker.phases[activePhase].status === "paid" ? (
                                                    <div className="rounded-2xl border border-gray-200 p-6 text-sm text-muted-foreground">
                                                        This phase is already paid. Select another milestone.
                                                    </div>
                                                ) : (
                                                <PayPalPhaseCheckout
                                                    apiBase={apiBase}
                                                    token={token}
                                                    phase={activePhase}
                                                    currency={currency}
                                                    onPaid={loadAll}
                                                />
                                                )
                                            ) : (
                                                <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-muted-foreground">
                                                    Accept the quotation to enable payment.
                                                </div>
                                            )}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </Tabs>

                            {error && (
                                <div className="mt-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl p-4">
                                    {error}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

