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
                                        // Best-effort: fetch tracker so we can display the reference/payment id.
                                        let paidRef: string | null = null;
                                        let paidAmount: string | null = null;
                                        let paidCurrency: string | null = null;
                                        try {
                                            const sRes = await fetch(
                                                `${apiBase}/api/quotation-payments/client/${token}/status`,
                                                { cache: "no-store" },
                                            );
                                            if (sRes.ok) {
                                                const sJson = await sRes.json().catch(() => ({}));
                                                const row = sJson?.data?.phases?.[phase];
                                                const cur = sJson?.data?.currency;
                                                const lastPaid =
                                                    Array.isArray(row?.paidIntentIds) && row.paidIntentIds.length
                                                        ? row.paidIntentIds[row.paidIntentIds.length - 1]
                                                        : null;
                                                paidRef = String(row?.paymentIntentId || lastPaid || "") || null;
                                                const cents = row?.amountPaid ?? row?.amountDue;
                                                if (Number.isFinite(Number(cents))) {
                                                    paidAmount = String(Number(cents));
                                                }
                                                if (cur) paidCurrency = String(cur);
                                            }
                                        } catch {
                                            // ignore
                                        }

                                        const u = new URL("/success", window.location.origin);
                                        u.searchParams.set("already_paid", "true");
                                        u.searchParams.set("from", "quotation");
                                        u.searchParams.set("method", "paypal");
                                        u.searchParams.set("token", token);
                                        u.searchParams.set("phase", phase);
                                        if (paidRef) u.searchParams.set("id", paidRef);
                                        if (paidAmount) u.searchParams.set("amount", paidAmount);
                                        if (paidCurrency) u.searchParams.set("currency", paidCurrency);
                                        router.push(u.pathname + "?" + u.searchParams.toString());
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
                        onApprove={async (data, _actions) => {
                            setError(null);
                            try {
                                if (!data.orderID) throw new Error("PayPal order ID missing");
                                
                                // Server-side capture to resolve "Buyer access token not present" (403)
                                const captureRes = await fetch(
                                    `${apiBase}/api/quotation-payments/client/${token}/capture`,
                                    {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ orderId: data.orderID }),
                                    },
                                );
                                const captureJson = await captureRes.json();
                                if (!captureRes.ok) {
                                    throw new Error(captureJson?.message || "Failed to capture PayPal payment server-side");
                                }

                                const details = captureJson.data;
                                await onPaid();
                                
                                const cap = details?.purchase_units?.[0]?.payments?.captures?.[0];
                                const capValue = Number(cap?.amount?.value);
                                const capCurrency = String(cap?.amount?.currency_code || currency || "").toUpperCase();
                                const amountCents =
                                    Number.isFinite(capValue) && capValue > 0
                                        ? Math.round(capValue * 100)
                                        : undefined;
                                router.push(
                                    `/success?from=quotation&method=paypal&token=${encodeURIComponent(
                                        token,
                                    )}&phase=${encodeURIComponent(
                                        phase,
                                    )}&id=${encodeURIComponent(String(details?.id || ""))}${
                                        amountCents ? `&amount=${encodeURIComponent(String(amountCents))}` : ""
                                    }${
                                        capCurrency ? `&currency=${encodeURIComponent(capCurrency)}` : ""
                                    }`,
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

