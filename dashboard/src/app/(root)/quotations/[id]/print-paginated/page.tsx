"use client";

import { Loader2, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PaginatedQuotationPrint } from "@/components/quotation/pdf/PaginatedQuotationPrint";
import { useGetQuotationByIdQuery } from "@/redux/features/quotation/quotationApi";

export default function QuotationPrintPaginatedPage() {
  const { id } = useParams();
  const { data, isLoading, isError } = useGetQuotationByIdQuery(id as string);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center text-sm text-muted-foreground">
        Quotation not found or failed to load.
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/quotations/${id}`}>← Back</Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print / Save PDF
        </Button>
      </div>
      <PaginatedQuotationPrint data={data} />
      <style
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  .no-print { display: none !important; }
}
`,
        }}
      />
    </div>
  );
}
