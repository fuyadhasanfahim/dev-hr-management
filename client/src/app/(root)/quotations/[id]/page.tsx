"use client";

import React, { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  useGetQuotationByIdQuery, 
  useSendQuotationMutation,
  useCreateNewVersionMutation,
  useDeleteQuotationMutation,
  useGetGroupVersionsQuery
} from "@/redux/features/quotation/quotationApi";
import { QuotationEmailDialog } from "../components/QuotationEmailDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Loader2, ArrowLeft, FileText, 
  Send, Edit2, Copy, History, AlertCircle, ExternalLink,
  Trash2,
  CheckCircle2,
  Clock,
  RefreshCcw,
  Layers,
  Cpu,
  Activity,
  ReceiptText,
} from "lucide-react";
import Link from "next/link";
import PDFDownloadBtn from "@/components/quotation/pdf/PDFDownloadBtn";
import QuotationPuppeteerPdfBtn from "@/components/quotation/pdf/QuotationPuppeteerPdfBtn";
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

  const [pickerOpen, setPickerOpen] = useState(false);

  const dialogClientId = useMemo(() => {
    if (!data?.clientId) return "";
    if (typeof data.clientId === "string") return data.clientId;
    const populated = data.clientId as unknown as { _id?: string };
    return populated?._id ?? "";
  }, [data?.clientId]);

  const openSendPicker = () => {
    if (!dialogClientId) {
      toast.error(
        "This quotation has no linked client — cannot pick recipient emails.",
      );
      return;
    }
    setPickerOpen(true);
  };

  const handleConfirmSend = async (selected: string[]) => {
    if (!id) return [];
    if (selected.length === 0) {
      toast.warning("Please select at least one recipient");
      return [];
    }
    if (isSending) return [];
    try {
      const result = await sendQuotation({ id: id as string, emails: selected }).unwrap();
      if (result.data.clientLink) {
        try {
          await navigator.clipboard.writeText(result.data.clientLink);
          toast.success("Client link copied to clipboard!");
        } catch {
          // Non-fatal: clipboard not always permitted.
        }
      }

      const recipients = result.data.recipients ?? [];
      const failed = recipients.filter((r) => r.status === "failed");
      const sent = recipients.filter((r) => r.status === "sent");

      if (sent.length > 0 && failed.length === 0) {
        toast.success(`Quotation sent to ${sent.length} recipient${sent.length === 1 ? "" : "s"}`);
      } else if (sent.length > 0 && failed.length > 0) {
        toast.warning(
          `Sent to ${sent.length}, failed for ${failed.length}. See dialog for details.`,
        );
      } else if (failed.length > 0) {
        toast.error(
          result.data.emailError ||
            `Failed to send to ${failed.length} recipient${failed.length === 1 ? "" : "s"}`,
        );
      } else {
        toast.warning(
          result.data.emailError ||
            "Email was not sent. Link was generated only.",
        );
      }
      return recipients;
    } catch (err) {
      toast.error((err as Error).message || "Failed to send quotation");
      return [];
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
    viewed: "bg-indigo-50 text-indigo-700 border-indigo-200",
    accepted: "bg-teal-50 text-teal-700 border-teal-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    superseded: "bg-amber-50 text-amber-700 border-amber-200",
    expired: "bg-orange-50 text-orange-700 border-orange-200",
    change_requested: "bg-purple-50 text-purple-700 border-purple-200",
  };

  const currency = data.currency || "৳";
  const totals = data.totals ?? { subtotal: 0, taxAmount: 0, grandTotal: 0 };
  const grandTotal = totals.grandTotal ?? 0;
  const subtotal = totals.subtotal ?? 0;
  const taxAmount = totals.taxAmount ?? 0;
  const additionalTotal =
    data.additionalServices?.reduce((sum, s) => sum + (s.price || 0), 0) ?? 0;

  const money = (amount: number | undefined | null) =>
    `${currency}${(amount ?? 0).toLocaleString()}`;

  return (
    <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-300">
      {/* Header (Orders-like) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/quotations")}
            className="rounded-full shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                {data.details.title}
              </h1>
              <Badge
                variant="outline"
                className={`${statusColors[data.status || "draft"]} capitalize`}
              >
                {data.status?.replace("_", " ")}
              </Badge>
              {!data.isLatestVersion && (
                <Badge variant="destructive">Outdated</Badge>
              )}
            </div>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <span className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">
                #{data.quotationNumber || "—"}
              </span>
              <span className="text-xs">•</span>
              <span className="text-sm">Version {data.version}</span>
              <span className="text-xs">•</span>
              <span className="text-sm">
                Created{" "}
                {data.createdAt ? format(new Date(data.createdAt), "PPP") : "N/A"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <QuotationPuppeteerPdfBtn
            quotationId={id as string}
            fileNameBase={
              data.quotationNumber || data.details.title || "Quotation"
            }
          />
          <PDFDownloadBtn data={data} />

          {data.isLatestVersion &&
            (data.status === "draft" || data.status === "change_requested") && (
              <Button onClick={openSendPicker} disabled={isSending}>
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send to Client
              </Button>
            )}

          {data.status === "accepted" && (
            <Button asChild variant="outline">
              <Link href={`/orders/${data.orderId}`}>
                <CheckCircle2 className="h-4 w-4" />
                View Order
              </Link>
            </Button>
          )}

          {data.isLatestVersion && (
            <Button variant="outline" asChild>
              <Link href={`/quotations/${id}/edit`}>
                <Edit2 className="h-4 w-4" />
                Edit
              </Link>
            </Button>
          )}

          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete quotation"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-8">
            {/* Version Warning */}
            {!data.isLatestVersion && (
              <Card className="border-amber-200 bg-amber-50/40">
                <CardContent className="p-4 flex items-start gap-3">
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
                </CardContent>
              </Card>
            )}

            {/* Change Request Info */}
            {data.status === "change_requested" && (
              <Card className="border-purple-200 bg-purple-50/40">
                <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <RefreshCcw className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-purple-900">Client Requested Changes</h4>
                    <p className="text-xs text-purple-700">
                      The client has requested modifications. Review their feedback and issue a new version.
                    </p>
                    {data.changeRequestReason && (
                      <p className="mt-2 text-xs text-purple-800/80">
                        <span className="font-bold">Reason:</span>{" "}
                        {data.changeRequestReason}
                      </p>
                    )}
                  </div>
                </div>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleNewVersion} disabled={isVersionCreating}>
                  {isVersionCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                  Create New Version to Edit
                </Button>
                </CardContent>
              </Card>
            )}

            {/* Overview */}
            <Card>
              <CardHeader className="border-b bg-muted/10">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Project Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Client
                    </div>
                    <div className="font-bold">{data.client.contactName}</div>
                    {data.client.companyName && (
                      <div className="text-xs text-muted-foreground">
                        {data.client.companyName}
                      </div>
                    )}
                    {(data.client.email || data.client.phone) && (
                      <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                        {data.client.email && <div>{data.client.email}</div>}
                        {data.client.phone && <div>{data.client.phone}</div>}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Proposal
                    </div>
                    <div className="font-bold capitalize">
                      {data.serviceType.replace("-", " ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Issued{" "}
                      {data.details?.date
                        ? format(new Date(data.details.date), "PPP")
                        : "—"}
                      {" • "}
                      Valid until{" "}
                      {data.details?.validUntil
                        ? format(new Date(data.details.validUntil), "PPP")
                        : "—"}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Summary
                  </div>
                  <div className="text-sm leading-relaxed text-foreground/90 bg-muted/20 p-4 rounded-lg border border-dashed">
                    {data.overview?.trim()
                      ? data.overview
                      : "No overview provided for this quotation."}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Phases */}
            <Card>
              <CardHeader className="border-b bg-muted/10">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Phases & Milestones
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {data.phases?.length ? (
                  <div className="space-y-4">
                    {data.phases.map((p, idx) => (
                      <div
                        key={`${p.title}-${idx}`}
                        className="rounded-xl border bg-card p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="font-bold">
                              Phase {idx + 1}: {p.title}
                            </div>
                            {p.description && (
                              <div className="text-sm text-muted-foreground">
                                {p.description}
                              </div>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-[10px] font-bold">
                            {p.items?.length ?? 0} items
                          </Badge>
                        </div>
                        {p.items?.length ? (
                          <ul className="mt-3 space-y-1 text-sm text-foreground/90 list-disc pl-5">
                            {p.items.map((it, i) => (
                              <li key={`${idx}-${i}`}>{it}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mt-3 text-sm text-muted-foreground italic">
                            No items listed for this phase.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">
                    No phases defined.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tech stack + Workflow */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="border-b bg-muted/10">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    Technology Stack
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {data.techStack?.frontend && (
                      <Badge variant="secondary">{data.techStack.frontend}</Badge>
                    )}
                    {data.techStack?.backend && (
                      <Badge variant="secondary">{data.techStack.backend}</Badge>
                    )}
                    {data.techStack?.database && (
                      <Badge variant="secondary">{data.techStack.database}</Badge>
                    )}
                    {(data.techStack?.tools || []).map((t) => (
                      <Badge key={t} variant="outline" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  {!data.techStack?.frontend &&
                    !data.techStack?.backend &&
                    !data.techStack?.database &&
                    !(data.techStack?.tools || []).length && (
                      <div className="text-sm text-muted-foreground italic">
                        No tech stack specified.
                      </div>
                    )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b bg-muted/10">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Workflow
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-2">
                  {data.workflow?.length ? (
                    <ol className="space-y-2">
                      {data.workflow.map((step, idx) => (
                        <li key={idx} className="flex gap-3">
                          <div className="mt-0.5 h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </div>
                          <div className="text-sm text-foreground/90">
                            {step}
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">
                      No workflow steps defined.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Additional services */}
            <Card>
              <CardHeader className="border-b bg-muted/10">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-primary" />
                  Additional Services
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {data.additionalServices?.length ? (
                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead>Billing</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.additionalServices.map((s, idx) => (
                          <TableRow key={`${s.title}-${idx}`}>
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{s.title}</span>
                                {s.description && (
                                  <span className="text-xs text-muted-foreground">
                                    {s.description}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize text-[10px]">
                                {s.billingCycle}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {money(s.price)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={2} className="text-right font-semibold">
                            Total
                          </TableCell>
                          <TableCell className="text-right font-black">
                            {money(additionalTotal)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">
                    No additional services added.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Value Card */}
            <Card className="overflow-hidden">
              <CardHeader className="bg-muted/20 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <IconReceipt className="w-4 h-4" />
                  Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 text-center">
                  <span className="text-muted-foreground text-sm font-medium">
                    Grand Total
                  </span>
                  <h2 className="text-4xl font-black text-primary mt-1">
                    {currency}
                    {grandTotal.toLocaleString()}
                  </h2>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Base price</span>
                    <span className="font-semibold">{money(data.pricing?.basePrice)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Add-ons</span>
                    <span className="font-semibold">{money(additionalTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Discount ({data.pricing?.discount ?? 0}%)
                    </span>
                    <span className="font-semibold">
                      − {money(((data.pricing?.basePrice ?? 0) + additionalTotal) * ((data.pricing?.discount ?? 0) / 100))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold">{money(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Tax ({data.pricing?.taxRate ?? 0}%)
                    </span>
                    <span className="font-semibold">{money(taxAmount)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Token / validity */}
            <Card className="overflow-hidden">
              <CardHeader className="bg-muted/20 border-b py-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Validity & Link
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Issued</span>
                  <span className="font-semibold">
                    {data.details?.date
                      ? format(new Date(data.details.date), "MMM dd, yyyy")
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Valid until</span>
                  <span className="font-semibold">
                    {data.details?.validUntil
                      ? format(new Date(data.details.validUntil), "MMM dd, yyyy")
                      : "—"}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Token</span>
                  <span className="font-mono text-[11px]">
                    {data.secureToken ? "Generated" : "Not generated"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Token expiry</span>
                  <span className="font-semibold">
                    {data.tokenExpiresAt
                      ? format(new Date(data.tokenExpiresAt), "MMM dd, yyyy")
                      : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Version History */}
            <Card className="overflow-hidden">
              <CardHeader className="bg-muted/20 border-b py-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Version History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y">
                {versions?.map((v) => (
                  <Link 
                    key={v._id} 
                    href={`/quotations/${v._id}`}
                    className={`flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors ${v._id === data._id ? 'bg-muted/30 pointer-events-none' : ''}`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">Version {v.version}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {v.createdAt &&
                          format(new Date(v.createdAt), "MMM dd, yyyy")}
                      </span>
                    </div>
                    <Badge variant="outline" className={`${statusColors[v.status || "draft"]} text-[9px] h-5`}>
                      {v.status}
                    </Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* Client Portal Status */}
            <Card className="overflow-hidden">
              <CardHeader className="bg-muted/20 border-b py-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Client Access
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {data.status === "draft" ? (
                  <div className="text-center space-y-3">
                    <div className="p-3 bg-muted rounded-full inline-block">
                      <Clock className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Link hasn&apos;t been shared with the client yet.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-[11px]"
                      onClick={openSendPicker}
                    >
                      Generate & Share Link
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                      <div>
                        <h5 className="text-xs font-bold text-emerald-900">
                          Link Active
                        </h5>
                        <p className="text-[10px] text-emerald-700">
                          Client can now view and accept this quotation.
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-2 text-[11px]"
                      onClick={openSendPicker}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy Link Again
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

      <QuotationEmailDialog
        open={pickerOpen}
        clientId={dialogClientId}
        quotationLabel={`${data.quotationNumber ?? "QTN"} • ${data.details?.title ?? ""}`.trim()}
        extraEmails={data.client?.email ? [data.client.email] : []}
        onClose={() => !isSending && setPickerOpen(false)}
        onSend={handleConfirmSend}
        isSending={isSending}
      />
      </div>
  );
}
