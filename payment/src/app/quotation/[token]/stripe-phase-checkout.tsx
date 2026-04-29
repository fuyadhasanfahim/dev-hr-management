"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";

type Phase = "upfront" | "delivery" | "final";

export default function StripePhaseCheckout({
    apiBase,
    token,
    phase,
    currency,
    onPaid,
}: {
    apiBase: string;
    token: string;
    phase: Phase;
    currency: string;
    onPaid: () => Promise<void> | void;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const router = useRouter();

    const [clientSecret, setClientSecret] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPaying, setIsPaying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const returnUrl = useMemo(() => {
        if (typeof window === "undefined") return "";
        const u = new URL(`${window.location.origin}/success`);
        u.searchParams.set("from", "quotation");
        u.searchParams.set("phase", phase);
        return u.toString();
    }, [phase]);

    useEffect(() => {
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
                const json = await res.json();
                if (!res.ok) {
                    const msg = String(json?.message || "Failed to initialize Stripe payment");
                    // If already paid, route to success with the correct message.
                    if (res.status === 409) {
                        router.push("/success?already_paid=true");
                        return;
                    }
                    throw new Error(msg);
                }
                const secret = json?.data?.clientSecret;
                if (!secret) throw new Error("Missing Stripe client secret");
                if (!cancelled) setClientSecret(String(secret));
            } catch (e) {
                if (!cancelled) setError((e as Error).message);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        void run();
        return () => {
            cancelled = true;
        };
    }, [apiBase, token, phase]);

    const handlePay = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!stripe || !elements) return;

        setIsPaying(true);
        try {
            const { error: stripeError } = await stripe.confirmPayment({
                elements,
                clientSecret,
                confirmParams: { return_url: returnUrl },
            });

            if (stripeError) {
                throw new Error(stripeError.message || "Stripe confirmation failed");
            }

            await onPaid();
            router.push("/success?from=quotation");
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsPaying(false);
        }
    };

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

