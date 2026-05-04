"use client";

import { useParams, useRouter } from "next/navigation";
import { useGetQuotationTemplateByIdQuery } from "@/redux/features/quotation/quotationApi";
import { format } from "date-fns";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Edit, Layout, FileText, Layers, Cpu, HandCoins, Activity, Receipt } from "lucide-react";
import Link from "next/link";

export default function TemplateDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: template, isLoading } = useGetQuotationTemplateByIdQuery(id, { skip: !id });

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center text-slate-400">
        Loading template details...
      </div>
    );
  }

  if (!template) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center gap-4 text-slate-500">
        <p>Template not found or has been removed.</p>
        <Button onClick={() => router.push("/templates")}>Back to Templates</Button>
      </div>
    );
  }

  const basePrice = template.pricing?.basePrice || 0;
  const discountAmount = (basePrice * (template.pricing?.discount || 0)) / 100;
  const grandTotal = basePrice - discountAmount + (template.additionalServices?.reduce((a: number, s: any) => a + (s.price || 0), 0) || 0);

  return (
    <div className="w-full space-y-8 p-6 bg-slate-50/40 min-h-screen">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Button
            asChild
            variant="ghost"
            className="mb-2 text-slate-600 hover:bg-slate-100 flex items-center gap-2 p-0 h-auto"
          >
            <Link href="/templates">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Templates</span>
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Layout className="w-8 h-8 text-teal-600" />
            <span>{template.name || "Unnamed Template"}</span>
          </h1>
          <p className="text-slate-500 mt-1">Full breakdown of quotation scope, phases, and pricing</p>
        </div>
        <div>
          <Button
            asChild
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-2 shadow-sm hover:shadow-lg rounded-lg h-11 px-6 transition duration-200"
          >
            <Link href={`/templates/edit/${template._id}`}>
              <Edit className="w-4 h-4" />
              <span>Edit Template</span>
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Identity & Overview */}
          <Card className="border-slate-200 bg-white p-6 shadow-sm rounded-xl">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                <FileText className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-slate-800">Template Overview</h2>
            </div>
            <div className="mt-4 text-slate-600 leading-relaxed text-sm whitespace-pre-line">
              {template.overview || "No overview specified for this template."}
            </div>
          </Card>

          {/* Phases Details */}
          <Card className="border-slate-200 bg-white p-6 shadow-sm rounded-xl">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-4">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                <Layers className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-slate-800">Project Phases</h2>
            </div>
            {!template.phases || template.phases.length === 0 ? (
              <p className="text-sm text-slate-400">No specific phases defined for this template.</p>
            ) : (
              <div className="space-y-4">
                {template.phases.map((phase: any, index: number) => (
                  <div
                    key={index}
                    className="border border-slate-100 rounded-xl bg-slate-50/40 p-4 space-y-3"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="bg-teal-50 text-teal-600 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase">
                          Phase {index + 1}
                        </span>
                        <h3 className="font-bold text-slate-800 text-base mt-1">
                          {phase.title || "Untitled phase"}
                        </h3>
                      </div>
                      <span className="text-xs font-mono text-slate-400 bg-white px-2.5 py-1 border border-slate-100 rounded-md">
                        {phase.startDate ? phase.startDate : "TBD"} —{" "}
                        {phase.endDate ? phase.endDate : "TBD"}
                      </span>
                    </div>
                    {phase.description && (
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                        {phase.description}
                      </p>
                    )}
                    {phase.items && phase.items.length > 0 && (
                      <div className="pt-3 border-t border-slate-100">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                          Key Checkpoints
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {phase.items.map((item: string, iIdx: number) => (
                            <span
                              key={iIdx}
                              className="bg-white border border-slate-200 text-slate-700 text-xs px-2.5 py-1 rounded-lg font-medium shadow-sm"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Additional details: Tech Stack, Payment Milestones, Workflow */}
          <Card className="border-slate-200 bg-white p-6 shadow-sm rounded-xl space-y-6">
            {/* Tech stack blueprint */}
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                  <Cpu className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-800">Technical Blueprint</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-3">
                <div className="bg-slate-50/60 p-3 rounded-lg border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Frontend
                  </span>
                  <span className="font-bold text-slate-700">
                    {template.techStack?.frontend || "Not Specified"}
                  </span>
                </div>
                <div className="bg-slate-50/60 p-3 rounded-lg border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Backend
                  </span>
                  <span className="font-bold text-slate-700">
                    {template.techStack?.backend || "Not Specified"}
                  </span>
                </div>
                <div className="bg-slate-50/60 p-3 rounded-lg border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Database
                  </span>
                  <span className="font-bold text-slate-700">
                    {template.techStack?.database || "Not Specified"}
                  </span>
                </div>
              </div>
              {template.techStack?.tools && template.techStack.tools.length > 0 && (
                <div className="mt-3 bg-slate-50/40 border border-slate-100 rounded-lg p-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
                    Preconfigured Tools
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {template.techStack.tools.map((t: string, idx: number) => (
                      <span
                        key={idx}
                        className="bg-white border border-slate-200 px-2.5 py-1 text-xs text-slate-600 rounded-lg font-medium shadow-sm"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Workflow steps */}
            {template.workflow && template.workflow.length > 0 && (
              <div>
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                    <Activity className="w-4 h-4" />
                  </span>
                  <h3 className="text-base font-bold text-slate-800">Workflow Pipeline</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {template.workflow.map((step: string, idx: number) => (
                    <span
                      key={idx}
                      className="bg-slate-50 border border-slate-100 px-3 py-1.5 text-xs text-slate-700 font-semibold rounded-lg shadow-sm"
                    >
                      <span className="text-teal-600 font-bold mr-1">{idx + 1}.</span>
                      {step}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Milestones */}
            {template.paymentMilestones && template.paymentMilestones.length > 0 && (
              <div>
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                    <HandCoins className="w-4 h-4" />
                  </span>
                  <h3 className="text-base font-bold text-slate-800">Payment Milestones</h3>
                </div>
                <div className="space-y-2">
                  {template.paymentMilestones.map((m: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-slate-50/50 border border-slate-100 rounded-xl p-3 text-sm"
                    >
                      <span className="font-semibold text-slate-700">{m.label}</span>
                      <span className="bg-teal-50 text-teal-600 px-2.5 py-1 rounded-full text-xs font-extrabold tracking-wide">
                        {m.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar calculations */}
        <div className="space-y-6">
          <Card className="border-slate-200 bg-white overflow-hidden rounded-xl shadow-md flex flex-col h-fit">
            <div className="bg-slate-50/50 border-b border-slate-100 p-6">
              <div className="text-lg font-bold flex items-center gap-2">
                <span className="inline-flex w-9 h-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                  <Receipt className="w-4 h-4" />
                </span>
                <span className="text-slate-800">Financial Projection</span>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-3">
                <span className="text-slate-500 font-medium">Base Price</span>
                <span className="font-bold text-slate-700">
                  {formatMoney(basePrice, "৳")}
                </span>
              </div>
              {template.pricing?.discount !== undefined && template.pricing.discount > 0 && (
                <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-3">
                  <span className="text-orange-500 font-medium">Discount ({template.pricing.discount}%)</span>
                  <span className="font-bold text-orange-600">
                    - {formatMoney(discountAmount, "৳")}
                  </span>
                </div>
              )}
              {template.additionalServices && template.additionalServices.length > 0 && (
                <div className="space-y-2 border-b border-slate-50 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    Additional Options Added
                  </span>
                  {template.additionalServices.map((s: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 font-medium">{s.label}</span>
                      <span className="font-semibold text-slate-700">
                        {formatMoney(s.price || 0, "৳")}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                  Grand Template Value
                </span>
                <div className="text-3xl font-extrabold tracking-tight text-teal-600 mt-1">
                  {formatMoney(grandTotal, "৳")}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
