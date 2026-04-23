"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useGetQuotationByIdQuery } from "@/redux/features/quotation/quotationApi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowLeft, FileText, User, Briefcase } from "lucide-react";
import Link from "next/link";
import PDFDownloadBtn from "@/components/quotation/pdf/PDFDownloadBtn";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { IconReceipt } from "@tabler/icons-react";

export default function ViewQuotationPage() {
  const { id } = useParams();
  const { data, isLoading } = useGetQuotationByIdQuery(id as string);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold">Quotation not found</h2>
        <Button asChild className="mt-4">
          <Link href="/quotations">Back to List</Link>
        </Button>
      </div>
    );
  }

  const statusColors = {
    draft: "bg-slate-100 text-slate-700 border-slate-200",
    sent: "bg-blue-50 text-blue-700 border-blue-200",
    accepted: "bg-teal-50 text-teal-700 border-teal-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/30">
      <div className="px-8 py-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="text-slate-400"
          >
            <Link href="/quotations">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">
                {data.details.title}
              </h1>
              <Badge
                variant="outline"
                className={`${statusColors[data.status || "draft"]} capitalize`}
              >
                {data.status}
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              #{data.details.quotationNumber} • Created on{" "}
              {data.createdAt ? format(new Date(data.createdAt), "MMM dd, yyyy") : "N/A"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PDFDownloadBtn data={data} totalAmounts={data.totals} />
          <Button variant="outline" asChild>
            <Link href={`/quotations/${id}/edit`}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Quotation
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <User className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Client
                </span>
              </div>
              <div className="font-bold text-slate-900">
                {data.client.contactName}
              </div>
              <div className="text-xs text-slate-500">
                {data.client.companyName}
              </div>
            </Card>
            <Card className="p-6 border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Briefcase className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Service
                </span>
              </div>
              <div className="font-bold text-slate-900">
                {data.serviceType === "web-development"
                  ? "Web Design & Dev"
                  : "Product Photography"}
              </div>
              <div className="text-xs text-slate-500">
                {data.deliveryTimeline}
              </div>
            </Card>
            <Card className="p-6 border-teal-50 shadow-sm flex flex-col gap-2 bg-teal-50/10">
              <div className="flex items-center gap-2 text-teal-600/50 mb-2">
                <IconReceipt className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Total Value
                </span>
              </div>
              <div className="text-2xl font-black text-teal-600">
                {data.settings.currency}
                {data.totals.grandTotal.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">
                Tax included: {data.settings.currency}
                {data.totals.taxAmount.toLocaleString()}
              </div>
            </Card>
          </div>

          {/* PDF Preview Notice */}
          <Card className="p-12 border-dashed border-2 border-slate-200 bg-white flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Quotation View
            </h3>
            <p className="text-slate-500 max-w-sm mb-6 text-sm">
              You can download the full professional PDF document using the
              button above to see the complete layout, terms, and branding.
            </p>
            <PDFDownloadBtn data={data} totalAmounts={data.totals} />
          </Card>
        </div>
      </div>
    </div>
  );
}

// Inline helper for Edit icon
function Edit2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
