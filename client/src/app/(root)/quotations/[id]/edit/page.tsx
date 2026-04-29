"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGetQuotationByIdQuery } from "@/redux/features/quotation/quotationApi";
import { useQuotationStore } from "@/store/useQuotationStore";
import QuotationBuilder from "../../components/forms/QuotationBuilder";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, ReceiptText } from "lucide-react";

export default function EditQuotationPage() {
  const { id } = useParams();
  const { data, isLoading, isError } = useGetQuotationByIdQuery(id as string);
  const { setData } = useQuotationStore();
  const router = useRouter();

  useEffect(() => {
    if (data) {
      // Hydrate the store with sanitized data
      const sanitizedData = {
        ...data,
        // Extract ID from populated client object
        clientId:
          typeof data.clientId === "object"
            ? (data.clientId as { _id: string })?._id
            : data.clientId,
        // Format dates for HTML5 date inputs (yyyy-MM-dd)
        details: {
          ...data.details,
          date: data.details?.date
            ? new Date(data.details.date).toISOString().split("T")[0]
            : "",
          validUntil: data.details?.validUntil
            ? new Date(data.details.validUntil).toISOString().split("T")[0]
            : "",
        },
      };
      setData(sanitizedData);
    }
  }, [data, setData]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container mx-auto p-6 text-center mt-20">
        <div className="flex flex-col items-center justify-center space-y-4">
          <h2 className="text-2xl font-bold">Error loading quotation</h2>
          <p className="text-muted-foreground max-w-md">
            We couldn&apos;t load this quotation. It may have been deleted or the
            link is incorrect.
          </p>
          <Button variant="outline" onClick={() => router.push("/quotations")}>
            Back to Quotations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-300">
      {/* Header (Orders-like) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(`/quotations/${id}`)}
            className="rounded-full shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-3xl font-bold tracking-tight">
                Edit Quotation
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {data?.details?.title || "Untitled"} • #
              {data?.quotationNumber || "—"}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <QuotationBuilder hideHeader />
        </CardContent>
      </Card>
    </div>
  );
}
