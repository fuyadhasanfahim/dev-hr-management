"use client";

import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import CheckoutForm from "./CheckoutForm";
import { Loader2 } from "lucide-react";
import { formatMoney } from "@/lib/money";

// Initialize Stripe outside of a component's render to avoid recreating the Stripe object on every render.
const stripePromise = loadStripe(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
);

// Matches web-briks-client's Stripe theme exactly.
const fonts: StripeElementsOptions["fonts"] = [
    {
        cssSrc: "https://fonts.googleapis.com/css2?family=Red+Rose:wght@400;500;600;700&display=swap",
    },
];

const appearance: StripeElementsOptions["appearance"] = {
    theme: "night",
    variables: {
        colorPrimary: "#9C46F4",
        colorBackground: "#050611",
        colorText: "#ffffff",
        colorTextSecondary: "#9CA3AF",
        colorDanger: "#f87171",
        fontFamily: "'Red Rose', sans-serif",
        borderRadius: "12px",
        spacingUnit: "4px",
    },
    rules: {
        ".Input": {
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "none",
        },
        ".Input:focus": {
            border: "1px solid rgba(156, 70, 244, 0.5)",
            boxShadow: "none",
        },
        ".Label": {
            color: "#D1D5DB",
            fontWeight: "600",
            fontSize: "13px",
        },
        ".Tab": {
            border: "1px solid rgba(255, 255, 255, 0.1)",
            backgroundColor: "transparent",
        },
        ".Tab--selected": {
            border: "1px solid #9C46F4",
            backgroundColor: "rgba(156, 70, 244, 0.1)",
        },
    },
};

export default function PaymentWrapper({
    token,
    invoiceNumber,
    amount,
    currency,
}: {
    /** The single-use payment link token — the ONLY thing this call sends besides itself; the server derives the charge amount on its own. */
    token: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
}) {
    const [clientSecret, setClientSecret] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const formattedTotal = formatMoney(amount, currency);

    useEffect(() => {
        let cancelled = false;

        const fetchClientSecret = async () => {
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/api/payments/stripe/create-intent`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ token }),
                    },
                );

                const data = await res.json();
                if (cancelled) return;

                if (res.ok && data?.success) {
                    setClientSecret(data.data.clientSecret);
                } else {
                    setError(
                        data?.message || "Failed to initialize payment session",
                    );
                }
            } catch (err: unknown) {
                console.error("PaymentIntent initialization error:", err);
                if (!cancelled) {
                    setError("Network error connecting to payment gateway.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchClientSecret();
        return () => {
            cancelled = true;
        };
    }, [token]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-[#9C46F4]" />
            </div>
        );
    }

    if (error) {
        return <p className="py-2 text-[13px] text-red-400">{error}</p>;
    }

    return (
        <div className="w-full">
            {clientSecret && (
                <Elements
                    options={{ clientSecret, appearance, fonts }}
                    stripe={stripePromise}
                >
                    <CheckoutForm
                        amount={formattedTotal}
                        invoiceNumber={invoiceNumber}
                        token={token}
                    />
                </Elements>
            )}
        </div>
    );
}
