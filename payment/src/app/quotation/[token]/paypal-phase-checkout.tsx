"use client";

import React, { useMemo, useState } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type Phase = "upfront" | "delivery" | "final";

export default function PayPalPhaseCheckout({
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
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const router = useRouter();

    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "test";

    const initialOptions = useMemo(
        () => ({
            clientId,
            currency: (currency || "USD").toUpperCase(),
            intent: "capture",
            components: "buttons",
            "disable-funding": "paylater",
        }),
        [clientId, currency],
    );

    return (
        <div className="space-y-4">
            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-muted-foreground">
                You’ll be redirected to PayPal to complete this milestone payment securely.
            </div>

            <div className="min-h-[52px]">
                <PayPalScriptProvider options={initialOptions}>
                    <PayPalButtons
                        style={{ layout: "vertical", shape: "rect", color: "gold" }}
                        createOrder={async () => {
                            setIsProcessing(true);
                            setError(null);
                            try {
                                const res = await fetch(
                                    `${apiBase}/api/quotation-payments/client/${token}/intent`,
                                    {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                            phase,
                                            provider: "paypal",
                                        }),
                                    },
                                );
                                const json = await res.json();
                                if (!res.ok) {
                                    if (res.status === 409) {
                                        router.push("/success?already_paid=true");
                                        return "";
                                    }
                                    throw new Error(json?.message || "Failed to create PayPal order");
                                }
                                return String(json?.data?.id);
                            } catch (e) {
                                setIsProcessing(false);
                                setError((e as Error).message);
                                throw e;
                            }
                        }}
                        onApprove={async (_data, actions) => {
                            setError(null);
                            try {
                                if (!actions.order) throw new Error("PayPal order missing");
                                const details = await actions.order.capture();
                                await onPaid();
                                router.push(
                                    `/success?from=quotation&method=paypal&id=${encodeURIComponent(String(details?.id || ""))}`,
                                );
                            } catch (e) {
                                setError(
                                    (e as Error).message ||
                                        "There was an issue capturing the PayPal payment.",
                                );
                            } finally {
                                setIsProcessing(false);
                            }
                        }}
                        onCancel={() => {
                            setIsProcessing(false);
                            setError("Payment was cancelled. You have not been charged.");
                        }}
                        onError={(err) => {
                            setIsProcessing(false);
                            setError("PayPal encountered an error. Please try again.");
                            void err;
                        }}
                    />
                </PayPalScriptProvider>
            </div>

            {isProcessing && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing…
                </div>
            )}
        </div>
    );
}

