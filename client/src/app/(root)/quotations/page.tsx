"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  CheckCircle,
  Clock,
  FileText,
  Filter,
  Plus,
  ReceiptText,
  Search,
  X,
} from "lucide-react";

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
  const [sendQuotation] = useSendQuotationMutation();
  const [sendingId, setSendingId] = useState<string | null>(null);

  const handleSend = async (id: string) => {
    try {
      setSendingId(id);
      const result = await sendQuotation(id).unwrap();
      
      // Copy to clipboard
      if (result.data.clientLink) {
        await navigator.clipboard.writeText(result.data.clientLink);
        toast.success("Client link copied to clipboard!");
      }
      
      if (result.data.emailSent) {
        toast.success(`Quotation email sent${result.data.emailedTo?.length ? ` to ${result.data.emailedTo.join(", ")}` : ""}`);
      } else {
        toast.warning(result.data.emailError || "Email was not sent. Link was generated only.");
      }
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
      icon: <FileText className="h-5 w-5" />,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Latest Drafts",
      value: qData?.items.filter((i) => i.status === "draft" && i.isLatestVersion).length || 0,
      icon: <Clock className="h-5 w-5" />,
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "Active Links",
      value: qData?.items.filter((i) => i.status === "sent" && i.isLatestVersion).length || 0,
      icon: <CheckCircle className="h-5 w-5" />,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Project Value",
      value: `৳${(qData?.items.filter(i => i.isLatestVersion).reduce((acc, i) => acc + i.totals.grandTotal, 0) || 0).toLocaleString()}`,
      icon: <ReceiptText className="h-5 w-5" />,
      color: "text-teal-600 bg-teal-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="rounded-2xl border bg-card p-5 transition-all duration-300 hover:shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}
              >
                {stat.icon}
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
            <div className="text-2xl font-black tracking-tight">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Main card (Orders-like) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Quotation Pipeline</CardTitle>
            <CardDescription>
              Secure, version-controlled quotation-to-order workflow
            </CardDescription>
          </div>
          <div className="flex gap-3">
            <Button asChild>
              <Link
                href="/quotations/new"
                onClick={() => useQuotationStore.getState().reset()}
              >
                <Plus className="h-4 w-4" />
                New Quotation
              </Link>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters (Orders-like) */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
            </div>

            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, title, or client..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>

              <Select value={status || "all"} onValueChange={setStatus}>
                <SelectTrigger className="bg-background w-[160px]">
                  <SelectValue placeholder="All Status" />
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

              <Button
                variant="outline"
                size="icon"
                className="bg-background"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                }}
                title="Clear filters"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border overflow-hidden bg-card">
            <QuotationTable
              quotations={qData?.items || []}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onSend={handleSend}
              sendingId={sendingId}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
