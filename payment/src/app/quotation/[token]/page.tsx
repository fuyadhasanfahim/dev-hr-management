import React from "react";
import QuotationPayClient from "./quotation-pay-client";

export default function QuotationPayPage({
    params,
}: {
    params: { token: string };
}) {
    return <QuotationPayClient token={params.token} />;
}

