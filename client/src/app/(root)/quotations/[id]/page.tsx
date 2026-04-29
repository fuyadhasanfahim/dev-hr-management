"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  useGetQuotationByIdQuery, 
  useSendQuotationMutation,
  useCreateNewVersionMutation,
  useDeleteQuotationMutation,
  useGetGroupVersionsQuery
} from "@/redux/features/quotation/quotationApi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Loader2, ArrowLeft, FileText, User, Briefcase, 
  Send, Edit2, Copy, History, AlertCircle, ExternalLink,
  Trash2, CheckCircle2, Clock
} from "lucide-react";
import Link from "next/link";
import PDFDownloadBtn from "@/components/quotation/pdf/PDFDownloadBtn";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { IconReceipt } from "@tabler/icons-react";
import { toast } from "sonner";

export default function ViewQuotationPage() {
  const router = useRouter();
  const { id } = useParams();
  const { data, isLoading } = useGetQuotationByIdQuery(id as string);
  const { data: versions } = useGetGroupVersionsQuery(data?.quotationGroupId || "", {
    skip: !data?.quotationGroupId
  });

  const [sendQuotation, { isLoading: isSending }] = useSendQuotationMutation();
  const [createNewVersion, { isLoading: isVersionCreating }] = useCreateNewVersionMutation();
  const [deleteQuotation, { isLoading: isDeleting }] = useDeleteQuotationMutation();

  const handleSend = async () => {
    try {
      const result = await sendQuotation(id as string).unwrap();
      if (result.data.clientLink) {
        await navigator.clipboard.writeText(result.data.clientLink);
        toast.success("Client link copied to clipboard!");
      }
      toast.success("Quotation status updated to 'sent'");
    } catch (err) {
      toast.error((err as Error).message || "Failed to send quotation");
    }
  };

  const handleNewVersion = async () => {
    if (!data?.quotationGroupId) return;
    try {
      const result = await createNewVersion({ 
        groupId: data.quotationGroupId, 
        data: {} // Empty body copies existing data
      }).unwrap();
      toast.success("New version created successfully");
      router.push(`/quotations/${result.data._id}`);
    } catch (err) {
      toast.error((err as Error).message || "Failed to create new version");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this quotation and all associated records?")) return;
    try {
      await deleteQuotation(id as string).unwrap();
      toast.success("Quotation deleted");
      router.push("/quotations");
    } catch (err) {
      toast.error((err as Error).message || "Failed to delete");
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
    superseded: "bg-amber-50 text-amber-700 border-amber-200",
    expired: "bg-orange-50 text-orange-700 border-orange-200",
    change_requested: "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/30">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="text-slate-400">
            <Link href="/quotations">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">
                {data.details.title}
              </h1>
              <Badge variant="outline" className={`${statusColors[data.status || "draft"]} capitalize`}>
                {data.status?.replace('_', ' ')}
              </Badge>
              {!data.isLatestVersion && (
                <Badge variant="destructive" className="bg-red-500">Outdated Version</Badge>
              )}
            </div>
            <p className="text-sm text-slate-500">
              #{data.details.quotationNumber} • Version {data.version} • Created on{" "}
              {data.createdAt ? format(new Date(data.createdAt), "MMM dd, yyyy") : "N/A"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Actions */}
          <PDFDownloadBtn data={data} totalAmounts={data.totals} />
          
          {data.isLatestVersion && (data.status === "draft" || data.status === "change_requested") && (
            <Button
              className="bg-blue-600 hover:bg-blue-700 gap-2 shadow-lg shadow-blue-600/10"
              onClick={handleSend}
              disabled={isSending}
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send to Client
            </Button>
          )}

          {data.status === "accepted" && (
            <Button asChild variant="outline" className="text-teal-600 border-teal-200">
              <Link href={`/orders/${data.orderId}`}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                View Associated Order
              </Link>
            </Button>
          )}

          {data.isLatestVersion && (
            <Button variant="outline" asChild>
              <Link href={`/quotations/${id}/edit`}>
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Link>
            </Button>
          )}

          <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-8">
            {/* Version Warning */}
            {!data.isLatestVersion && (
              <Card className="p-4 bg-amber-50 border-amber-200 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-amber-900">This is an old version</h4>
                  <p className="text-xs text-amber-700">
                    A newer version of this quotation exists. Any payment links for this version are inactive.
                  </p>
                  <Button variant="link" className="p-0 h-auto text-xs text-amber-900 font-bold mt-1" onClick={() => router.push(`/quotations/group/${data.quotationGroupId}/latest`)}>
                    Switch to latest version →
                  </Button>
                </div>
              </Card>
            )}

            {/* Change Request Info */}
            {data.status === "change_requested" && (
              <Card className="p-4 bg-purple-50 border-purple-200 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <RefreshCcw className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-purple-900">Client Requested Changes</h4>
                    <p className="text-xs text-purple-700">
                      The client has requested modifications. Review their feedback and issue a new version.
                    </p>
                  </div>
                </div>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleNewVersion} disabled={isVersionCreating}>
                  {isVersionCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  Create New Version to Edit
                </Button>
              </Card>
            )}

            {/* Content Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6 border-slate-200 shadow-sm flex flex-col gap-2">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <User className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Client</span>
                </div>
                <div className="font-bold text-slate-900">{data.client.contactName}</div>
                <div className="text-xs text-slate-500">{data.client.companyName}</div>
              </Card>
              <Card className="p-6 border-slate-200 shadow-sm flex flex-col gap-2">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Briefcase className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Service</span>
                </div>
                <div className="font-bold text-slate-900">{data.serviceType.replace('-', ' ')}</div>
                <div className="text-xs text-slate-500">{data.deliveryTimeline}</div>
              </Card>
            </div>

            {/* Document Preview Placeholder */}
            <Card className="p-12 border-dashed border-2 border-slate-200 bg-white flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Quotation View</h3>
              <p className="text-slate-500 max-w-sm mb-6 text-sm">
                The full PDF contains all project details, scope of work, and terms.
              </p>
              <PDFDownloadBtn data={data} totalAmounts={data.totals} />
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Value Card */}
            <Card className="p-6 border-teal-100 bg-teal-50/20 shadow-sm">
              <div className="flex items-center gap-2 text-teal-600/50 mb-2">
                <IconReceipt className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Quotation Value</span>
              </div>
              <div className="text-3xl font-black text-teal-600">
                {data.settings.currency}{data.totals.grandTotal.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Net: {data.settings.currency}{data.totals.packagePrice.toLocaleString()} • Tax: {data.settings.currency}{data.totals.taxAmount.toLocaleString()}
              </div>
            </Card>

            {/* Version History */}
            <Card className="border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2 font-bold text-sm">
                <History className="w-4 h-4" />
                Version History
              </div>
              <div className="divide-y divide-slate-100">
                {versions?.map((v) => (
                  <Link 
                    key={v._id} 
                    href={`/quotations/${v._id}`}
                    className={`flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors ${v._id === data._id ? 'bg-blue-50/50 pointer-events-none' : ''}`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">Version {v.version}</span>
                      <span className="text-[10px] text-slate-500">{v.createdAt && format(new Date(v.createdAt), "MMM dd, yyyy")}</span>
                    </div>
                    <Badge variant="outline" className={`${statusColors[v.status || "draft"]} text-[9px] h-5`}>
                      {v.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            </Card>

            {/* Client Portal Status */}
            <Card className="p-6 border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 mb-4">
                <ExternalLink className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Client Access</span>
              </div>
              {data.status === "draft" ? (
                <div className="text-center space-y-3">
                  <div className="p-3 bg-slate-50 rounded-full inline-block">
                    <Clock className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-500">Link hasn't been shared with the client yet.</p>
                  <Button size="sm" variant="outline" className="w-full text-[11px]" onClick={handleSend}>Generate & Share Link</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-green-50 rounded-lg border border-green-100 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-bold text-green-900">Link Active</h5>
                      <p className="text-[10px] text-green-700">Client can now view and accept this quotation.</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full gap-2 text-[11px]" onClick={handleSend}>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Link Again
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
