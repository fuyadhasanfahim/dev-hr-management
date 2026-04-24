"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useGetQuotationByIdQuery, useConvertToOrderMutation, useUpdateQuotationMutation } from "@/redux/features/quotation/quotationApi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowLeft, FileText, User, Briefcase, RefreshCcw, Edit2, Check, X } from "lucide-react";
import Link from "next/link";
import PDFDownloadBtn from "@/components/quotation/pdf/PDFDownloadBtn";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { IconReceipt } from "@tabler/icons-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ViewQuotationPage() {
  const router = useRouter();
  const { id } = useParams();
  const { data, isLoading } = useGetQuotationByIdQuery(id as string);
  const [convertToOrder, { isLoading: isConverting }] = useConvertToOrderMutation();
  const [updateQuotation, { isLoading: isUpdating }] = useUpdateQuotationMutation();

  const handleStatusChange = async (status: "draft" | "sent" | "accepted" | "rejected") => {
    try {
      await updateQuotation({ id: id as string, status }).unwrap();
      toast.success(`Quotation ${status}`);
    } catch (err) {
      toast.error((err as Error).message || "Failed to update status");
    }
  };

  const handleConvert = async () => {
    try {
      const result = await convertToOrder(id as string).unwrap();
      toast.success("Quotation converted to order successfully");
      router.push(`/orders/${result.data._id}`);
    } catch (err) {
      toast.error((err as Error).message || "Failed to convert quotation to order");
    }
  };

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
      <div className="border-b border-slate-200 bg-white flex items-center justify-between shrink-0 pb-3">
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
          
          {data.status === "draft" && (
            <Button
              variant="outline"
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={() => handleStatusChange("sent")}
              disabled={isUpdating}
            >
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
              Mark as Sent
            </Button>
          )}

          {data.status === "sent" && (
            <>
              <Button
                variant="outline"
                className="text-teal-600 border-teal-200 hover:bg-teal-50"
                onClick={() => handleStatusChange("accepted")}
                disabled={isUpdating}
              >
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                Accept
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => handleStatusChange("rejected")}
                disabled={isUpdating}
              >
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <X className="w-4 h-4 mr-2" />}
                Reject
              </Button>
            </>
          )}

          {data.status === "accepted" && (
            <Button 
              className="bg-blue-600 hover:bg-blue-700 gap-2 shadow-lg shadow-blue-600/10"
              onClick={handleConvert}
              disabled={!!data.orderId || isConverting}
            >
              {isConverting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCcw className="w-4 h-4" />
              )}
              {data.orderId ? "Converted" : "Convert to Order"}
            </Button>
          )}
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

