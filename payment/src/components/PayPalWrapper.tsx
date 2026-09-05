"use client";

import React from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { useRouter } from "next/navigation";
import { usePaymentStore } from "../store/paymentStore";
import { resolveDisplayGatewayCurrency } from "@/lib/money";

interface PayPalWrapperProps {
    /** The single-use payment link token — every call below is scoped to this. */
    token: string;
    amount: number;
    currency: string;
    invoiceNumber: string;
}

/**
 * Both `createOrder` and `onApprove` below call OUR backend
 * (`/api/payments/paypal/create-order` and `/api/payments/paypal/capture-order`)
 * instead of the PayPal SDK's own `actions.order.create`/`actions.order.capture`.
 * That's deliberate: the SDK's client-side create/capture would let the
 * browser dictate the charged amount and would never touch our Receipt
 * ledger at all. Routing both through our server means the amount always
 * comes from `payment.service.ts`'s live-recomputed amount due, and the
 * capture is the same server-to-server PayPal API call our webhook-equivalent
 * relies on for Stripe.
 */
export default function PayPalWrapper({
    token,
    currency,
    invoiceNumber,
}: PayPalWrapperProps) {
    const { error, setError, setProcessing } = usePaymentStore();
    const router = useRouter();

    const initialOptions = {
        clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "",
        // PayPal doesn't take BDT either — this must match what
        // create-order actually charges (see resolveGatewayCharge
        // server-side); the SDK needs a currency upfront, before we can ask
        // the server, so the same BDT->USD decision is mirrored here.
        currency: resolveDisplayGatewayCurrency(currency),
        intent: "capture",
        components: "buttons",
        "disable-funding": "paylater",
    };

    return (
        <div className="w-full">
            {error && (
                <p className="mb-4 text-center text-[12.5px] text-red-400">
                    {error}
                </p>
            )}

            <PayPalScriptProvider options={initialOptions}>
                <PayPalButtons
                    fundingSource="paypal"
                    style={{ layout: "vertical", shape: "rect", color: "gold" }}
                    createOrder={async () => {
                        setProcessing(true);
                        setError(null);
                        const res = await fetch(
                            `${process.env.NEXT_PUBLIC_API_URL}/api/payments/paypal/create-order`,
                            {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ token }),
                            },
                        );
                        const data = await res.json();
                        if (!res.ok || !data?.success) {
                            setProcessing(false);
                            setError(
                                data?.message ||
                                    "Could not start the PayPal payment.",
                            );
                            throw new Error(data?.message || "create-order failed");
                        }
                        return data.data.orderId as string;
                    }}
                    onApprove={async (data) => {
                        try {
                            const res = await fetch(
                                `${process.env.NEXT_PUBLIC_API_URL}/api/payments/paypal/capture-order`,
                                {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        token,
                                        paypalOrderId: data.orderID,
                                    }),
                                },
                            );
                            const body = await res.json();
                            if (!res.ok || !body?.success) {
                                setError(
                                    body?.message ||
                                        "There was an issue completing your PayPal payment.",
                                );
                                setProcessing(false);
                                return;
                            }

                            router.push(
                                `/success?method=paypal&id=${data.orderID}&invoice=${invoiceNumber}`,
                            );
                        } catch (err) {
                            setError(
                                "There was an issue capturing your PayPal payment.",
                            );
                            console.error("PayPal capture error:", err);
                            setProcessing(false);
                        }
                    }}
                    onError={(err) => {
                        setError(
                            "PayPal encountered an error. Please try again or use a card.",
                        );
                        console.error("PayPal Script Error:", err);
                        setProcessing(false);
                    }}
                    onCancel={() => {
                        setProcessing(false);
                        setError(
                            "Payment was cancelled. You have not been charged.",
                        );
                    }}
                />
            </PayPalScriptProvider>
        </div>
    );
}
