"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Elements,
    PaymentElement,
    useElements,
    useStripe,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Stripe } from "@stripe/stripe-js";

type Phase = "upfront" | "delivery" | "final";

export default function StripePhaseCheckout({
    apiBase,
    token,
    phase,
    currency,
    onPaid,
    stripe,
}: {
    apiBase: string;
    token: string;
    phase: Phase;
    currency: string;
    onPaid: () => Promise<void> | void;
    stripe: Promise<Stripe | null>;
}) {
    const router = useRouter();

    const [clientSecret, setClientSecret] = useState<string>("");
    const [initialPaymentIntentId, setInitialPaymentIntentId] = useState<string>("");
    const [amountCents, setAmountCents] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const initKeyRef = useRef<string | null>(null);

    const returnUrl = useMemo(() => {
        if (typeof window === "undefined") return "";
        const u = new URL(`${window.location.origin}/success`);
        u.searchParams.set("from", "quotation");
        u.searchParams.set("method", "stripe");
        u.searchParams.set("token", token);
        u.searchParams.set("phase", phase);
        return u.toString();
    }, [phase, token]);

    useEffect(() => {
        const initKey = `${apiBase}|${token}|${phase}`;
        // React 18 Strict Mode (dev) runs effects twice to surface unsafe side effects.
        // This endpoint is a "create intent" POST, so we make the call idempotent client-side.
        if (initKeyRef.current === initKey) return;
        initKeyRef.current = initKey;

        let cancelled = false;
        setIsLoading(true);
        setError(null);

        const run = async () => {
            try {
                const res = await fetch(
                    `${apiBase}/api/quotation-payments/client/${token}/intent`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ phase, provider: "stripe" }),
                    },
                );
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                    const msg = String(json?.message || "Failed to initialize Stripe payment");
                    // If already paid, route to success with the correct message.
                    if (res.status === 409) {
                        // Best-effort: fetch tracker so we can display the reference/payment id.
                        let paidRef: string | null = null;
                        try {
                            const sRes = await fetch(
                                `${apiBase}/api/quotation-payments/client/${token}/status`,
                                { cache: "no-store" },
                            );
                            if (sRes.ok) {
                                const sJson = await sRes.json().catch(() => ({}));
                                const row = sJson?.data?.phases?.[phase];
                                const lastPaid =
                                    Array.isArray(row?.paidIntentIds) && row.paidIntentIds.length
                                        ? row.paidIntentIds[row.paidIntentIds.length - 1]
                                        : null;
                                paidRef = String(row?.paymentIntentId || lastPaid || "") || null;
                            }
                        } catch {
                            // ignore
                        }

                        const u = new URL("/success", window.location.origin);
                        u.searchParams.set("already_paid", "true");
                        u.searchParams.set("from", "quotation");
                        u.searchParams.set("method", "stripe");
                        u.searchParams.set("token", token);
                        u.searchParams.set("phase", phase);
                        if (paidRef) u.searchParams.set("payment_intent", paidRef);
                        router.push(u.pathname + "?" + u.searchParams.toString());
                        return;
                    }
                    throw new Error(msg);
                }
                const secret = json?.data?.clientSecret;
                if (!secret) throw new Error("Missing Stripe client secret");
                const pi = json?.data?.paymentIntentId;
                const cents = json?.data?.amountCents;
                if (!cancelled) setClientSecret(String(secret));
                if (!cancelled && pi) setInitialPaymentIntentId(String(pi));
                if (!cancelled && Number.isFinite(Number(cents))) {
                    setAmountCents(Number(cents));
                }
            } catch (e) {
                if (!cancelled) setError((e as Error).message);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        void run();
        return () => {
            cancelled = true;
            // Strict Mode remounts after cleanup; without this, `initKeyRef` blocks the real
            // mount’s fetch while the aborted run leaves `isLoading` true forever.
            initKeyRef.current = null;
        };
    }, [apiBase, token, phase, router]);

    const appearance = useMemo(
        () => ({
            theme: "stripe" as const,
            variables: {
                colorPrimary: "#0d9488",
                fontFamily:
                    'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
                borderRadius: "14px",
            },
        }),
        [],
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
                <span className="flex items-center gap-2 text-sm font-medium">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Securing Stripe session…
                </span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
            </div>
        );
    }

    if (!clientSecret) {
        return (
            <div className="rounded-2xl border border-gray-200 p-4 text-sm text-muted-foreground">
                Payment session unavailable.
            </div>
        );
    }

    return (
        <Elements stripe={stripe} options={{ clientSecret, appearance }}>
            <StripePaymentForm
                returnUrl={returnUrl}
                currency={currency}
                token={token}
                phase={phase}
                initialPaymentIntentId={initialPaymentIntentId}
                amountCents={amountCents}
                onPaid={onPaid}
            />
        </Elements>
    );
}

function StripePaymentForm({
    returnUrl,
    currency,
    token,
    phase,
    initialPaymentIntentId,
    amountCents,
    onPaid,
}: {
    returnUrl: string;
    currency: string;
    token: string;
    phase: Phase;
    initialPaymentIntentId: string;
    amountCents: number | null;
    onPaid: () => Promise<void> | void;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const router = useRouter();

    const [isPaying, setIsPaying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePay = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!stripe || !elements) return;

        setIsPaying(true);
        try {
            const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: { return_url: returnUrl },
                redirect: "if_required",
            });

            if (stripeError) {
                throw new Error(stripeError.message || "Stripe confirmation failed");
            }

            await onPaid();
            const intentId = paymentIntent?.id || initialPaymentIntentId;
            const u = new URL("/success", window.location.origin);
            u.searchParams.set("from", "quotation");
            u.searchParams.set("method", "stripe");
            u.searchParams.set("token", token);
            u.searchParams.set("phase", phase);
            if (intentId) u.searchParams.set("payment_intent", intentId);
            u.searchParams.set("redirect_status", "succeeded");
            if (amountCents != null) u.searchParams.set("amount", String(amountCents));
            if (currency) u.searchParams.set("currency", currency);
            router.push(u.pathname + "?" + u.searchParams.toString());
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsPaying(false);
        }
    };

    return (
        <form onSubmit={handlePay} className="space-y-5">
            <PaymentElement
                options={{
                    layout: "tabs",
                    fields: { billingDetails: "auto" },
                }}
            />
            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </div>
            )}
            <Button
                type="submit"
                disabled={!stripe || !elements || isPaying}
                className="w-full h-12 rounded-2xl bg-teal-600 hover:bg-teal-700"
            >
                {isPaying ? (
                    <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing…
                    </span>
                ) : (
                    <span className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Pay securely
                    </span>
                )}
            </Button>
            <div className="text-xs text-muted-foreground text-center">
                Currency: {currency}
            </div>
        </form>
    );
}

