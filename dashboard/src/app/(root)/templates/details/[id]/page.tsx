"use client";

import { useParams, useRouter } from "next/navigation";
import { useGetQuotationTemplateByIdQuery } from "@/redux/features/quotation/quotationApi";
import {
  getCategoryConfig,
  isPhasesEnabled,
  isUnitBased,
  lineItemAmount,
  BILLING_CYCLE_LABELS,
} from "@/constants/quotation-templates";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  ArrowLeft,
  Pencil,
  FileText,
  Layers,
  Cpu,
  HandCoins,
  Activity,
  Receipt,
  Loader2,
  Package,
} from "lucide-react";
import Link from "next/link";

export default function TemplateDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: template, isLoading } = useGetQuotationTemplateByIdQuery(id, {
    skip: !id,
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading template details...
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-muted-foreground">
        <p>Template not found or has been removed.</p>
        <Button onClick={() => router.push("/templates")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Templates
        </Button>
      </div>
    );
  }

  // ── Pricing (UNCHANGED logic — presentation only) ──────────────────────────
  const basePrice = template.pricing?.basePrice || 0;
  const servicesTotal =
    template.additionalServices?.reduce(
      (a: number, s: any) => a + lineItemAmount(s),
      0,
    ) || 0;
  const isWebDev = (template.category ?? "web-development") === "web-development";
  const discountAmount = isWebDev
    ? (basePrice * (template.pricing?.discount || 0)) / 100
    : (servicesTotal * (template.pricing?.discount || 0)) / 100;
  const grandTotal = isWebDev
    ? basePrice - discountAmount + servicesTotal
    : servicesTotal - discountAmount;

  // ── Category-aware presentation flags ──────────────────────────────────────
  const catConfig = getCategoryConfig(template.category);
  const showPhases = isPhasesEnabled(template.category);
  const showTech = catConfig.sections.includes("techStack");
  const showWorkflow =
    catConfig.sections.includes("workflow") &&
    !!template.workflow &&
    template.workflow.length > 0;
  const showMilestones =
    !!template.paymentMilestones && template.paymentMilestones.length > 0;
  const showUnitQty = isUnitBased(template.category);
  const services = template.additionalServices || [];
  const money = (n: number) => formatMoney(n || 0, "৳");

  return (
    <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full shadow-sm"
            onClick={() => router.push("/templates")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                {template.name || "Unnamed Template"}
              </h1>
              <Badge variant="secondary">{catConfig.label}</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Read-only breakdown of this template&apos;s scope and pricing.
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/templates/edit/${template._id}`}>
            <Pencil className="h-4 w-4" />
            Edit Template
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview */}
          <Card>
            <CardHeader className="border-b bg-muted/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Template Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                {template.overview?.trim()
                  ? template.overview
                  : "No overview specified for this template."}
              </p>
            </CardContent>
          </Card>

          {/* Phases — only for phase-based categories */}
          {showPhases && (
            <Card>
              <CardHeader className="border-b bg-muted/10">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Project Phases
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {!template.phases || template.phases.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No phases defined for this template.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {template.phases.map((phase: any, index: number) => (
                      <div
                        key={index}
                        className="rounded-xl border bg-card p-5 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <Badge variant="outline" className="text-[10px]">
                              Phase {index + 1}
                            </Badge>
                            <h3 className="font-bold text-base">
                              {phase.title || "Untitled phase"}
                            </h3>
                          </div>
                          {(phase.startDate || phase.endDate) && (
                            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded border">
                              {phase.startDate || "TBD"} —{" "}
                              {phase.endDate || "TBD"}
                            </span>
                          )}
                        </div>
                        {phase.description && (
                          <p className="text-sm text-muted-foreground whitespace-pre-line">
                            {phase.description}
                          </p>
                        )}
                        {phase.items && phase.items.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {phase.items.map((item: string, iIdx: number) => (
                              <Badge
                                key={iIdx}
                                variant="secondary"
                                className="font-normal"
                              >
                                {item}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Packages / Line items */}
          {services.length > 0 && (
            <Card>
              <CardHeader className="border-b bg-muted/10">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  {isWebDev ? "Additional Services" : "Packages / Line Items"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Billing</TableHead>
                        {showUnitQty && (
                          <TableHead className="text-right">Qty</TableHead>
                        )}
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {services.map((s: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{s.title}</span>
                              {s.description && (
                                <span className="text-xs text-muted-foreground w-80 truncate">
                                  {s.description}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {BILLING_CYCLE_LABELS[
                                s.billingCycle as keyof typeof BILLING_CYCLE_LABELS
                              ] ?? s.billingCycle}
                            </Badge>
                          </TableCell>
                          {showUnitQty && (
                            <TableCell className="text-right tabular-nums">
                              {s.quantity ?? 1}
                            </TableCell>
                          )}
                          <TableCell className="text-right font-bold">
                            {money(lineItemAmount(s))}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell
                          colSpan={showUnitQty ? 3 : 2}
                          className="text-right font-semibold"
                        >
                          Total
                        </TableCell>
                        <TableCell className="text-right font-black">
                          {money(servicesTotal)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Technical Blueprint — only for web-development */}
          {showTech && (
            <Card>
              <CardHeader className="border-b bg-muted/10">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  Technical Blueprint
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  {(
                    [
                      ["Frontend", template.techStack?.frontend],
                      ["Backend", template.techStack?.backend],
                      ["Database", template.techStack?.database],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="rounded-lg border bg-muted/10 p-3">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">
                        {label}
                      </span>
                      <span className="font-semibold text-foreground/90">
                        {value || "Not specified"}
                      </span>
                    </div>
                  ))}
                </div>
                {template.techStack?.tools &&
                  template.techStack.tools.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-2">
                        Preconfigured Tools
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {template.techStack.tools.map(
                          (t: string, idx: number) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="font-normal"
                            >
                              {t}
                            </Badge>
                          ),
                        )}
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          )}

          {/* Workflow — categories that use workflow */}
          {showWorkflow && (
            <Card>
              <CardHeader className="border-b bg-muted/10">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Workflow Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ol className="space-y-2">
                  {template.workflow!.map((step: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {idx + 1}
                      </span>
                      <span className="text-foreground/90">{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Payment Milestones */}
          {showMilestones && (
            <Card>
              <CardHeader className="border-b bg-muted/10">
                <CardTitle className="text-lg flex items-center gap-2">
                  <HandCoins className="h-4 w-4 text-primary" />
                  Payment Milestones
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-2">
                {template.paymentMilestones!.map((m: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border bg-muted/10 p-3 text-sm"
                  >
                    <span className="font-medium text-foreground/90">
                      {m.label}
                    </span>
                    <Badge variant="secondary" className="font-bold">
                      {m.percentage}%
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar — financial projection */}
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                Financial Projection
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3 text-sm">
              {isWebDev && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Base Price</span>
                  <span className="font-semibold">{money(basePrice)}</span>
                </div>
              )}
              {servicesTotal > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {isWebDev ? "Add-ons" : "Line items"}
                  </span>
                  <span className="font-semibold">{money(servicesTotal)}</span>
                </div>
              )}
              {template.pricing?.discount ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Discount ({template.pricing.discount}%)
                  </span>
                  <span className="font-semibold text-destructive">
                    − {money(discountAmount)}
                  </span>
                </div>
              ) : null}

              <Separator />

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Grand Template Value
                </span>
                <div className="text-3xl font-black tracking-tight text-primary mt-1">
                  {money(grandTotal)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
