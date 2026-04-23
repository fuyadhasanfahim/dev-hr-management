"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGetQuotationByIdQuery } from "@/redux/features/quotation/quotationApi";
import { useQuotationStore } from "@/store/useQuotationStore";
import QuotationBuilder from "../../components/forms/QuotationBuilder";
import { Loader2 } from "lucide-react";
import { IconReceipt } from "@tabler/icons-react";

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
        clientId: typeof data.clientId === 'object' ? (data.clientId as { _id: string })._id : data.clientId,
        // Format dates for HTML5 date inputs (yyyy-MM-dd)
        details: {
          ...data.details,
          date: data.details?.date ? new Date(data.details.date).toISOString().split('T')[0] : '',
          validUntil: data.details?.validUntil ? new Date(data.details.validUntil).toISOString().split('T')[0] : '',
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
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-red-600">Error loading quotation</h2>
        <button
          onClick={() => router.push("/quotations")}
          className="mt-4 text-teal-600 underline"
        >
          Back to list
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
            <IconReceipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Edit Quotation</h1>
            <p className="text-sm text-slate-500">
              Modifying: {data.details.title} (#{data.details.quotationNumber})
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <QuotationBuilder />
      </div>
    </div>
  );
}
