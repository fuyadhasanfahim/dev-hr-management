"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  IconReceipt,
  IconPlus,
  IconDownload,
  IconFileText,
  IconClock,
  IconCheck,
  IconSearch,
  IconFilter,
} from "@tabler/icons-react";
import {
  useGetQuotationsQuery,
  useDeleteQuotationMutation,
  useSendQuotationMutation,
} from "@/redux/features/quotation/quotationApi";
import { QuotationTable } from "./components/QuotationTable";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useQuotationStore } from "@/store/useQuotationStore";
import { QuotationData } from "@/types/quotation.type";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";

export default function QuotationsPage() {
  const router = useRouter();
  const [page] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const { data: qData, isLoading } = useGetQuotationsQuery({
    page,
    status: status === "all" ? undefined : status || undefined,
    search: search || undefined,
  });

  const [deleteQuotation] = useDeleteQuotationMutation();
  const [sendQuotation, { isLoading: isSending }] = useSendQuotationMutation();
  const [sendingId, setSendingId] = useState<string | null>(null);

  const handleSend = async (id: string) => {
    try {
      setSendingId(id);
      const result = await sendQuotation(id).unwrap();
      
      // Copy to clipboard
      if (result.data.clientLink) {
        await navigator.clipboard.writeText(result.data.clientLink);
        toast.success("Secure payment link copied to clipboard!");
      }
      
      toast.success("Quotation marked as sent");
    } catch (err) {
      toast.error((err as Error).message || "Failed to send quotation");
    } finally {
      setSendingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure? This will also delete any associated order and payment logs.")) {
      try {
        await deleteQuotation(id).unwrap();
        toast.success("Quotation and associated records deleted");
      } catch (err) {
        toast.error((err as Error).message || "Failed to delete quotation");
      }
    }
  };

  const handleEdit = (quotation: QuotationData) => {
    router.push(`/quotations/${quotation._id}/edit`);
  };

  const stats = [
    {
      label: "Total",
      value: qData?.total || 0,
      icon: <IconFileText size={20} />,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Latest Drafts",
      value: qData?.items.filter((i) => i.status === "draft" && i.isLatestVersion).length || 0,
      icon: <IconClock size={20} />,
      color: "bg-amber-50 text-amber-600",
    },
    {
      label: "Active Links",
      value: qData?.items.filter((i) => i.status === "sent" && i.isLatestVersion).length || 0,
      icon: <IconCheck size={20} />,
      color: "bg-green-50 text-green-600",
    },
    {
      label: "Project Value",
      value: `৳${(qData?.items.filter(i => i.isLatestVersion).reduce((acc, i) => acc + i.totals.grandTotal, 0) || 0).toLocaleString()}`,
      icon: <IconReceipt size={20} />,
      color: "bg-teal-50 text-teal-600",
    },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/30">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quotation Pipeline</h1>
          <p className="text-sm text-slate-500">
            Secure, version-controlled quotation-to-order workflow
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/quotations/new"
            onClick={() => useQuotationStore.getState().reset()}
          >
            <Button className="bg-teal-600 hover:bg-teal-700 gap-2 shadow-lg shadow-teal-600/10">
              <IconPlus size={18} />
              New Quotation
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-8 pb-4 shrink-0">
        {stats.map((stat, idx) => (
          <Card
            key={idx}
            className="p-6 border-slate-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}
              >
                {stat.icon}
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900">
              {stat.value}
            </div>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="px-8 py-4 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <IconSearch
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            placeholder="Search by ID, title, or client..."
            className="pl-10 bg-white border-slate-200 focus:border-teal-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={status || "all"} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px] border-slate-200 text-slate-600 bg-white">
              <div className="flex items-center gap-2">
                <IconFilter size={18} />
                <SelectValue placeholder="All Status" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="superseded">Superseded</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 pt-0 overflow-auto">
        <Card className="border-slate-200 shadow-sm overflow-hidden bg-white rounded-2xl">
          <QuotationTable
            quotations={qData?.items || []}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSend={handleSend}
            sendingId={sendingId}
          />
        </Card>
      </div>
    </div>
  );
}
