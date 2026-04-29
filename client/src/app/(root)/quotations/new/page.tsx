"use client";

import { useEffect } from "react";
import { useQuotationStore } from "@/store/useQuotationStore";
import QuotationBuilder from "../components/forms/QuotationBuilder";
import { useRouter } from "next/navigation";
import { ArrowLeft, ReceiptText } from "lucide-react";

export default function NewQuotationPage() {
  const { reset } = useQuotationStore();
  const router = useRouter();

  useEffect(() => {
    reset();
  }, [reset]);

  return (
    <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-300">
      {/* Header (Orders-like) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/quotations")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-muted/40"
            type="button"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-3xl font-bold tracking-tight">
                Create Quotation
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Design a professional proposal for your client.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <QuotationBuilder hideHeader />
      </div>
    </div>
  );
}
