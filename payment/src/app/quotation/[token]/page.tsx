import React from "react";
import QuotationPayClient from "./quotation-pay-client";

export default async function QuotationPayPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    return <QuotationPayClient token={token} />;
}

