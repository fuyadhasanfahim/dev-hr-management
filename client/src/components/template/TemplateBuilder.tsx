"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  X,
  ChevronDown,
  Layers,
  Settings2,
  Cpu,
  HandCoins,
  Activity,
  Receipt,
  PieChart,
  Briefcase,
  Layout,
  FileText,
  DollarSign,
  LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatMoney } from "@/lib/money";

const PREDEFINED_TOOLS = [
  "Figma", "Adobe XD", "Tailwind CSS", "shadcn/ui", "Firebase",
  "AWS", "Vercel", "Docker", "Stripe", "Cloudinary",
  "Sentry", "GitHub Actions", "CI/CD", "SEO Tools"
];

import {
  IQuotationPhase,
  IAdditionalService,
  IPaymentMilestone,
} from "@/types/quotation.type";

const FRONTEND_OPTIONS = ["Next.js", "React", "Vue", "Angular"];
const BACKEND_OPTIONS = ["Node.js", "NestJS", "Laravel", "Django"];
const DB_OPTIONS = ["MongoDB", "PostgreSQL", "MySQL", "Firebase"];

export interface TemplateData {
  name: string;
  overview: string;
  phases: IQuotationPhase[];
  techStack: {
    frontend: string;
    backend: string;
    database: string;
    tools: string[];
  };
  pricing: {
    basePrice: number;
    discount: number;
  };
  additionalServices: IAdditionalService[];
  workflow: string[];
  paymentMilestones: IPaymentMilestone[];
}

export default function TemplateBuilder({
  data,
  onChange,
  onSave,
  isSaving,
  pageTitle,
}: {
  data: TemplateData;
  onChange: (data: TemplateData) => void;
  onSave: () => void;
  isSaving: boolean;
  pageTitle: string;
}) {
  const updateData = (updates: Partial<TemplateData>) => {
    onChange({ ...data, ...updates });
  };

  const computedTotals = useMemo(() => {
    const subtotal = data.pricing.basePrice + data.additionalServices.reduce((acc, s) => acc + s.price, 0);
    const discountAmount = (subtotal * data.pricing.discount) / 100;
    const grandTotal = subtotal - discountAmount;
    return { subtotal, discountAmount, grandTotal };
  }, [data.pricing, data.additionalServices]);

  // Phase operations
  const addPhase = () => {
    updateData({
      phases: [...data.phases, { title: "", description: "", items: [] }],
    });
  };

  const updatePhase = (index: number, updates: Partial<IQuotationPhase>) => {
    const newPhases = data.phases.map((p, i) => (i === index ? { ...p, ...updates } : p));
    updateData({ phases: newPhases });
  };

  const removePhase = (index: number) => {
    updateData({ phases: data.phases.filter((_, i) => i !== index) });
  };

  // Tech stack
  const updateTechStack = (updates: Partial<TemplateData["techStack"]>) => {
    updateData({ techStack: { ...data.techStack, ...updates } });
  };

  // Payment Milestones
  const addPaymentMilestone = () => {
    updateData({
      paymentMilestones: [...data.paymentMilestones, { label: "", percentage: 0 }],
    });
  };

  const updatePaymentMilestone = (index: number, updates: Partial<IPaymentMilestone>) => {
    const newMilestones = data.paymentMilestones.map((m, i) => (i === index ? { ...m, ...updates } : m));
    updateData({ paymentMilestones: newMilestones });
  };

  const removePaymentMilestone = (index: number) => {
    updateData({ paymentMilestones: data.paymentMilestones.filter((_, i) => i !== index) });
  };

  // Workflow
  const updateWorkflow = (workflow: string[]) => {
    updateData({ workflow });
  };

  return (
    <div className="w-full space-y-8 p-6 bg-background/40 min-h-screen">
      {/* Header section with Teal and Orange flavor */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layout className="w-8 h-8 text-teal-600" />
            <span>{pageTitle}</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Build dynamic template scope, pricing, phases, and workflows.
          </p>
        </div>
        <div>
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-2 shadow-md hover:shadow-lg px-6 h-11 rounded-lg transition duration-200"
          >
            {isSaving ? (
              <>
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span>Save Template</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Sections */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border bg-card p-6 shadow-sm flex flex-col space-y-6 rounded-xl">
            {/* Template Header/Title */}
            <div className="space-y-4">
              <SectionHeader
                title="Template Identity"
                icon={<FileText className="w-5 h-5 text-teal-600" />}
                description="General name and high-level description for this reusable template"
              />
              <div className="space-y-4">
                <div className="space-y-1">
                  <FieldLabel>Template Name</FieldLabel>
                  <TextInput
                    value={data.name}
                    onChange={(e) => updateData({ name: e.target.value })}
                    placeholder="e.g. E-Commerce Development Package"
                    className="focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Scope Overview</FieldLabel>
                  <TextArea
                    value={data.overview || ""}
                    onChange={(e) => updateData({ overview: e.target.value })}
                    placeholder="Project overview and primary objectives…"
                    className="min-h-[80px] focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Project Phases Section */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-row items-start justify-between gap-4 border-b border-border bg-muted/30 p-6">
              <div className="flex-1 min-w-0">
                <SectionHeader
                  title="Project Phases"
                  icon={<Layers className="w-5 h-5 text-teal-600" />}
                  description="Define clear milestones, end goals, and milestones scope."
                />
              </div>
              <PrimaryButton
                variant="outline"
                className="h-10 px-3 shrink-0 shadow-sm border-teal-500/20 text-teal-600 hover:bg-teal-500/10 hover:text-teal-700 transition duration-150"
                onClick={addPhase}
              >
                <Plus className="w-4 h-4" /> New Phase
              </PrimaryButton>
            </div>
            <div className="p-6">
              {data.phases.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  No phases added yet. Click <span className="font-semibold text-teal-600">New Phase</span> to detail deliverables.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.phases.map((phase, pIdx) => (
                    <details
                      key={pIdx}
                      className="group border border-border/60 rounded-xl bg-muted/10 px-4 py-3"
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-3 py-2 [&::-webkit-details-marker]:hidden">
                        <div className="flex items-center gap-3 text-left w-full">
                          <BadgePill>Phase {pIdx + 1}</BadgePill>
                          <span className="font-bold text-foreground/90">
                            {phase.title || "Untitled phase"}
                          </span>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-open:rotate-180" />
                      </summary>
                      <div className="pt-3 pb-4 space-y-6 border-t border-border/60 mt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <FieldLabel>Title</FieldLabel>
                              <TextInput
                                value={phase.title}
                                onChange={(e) => updatePhase(pIdx, { title: e.target.value })}
                                placeholder="Phase title"
                                className="focus:ring-teal-500 focus:border-teal-500 bg-background"
                              />
                            </div>
                            <div className="space-y-1">
                              <FieldLabel>Description</FieldLabel>
                              <TextArea
                                value={phase.description}
                                onChange={(e) => updatePhase(pIdx, { description: e.target.value })}
                                placeholder="Details / key deliverables of this phase..."
                                className="min-h-[80px] focus:ring-teal-500 focus:border-teal-500 bg-background"
                              />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <FieldLabel>Dates (optional)</FieldLabel>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Start</label>
                                <DatePickerInput
                                  value={phase.startDate || ""}
                                  onChange={(date) => updatePhase(pIdx, { startDate: date })}
                                  placeholder="dd-mm-yyyy"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground">End</label>
                                <DatePickerInput
                                  value={phase.endDate || ""}
                                  onChange={(date) => updatePhase(pIdx, { endDate: date })}
                                  placeholder="dd-mm-yyyy"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <hr className="border-border/60" />

                        <div className="space-y-3">
                          <FieldLabel>Checkpoints (optional)</FieldLabel>
                          <div className="flex flex-wrap gap-2">
                            {phase.items.map((item, iIdx) => (
                              <SoftBadge key={iIdx}>
                                {item}
                                <button
                                  onClick={() =>
                                    updatePhase(pIdx, {
                                      items: phase.items.filter((_, i) => i !== iIdx),
                                    })
                                  }
                                  className="text-muted-foreground hover:text-red-500 transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </SoftBadge>
                            ))}
                            <TextInput
                              placeholder="+ Add checkpoint (Press Enter)…"
                              className="h-9 text-xs border-dashed focus:ring-teal-500 bg-background"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const val = e.currentTarget.value;
                                  if (val) {
                                    updatePhase(pIdx, {
                                      items: [...phase.items, val],
                                    });
                                    e.currentTarget.value = "";
                                  }
                                }
                              }}
                            />
                          </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                          <PrimaryButton
                            variant="ghost"
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-9"
                            onClick={() => removePhase(pIdx)}
                          >
                            <Trash2 className="w-4 h-4" /> Delete Phase
                          </PrimaryButton>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Optional sections */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border bg-muted/30 p-6">
              <SectionHeader
                title="Optional Blueprint & Execution Scope"
                icon={<Settings2 className="w-5 h-5 text-teal-600" />}
                description="Fill optional technical blueprint, workflow, and payment breakdowns"
              />
            </div>
            <div className="p-6 space-y-4">
              {/* Technical Blueprint */}
              <details className="group border border-border/60 rounded-xl bg-muted/10 px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 [&::-webkit-details-marker]:hidden">
                  <Cpu className="w-4 h-4 text-teal-600" />
                  <span className="font-bold text-foreground/90">Technical Blueprint</span>
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="pt-3 pb-4 space-y-4 border-t border-border/60 mt-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <FieldLabel>Frontend</FieldLabel>
                      <SelectInput
                        value={data.techStack.frontend || ""}
                        onChange={(e) => updateTechStack({ frontend: e.target.value })}
                        placeholder="Select"
                      >
                        {FRONTEND_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </SelectInput>
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Backend</FieldLabel>
                      <SelectInput
                        value={data.techStack.backend || ""}
                        onChange={(e) => updateTechStack({ backend: e.target.value })}
                        placeholder="Select"
                      >
                        {BACKEND_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </SelectInput>
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>Database</FieldLabel>
                      <SelectInput
                        value={data.techStack.database || ""}
                        onChange={(e) => updateTechStack({ database: e.target.value })}
                        placeholder="Select"
                      >
                        {DB_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </SelectInput>
                    </div>
                  </div>
                </div>
              </details>

              {/* Tools Selection */}
              <details className="group border border-border/60 rounded-xl bg-muted/10 px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 [&::-webkit-details-marker]:hidden">
                  <Settings2 className="w-4 h-4 text-teal-600" />
                  <span className="font-bold text-foreground/90">Tools</span>
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="pt-3 pb-4 space-y-4 border-t border-border/60 mt-2">
                  <div className="space-y-1">
                    <FieldLabel className="text-[10px]">Selected Tools</FieldLabel>
                    {data.techStack.tools.length === 0 ? (
                      <p className="text-sm text-muted-foreground/60">No tools selected yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {data.techStack.tools.map((tool, idx) => (
                          <SoftBadge key={`${tool}-${idx}`}>
                            {tool}
                            <button
                               onClick={() =>
                                updateTechStack({
                                  tools: data.techStack.tools.filter((t) => t !== tool),
                                })
                              }
                              className="text-muted-foreground/60 hover:text-red-500 transition-colors"
                              aria-label={`Remove ${tool}`}
                              type="button"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </SoftBadge>
                        ))}
                      </div>
                    )}
                  </div>
                  <hr className="border-border/60" />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6">
                    {PREDEFINED_TOOLS.map((tool) => (
                      <div key={tool} className="flex items-center space-x-2">
                        <input
                          id={`tool-${tool}`}
                          type="checkbox"
                          checked={data.techStack.tools.includes(tool)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const newTools = checked
                              ? [...data.techStack.tools, tool]
                              : data.techStack.tools.filter((t) => t !== tool);
                            updateTechStack({ tools: newTools });
                          }}
                          className="h-4 w-4 rounded border border-border text-teal-600 focus:ring-teal-500 bg-background transition duration-150"
                        />
                        <label htmlFor={`tool-${tool}`} className="text-sm cursor-pointer text-foreground/75">
                          {tool}
                        </label>
                      </div>
                    ))}
                  </div>
                  <hr className="border-border/60" />
                  <div className="space-y-1">
                    <FieldLabel className="text-[10px]">Custom Tool Name</FieldLabel>
                    <TextInput
                      placeholder="Type tool name and press Enter…"
                      className="h-9 text-sm focus:ring-teal-500 bg-background"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = e.currentTarget.value.trim();
                          if (val && !data.techStack.tools.includes(val)) {
                            updateTechStack({ tools: [...data.techStack.tools, val] });
                            e.currentTarget.value = "";
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </details>

              {/* Payment Milestones */}
              <details className="group border border-border/60 rounded-xl bg-muted/10 px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 [&::-webkit-details-marker]:hidden">
                  <HandCoins className="w-4 h-4 text-teal-600" />
                  <span className="font-bold text-foreground/90">Payment Milestones</span>
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="pt-3 pb-4 space-y-4 border-t border-border/60 mt-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground font-medium">
                      Define clear payment allocation percentages for milestones
                    </p>
                    <PrimaryButton
                      variant="outline"
                      className="h-9 px-3 border-teal-500/20 hover:bg-teal-500/10 text-teal-600 hover:text-teal-700 font-medium"
                      onClick={addPaymentMilestone}
                    >
                      <Plus className="w-4 h-4" /> Add Milestone
                    </PrimaryButton>
                  </div>

                  {data.paymentMilestones.length === 0 ? (
                    <p className="text-sm text-muted-foreground/60">No payment milestones defined.</p>
                  ) : null}

                  {data.paymentMilestones.map((m, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center rounded-lg border border-border/60 bg-muted/10 p-2">
                      <TextInput
                        className="col-span-7 h-9 text-sm bg-background focus:ring-teal-500"
                        value={m.label}
                        onChange={(e) => updatePaymentMilestone(idx, { label: e.target.value })}
                        placeholder="Milestone label (e.g. Upon Delivery)"
                      />
                      <div className="col-span-3 flex items-center gap-1">
                        <TextInput
                          className="h-9 text-sm bg-background focus:ring-teal-500"
                          type="number"
                          value={m.percentage}
                          min={0}
                          max={100}
                          onChange={(e) =>
                            updatePaymentMilestone(idx, {
                              percentage: Number(e.target.value),
                            })
                          }
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                      <PrimaryButton
                        variant="ghost"
                        className="col-span-2 text-red-500 hover:text-red-600 hover:bg-red-500/10 h-9"
                        onClick={() => removePaymentMilestone(idx)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </PrimaryButton>
                    </div>
                  ))}

                  {(() => {
                    const total = data.paymentMilestones.reduce((s, m) => s + (Number(m.percentage) || 0), 0);
                    const ok = total === 100;
                    return (
                      <div className="flex items-center justify-between text-xs rounded-lg px-3 py-2 bg-muted text-foreground/80 border border-border font-medium">
                        <span className="flex items-center gap-1 font-semibold">
                          <PieChart className="w-3.5 h-3.5 text-teal-600" /> Allocation Summary
                        </span>
                        <span className={ok ? "text-teal-600 font-bold" : "text-orange-500 font-bold"}>
                          {total}% {ok ? "✓ Valid Allocation" : "of 100% required"}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <PrimaryButton
                      variant="outline"
                      className="h-10 px-3 text-sm border-border text-foreground hover:bg-muted/30 transition"
                      onClick={() =>
                        updateData({
                          paymentMilestones: [
                            { label: "Upfront on acceptance", percentage: 50 },
                            { label: "After delivery handover", percentage: 30 },
                            { label: "Final approval / clearance", percentage: 20 },
                          ],
                        })
                      }
                    >
                      Use 50 / 30 / 20
                    </PrimaryButton>
                    <PrimaryButton
                      variant="outline"
                      className="h-10 px-3 text-sm border-border text-foreground hover:bg-muted/30 transition"
                      onClick={() =>
                        updateData({
                          paymentMilestones: [
                            { label: "Upfront on acceptance", percentage: 40 },
                            { label: "Mid-project review", percentage: 30 },
                            { label: "Final delivery", percentage: 30 },
                          ],
                        })
                      }
                    >
                      Use 40 / 30 / 30
                    </PrimaryButton>
                  </div>
                </div>
              </details>

              {/* Workflow Steps */}
              <details className="group border border-border/60 rounded-xl bg-muted/10 px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 [&::-webkit-details-marker]:hidden">
                  <Activity className="w-4 h-4 text-teal-600" />
                  <span className="font-bold text-foreground/90">Lifecycle Workflow</span>
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="pt-3 pb-4 space-y-4 border-t border-border/60 mt-2">
                  <div className="flex flex-wrap gap-2">
                    {data.workflow.map((step, idx) => (
                      <SoftBadge key={idx}>
                        <span className="text-[8px] opacity-40 font-mono">{idx + 1}</span>
                        {step}
                        <button
                          onClick={() => updateWorkflow(data.workflow.filter((_, i) => i !== idx))}
                          className="text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </SoftBadge>
                    ))}
                  </div>
                  <TextInput
                    placeholder="Add workflow step (Press Enter)…"
                    className="h-10 text-sm border-dashed focus:ring-teal-500 bg-background"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = e.currentTarget.value;
                        if (val) {
                          updateWorkflow([...data.workflow, val]);
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />
                </div>
              </details>
            </div>
          </div>
        </div>

        {/* Sidebar: Cost Calculations */}
        <div className="space-y-6">
          <div className="border border-border overflow-hidden rounded-xl bg-card shadow-sm flex flex-col">
            <div className="bg-muted/30 border-b border-border p-6">
              <div className="text-lg font-bold flex items-center gap-2">
                <span className="inline-flex w-9 h-9 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/20">
                  <Receipt className="w-4 h-4" />
                </span>
                <span className="text-foreground/90">Template Pricing</span>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <FieldLabel>Base Projection (Base Price)</FieldLabel>
                  <TextInput
                    type="number"
                    value={data.pricing.basePrice}
                    onChange={(e) =>
                      updateData({
                        pricing: { ...data.pricing, basePrice: Number(e.target.value) },
                      })
                    }
                    className="h-10 text-sm focus:ring-teal-500 bg-background font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Standard Discount (%)</FieldLabel>
                  <TextInput
                    type="number"
                    value={data.pricing.discount}
                    onChange={(e) =>
                      updateData({
                        pricing: { ...data.pricing, discount: Number(e.target.value) },
                      })
                    }
                    className="h-10 text-sm focus:ring-teal-500 bg-background font-medium"
                  />
                </div>
              </div>

              {/* Additional Services */}
              <div className="space-y-3 pt-4 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <FieldLabel>Optional / Additional Scope</FieldLabel>
                  <button
                    onClick={() =>
                      updateData({
                        additionalServices: [...data.additionalServices, { title: "", price: 0, billingCycle: "one-time" }],
                      })
                    }
                    className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1 transition-colors"
                    type="button"
                  >
                    <Plus className="w-3 w-3" /> Add Service
                  </button>
                </div>

                {data.additionalServices.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 text-center py-2">
                    No extra/add-on services configured.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.additionalServices.map((service, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <TextInput
                          placeholder="Scope title"
                          className="h-9 text-xs flex-1 bg-background focus:ring-teal-500"
                          value={service.title}
                          onChange={(e) => {
                            const updated = data.additionalServices.map((s, i) =>
                              i === idx ? { ...s, title: e.target.value } : s
                            );
                            updateData({ additionalServices: updated });
                          }}
                        />
                        <div className="relative w-[110px]">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground/60">
                            ৳
                          </span>
                          <TextInput
                            type="number"
                            className="h-9 pl-6 pr-2 text-xs w-full bg-background focus:ring-teal-500 font-medium"
                            value={service.price}
                            onChange={(e) => {
                              const updated = data.additionalServices.map((s, i) =>
                                i === idx ? { ...s, price: Number(e.target.value) } : s
                              );
                              updateData({ additionalServices: updated });
                            }}
                          />
                        </div>
                        <PrimaryButton
                          variant="ghost"
                          className="w-8 h-8 rounded-lg p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10 h-9 shrink-0 flex items-center justify-center"
                          onClick={() => {
                            const updated = data.additionalServices.filter((_, i) => i !== idx);
                            updateData({ additionalServices: updated });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </PrimaryButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Grand Cost Calculations */}
              <div className="pt-4 border-t border-border/60 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Base / Subtotal</span>
                  <span className="font-semibold text-foreground/80">
                    {formatMoney(computedTotals.subtotal, "৳")}
                  </span>
                </div>
                {data.pricing.discount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-orange-500">
                      Standard Discount ({data.pricing.discount}%)
                    </span>
                    <span className="font-bold text-orange-600">
                      - {formatMoney(computedTotals.discountAmount, "৳")}
                    </span>
                  </div>
                )}

                <div className="pt-4 border-t border-border space-y-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">
                    Grand Project Total
                  </span>
                  <div className="text-3xl font-bold tracking-tight text-teal-600 leading-none">
                    {formatMoney(computedTotals.grandTotal, "৳")}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 px-6 pb-6 bg-muted/10">
              <Button
                onClick={onSave}
                disabled={isSaving}
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-2 shadow-md hover:shadow-lg w-full h-11 rounded-lg transition duration-200"
              >
                {isSaving ? (
                  <>
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>Direct Save Template</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function SectionHeader({
  title,
  icon,
  description,
}: {
  title: string;
  icon: React.ReactNode;
  description?: string;
}) {
  return (
    <div className="space-y-1 mb-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/20">
          {icon}
        </span>
        <h3 className="text-lg font-bold tracking-tight text-foreground">{title}</h3>
      </div>
      {description && <p className="text-sm text-muted-foreground font-medium">{description}</p>}
    </div>
  );
}

function FieldLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <label className={`text-xs font-bold uppercase tracking-wider text-muted-foreground block ${className}`}>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={[
        "h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition duration-150",
        "placeholder:text-muted-foreground/50",
        "focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      {...rest}
      className={[
        "w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition duration-150",
        "placeholder:text-muted-foreground/50",
        "focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
    />
  );
}

function DatePickerInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (dateStr: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const dateObj = value ? new Date(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full h-10 justify-between text-left font-normal border-border focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-background text-foreground"
        >
          {dateObj ? format(dateObj, "PPP") : <span className="text-muted-foreground/60">{placeholder}</span>}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-background border border-border" align="start">
        <Calendar
          mode="single"
          selected={dateObj}
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          defaultMonth={dateObj}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string }) {
  const { className = "", placeholder, children, ...rest } = props;
  return (
    <select
      {...rest}
      className={[
        "h-10 w-full rounded-md border border-border bg-background text-foreground px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition duration-150",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
    >
      {placeholder ? (
        <option value="" disabled className="bg-background text-muted-foreground">
          {placeholder}
        </option>
      ) : null}
      {children}
    </select>
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "secondary" | "ghost" }) {
  const { className = "", variant = "primary", ...rest } = props;
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed transition duration-150";
  const variants: Record<string, string> = {
    primary: "bg-teal-600 text-white hover:bg-teal-700 h-11 px-4 shadow-sm",
    outline: "border border-border bg-background text-foreground hover:bg-muted/30 h-11 px-4",
    secondary: "bg-muted text-foreground hover:bg-muted/80 h-10 px-3",
    ghost: "bg-transparent hover:bg-muted/30 text-muted-foreground hover:text-foreground h-9 px-3",
  };
  return <button {...rest} className={`${base} ${variants[variant]} ${className}`} />;
}

function SoftBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-xs font-semibold text-foreground/85 shadow-sm transition duration-150">
      {children}
    </span>
  );
}

function BadgePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-teal-500/10 text-teal-600 border border-teal-500/20 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase">
      {children}
    </span>
  );
}
