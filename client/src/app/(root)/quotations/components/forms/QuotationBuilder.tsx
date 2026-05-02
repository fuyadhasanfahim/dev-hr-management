"use client";

import React, { useMemo, useEffect, useState } from "react";
import { useQuotationStore } from "@/store/useQuotationStore";
import {
  Building2,
  Cpu,
  Plus,
  Trash2,
  Sparkles,
  Save,
  Send,
  Receipt,
  Layers,
  Activity,
  X,
  CalendarIcon,
  Settings2,
  HandCoins,
  PieChart,
  Briefcase,
  ChevronDown,
} from "lucide-react";
import { useGetClientsQuery } from "@/redux/features/client/clientApi";
import {
  useCreateQuotationMutation,
  useSendQuotationMutation,
  useUpdateQuotationMutation,
} from "@/redux/features/quotation/quotationApi";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { QUOTATION_TEMPLATES } from "@/constants/quotation-templates";
import { format } from "date-fns";
import { formatMoney } from "@/lib/money";
import { QuotationEmailDialog } from "../QuotationEmailDialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


// ── Constants ────────────────────────────────────────────────────────────────

const PREDEFINED_TOOLS = [
  "Figma", "Adobe XD", "Tailwind CSS", "shadcn/ui", "Firebase", 
  "AWS", "Vercel", "Docker", "Stripe", "Cloudinary", 
  "Sentry", "GitHub Actions", "CI/CD", "SEO Tools"
];

const FRONTEND_OPTIONS = ["Next.js", "React", "Vue", "Angular"];
const BACKEND_OPTIONS = ["Node.js", "NestJS", "Laravel", "Django"];
const DB_OPTIONS = ["MongoDB", "PostgreSQL", "MySQL", "Firebase"];

// ── Components ───────────────────────────────────────────────────────────────

function SectionHeader({ title, icon, description }: { title: string; icon: React.ReactNode; description?: string }) {
  return (
    <div className="space-y-1 mb-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
          {icon}
        </span>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      </div>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

function FieldLabel({
  children,
  htmlFor,
  className = "",
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`text-xs font-bold uppercase text-muted-foreground ${className}`}
    >
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
        "h-10 w-full rounded-md border bg-background px-3 text-sm",
        "placeholder:text-muted-foreground/70",
        "focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/40",
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
        "w-full rounded-md border bg-background px-3 py-2 text-sm",
        "placeholder:text-muted-foreground/70",
        "focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/40",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
    />
  );
}

function DatePickerInput({
  value,
  onChange,
  placeholder = "Pick a date",
}: {
  value: string | undefined;
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
          data-empty={!dateObj}
          className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
        >
          {dateObj ? format(dateObj, "PPP") : <span>{placeholder}</span>}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
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

function SelectInput(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string },
) {
  const { className = "", placeholder, children, ...rest } = props;
  return (
    <select
      {...rest}
      className={[
        "h-10 w-full rounded-md border bg-background px-3 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/40",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {children}
    </select>
  );
}

function PrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "outline" | "secondary" | "ghost";
  },
) {
  const { className = "", variant = "primary", ...rest } = props;
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-4",
    outline: "border bg-background hover:bg-muted/40 h-11 px-4",
    secondary: "bg-muted text-foreground hover:bg-muted/70 h-10 px-3",
    ghost: "bg-transparent hover:bg-muted/40 text-muted-foreground hover:text-foreground h-9 px-3",
  };
  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      className={[base, variants[variant], className].join(" ")}
    />
  );
}

function BadgePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-muted/30 px-2.5 py-0.5 text-xs font-medium">
      {children}
    </span>
  );
}

function SoftBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs">
      {children}
    </span>
  );
}

function GradientCard({
  children,
  className = "",
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "neutral" | "teal" | "orange" | "mixed";
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-card shadow-sm ${className}`}
    >
      {tone !== "neutral" ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-border" />
      ) : null}
      {children}
    </div>
  );
}

// ── Main Builder ─────────────────────────────────────────────────────────────

export default function QuotationBuilder({
  hideHeader = false,
}: {
  hideHeader?: boolean;
}) {
  const router = useRouter();
  const {
    data,
    updateClient,
    updateDetails,
    loadTemplate,
    updateTechStack,
    updateWorkflow,
    updatePricing,
    addPhase,
    updatePhase,
    removePhase,
    setPaymentMilestones,
    addPaymentMilestone,
    updatePaymentMilestone,
    removePaymentMilestone,
    reset,
  } = useQuotationStore();

  const { data: clientsData, isLoading: clientsLoading } = useGetClientsQuery({});
  const [createQuotation, { isLoading: isCreating }] = useCreateQuotationMutation();
  const [updateQuotation, { isLoading: isUpdating }] = useUpdateQuotationMutation();
  const [sendQuotation, { isLoading: isSending }] = useSendQuotationMutation();

  const [recipientModalOpen, setRecipientModalOpen] = useState(false);

  // ── Pricing Logic ──
  const computedTotals = useMemo(() => {
    const basePrice = data.pricing.basePrice || 0;
    const additionalServicesTotal = data.additionalServices.reduce((acc, s) => acc + s.price, 0);
    
    const subtotalBeforeDiscount = basePrice + additionalServicesTotal;
    const discountAmount = (subtotalBeforeDiscount * (data.pricing.discount || 0)) / 100;
    const subtotal = subtotalBeforeDiscount - discountAmount;
    
    const taxAmount = (subtotal * (data.pricing.taxRate || 0)) / 100;
    const grandTotal = subtotal + taxAmount;

    return { subtotal, taxAmount, grandTotal };
  }, [data.pricing, data.additionalServices]);

  useEffect(() => {
    useQuotationStore.setState((state) => ({
      data: { ...state.data, totals: computedTotals },
    }));
  }, [computedTotals]);

  const saveQuotation = async (status: "draft" | "sent") => {
    if (!data.clientId) return toast.error("Please select a client first");
    try {
      const payload = { ...data, status };
      if (data._id) {
        const updated = await updateQuotation({ id: data._id, ...payload }).unwrap();
        toast.success("Quotation updated successfully");
        return updated._id;
      } else {
        const created = await createQuotation(payload).unwrap();
        toast.success("Quotation created successfully");
        return created._id;
      }
    } catch (err: unknown) {
      const maybe = err as { data?: { message?: string } } | null;
      toast.error(maybe?.data?.message || "Failed to save quotation");
    }
  };

  const openRecipientPicker = () => {
    if (!data.clientId) return toast.error("Please select a client first");
    setRecipientModalOpen(true);
  };

  const confirmDispatch = async (selectedEmails: string[]) => {
    if (!data.clientId) {
      toast.error("Please select a client first");
      return [];
    }
    if (selectedEmails.length === 0) {
      toast.warning("Please select at least one recipient");
      return [];
    }
    if (isSending || isCreating || isUpdating) return [];

    const id = data._id || (await saveQuotation("draft"));
    if (!id) return [];

    try {
      const result = await sendQuotation({ id: String(id), emails: selectedEmails }).unwrap();
      if (result.data.clientLink) {
        try {
          await navigator.clipboard.writeText(result.data.clientLink);
          toast.success("Client link copied to clipboard!");
        } catch {
          // Clipboard not always permitted — non-fatal.
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
          result.data.emailError || "Email was not sent. Link was generated only.",
        );
      }

      // If at least one email succeeded, navigate away after the user closes the
      // results view (they'll click "Done" — handled by the dialog itself). For
      // total failures we keep the user on the builder so they can retry.
      if (sent.length > 0 && failed.length === 0) {
        // Deferring slightly so the dialog can show the success state before nav.
        setTimeout(() => {
          setRecipientModalOpen(false);
          reset();
          router.push("/quotations");
        }, 1500);
      }

      return recipients;
    } catch (err) {
      toast.error((err as Error).message || "Failed to send quotation");
      return [];
    }
  };

  return (
    <div className="space-y-8">
      {!hideHeader && (
        <div className="relative overflow-hidden rounded-2xl border bg-card p-6">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-border" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-muted text-muted-foreground ring-1 ring-border">
                <Briefcase className="w-6 h-6 text-muted-foreground" />
              </span>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Quotation Builder
                </h1>
                <p className="text-muted-foreground text-sm">
                  Configure scope, timeline, milestones, and pricing.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-[240px]">
                <Sparkles className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <SelectInput
                  value=""
                  placeholder="Industry Templates"
                  className="pl-9"
                  onChange={(e) => loadTemplate(e.target.value)}
                >
                  {Object.keys(QUOTATION_TEMPLATES).map((key) => (
                    <option key={key} value={key}>
                      {key
                        .split("-")
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(" ")}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <PrimaryButton variant="outline" className="h-10 px-3" onClick={reset}>
                Reset
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b bg-muted/20 p-6">
              <SectionHeader
                title="Basics"
                icon={<Building2 className="w-5 h-5" />}
                description="Start with the essentials. You can fill optional sections later."
              />
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                    Pre-configured Template
                  </FieldLabel>
                  <ShadcnSelect
                    onValueChange={(value) => loadTemplate(value)}
                  >
                    <SelectTrigger className="w-full h-10">
                      <SelectValue placeholder="Select Template" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(QUOTATION_TEMPLATES).map((key) => (
                        <SelectItem key={key} value={key}>
                          {QUOTATION_TEMPLATES[key].details?.title || key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </ShadcnSelect>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Proposal Name</FieldLabel>
                  <TextInput
                    value={data.details.title}
                    onChange={(e) => updateDetails({ title: e.target.value })}
                    placeholder="e.g. Project Quotation"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Client</FieldLabel>
                  <ShadcnSelect
                    value={data.clientId || ""}
                    onValueChange={(id) => {
                      const c = clientsData?.clients.find((x) => x._id === id);
                      if (!c) return;
                      // Single atomic update prevents render-loop overwrites of
                      // manually edited contactName/companyName fields.
                      useQuotationStore.setState((state) => ({
                        data: {
                          ...state.data,
                          clientId: id,
                          currency: c.currency || state.data.currency || "BDT",
                          client: {
                            ...state.data.client,
                            contactName: c.name || state.data.client.contactName,
                            companyName:
                              state.data.client.companyName || c.name || "",
                            email: c.emails?.[0] || state.data.client.email || "",
                            phone: c.phone || state.data.client.phone || "",
                            address:
                              c.address ||
                              c.officeAddress ||
                              state.data.client.address ||
                              "",
                          },
                        },
                      }));
                    }}
                  >
                    <SelectTrigger className="w-full h-10">
                      <SelectValue placeholder={clientsLoading ? "Fetching..." : "Select Client"} />
                    </SelectTrigger>
                    <SelectContent>
                      {clientsData?.clients.map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </ShadcnSelect>
                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FieldLabel>Issuance Date</FieldLabel>
                  <DatePickerInput
                    value={data.details.date}
                    onChange={(date) => updateDetails({ date })}
                    placeholder="dd-mm-yyyy"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Valid Until</FieldLabel>
                  <DatePickerInput
                    value={data.details.validUntil}
                    onChange={(date) => updateDetails({ validUntil: date })}
                    placeholder="dd-mm-yyyy"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FieldLabel>Contact name</FieldLabel>
                  <TextInput
                    value={data.client.contactName}
                    onChange={(e) => updateClient({ contactName: e.target.value })}
                    placeholder="Client contact"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Company name</FieldLabel>
                  <TextInput
                    value={data.client.companyName || ""}
                    onChange={(e) => updateClient({ companyName: e.target.value })}
                    placeholder="Client company"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FieldLabel>Email</FieldLabel>
                  <TextInput
                    type="email"
                    value={data.client.email || ""}
                    onChange={(e) => updateClient({ email: e.target.value })}
                    placeholder="email@client.com"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Phone</FieldLabel>
                  <TextInput
                    value={data.client.phone || ""}
                    onChange={(e) => updateClient({ phone: e.target.value })}
                    placeholder="+880…"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel>Project Overview</FieldLabel>
                <TextArea
                  value={data.overview || ""}
                  onChange={(e) =>
                    useQuotationStore.setState((s) => ({
                      data: { ...s.data, overview: e.target.value },
                    }))
                  }
                  placeholder="Short description of the project goals and scope (1–3 sentences)…"
                  className="min-h-[90px]"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Address</FieldLabel>
                <TextArea
                  value={data.client.address || ""}
                  onChange={(e) => updateClient({ address: e.target.value })}
                  placeholder="Bill-to address (auto-filled from client profile)"
                  className="min-h-[60px]"
                />
              </div>
            </div>
          </div>

          {/* Phases */}
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-row items-start justify-between gap-4 border-b bg-muted/20 p-6">
              <div className="flex-1 min-w-0">
                <SectionHeader
                  title="Project Phases"
                  icon={<Layers className="w-5 h-5" />}
                  description="Add phases only if you need a timeline breakdown."
                />
              </div>
              <PrimaryButton
                variant="outline"
                className="h-10 px-3 shrink-0 shadow-sm"
                onClick={() => addPhase()}
              >
                <Plus className="w-4 h-4 mr-1" /> New Phase
              </PrimaryButton>
            </div>
            <div className="p-6">
              {data.phases.length === 0 ? (
                <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  No phases yet. Click <span className="font-medium text-foreground">New Phase</span> if you want to add milestones and checkpoints.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.phases.map((phase, pIdx) => (
                    <details
                      key={pIdx}
                      className="group border rounded-xl bg-card px-4 py-3"
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-3 py-2 [&::-webkit-details-marker]:hidden">
                        <div className="flex items-center gap-3 text-left w-full">
                          <BadgePill>Phase {pIdx + 1}</BadgePill>
                          <span className="font-semibold text-foreground">
                            {phase.title || "Untitled phase"}
                          </span>
                          <div className="ml-auto mr-4 hidden md:flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                            {phase.startDate
                              ? format(new Date(phase.startDate), "MMM dd")
                              : "TBD"}{" "}
                            —{" "}
                            {phase.endDate
                              ? format(new Date(phase.endDate), "MMM dd")
                              : "TBD"}
                          </div>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                      </summary>
                      <div className="pt-3 pb-4 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <FieldLabel>Title</FieldLabel>
                              <TextInput
                                value={phase.title}
                                onChange={(e) =>
                                  updatePhase(pIdx, { title: e.target.value })
                                }
                                placeholder="Phase title"
                              />
                            </div>
                            <div className="space-y-2">
                              <FieldLabel>Description</FieldLabel>
                              <TextArea
                                value={phase.description}
                                onChange={(e) =>
                                  updatePhase(pIdx, {
                                    description: e.target.value,
                                  })
                                }
                                placeholder="Deliverables..."
                                className="min-h-[80px]"
                              />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <FieldLabel>Dates (optional)</FieldLabel>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] text-muted-foreground">Start</label>
                                <DatePickerInput
                                  value={phase.startDate || ""}
                                  onChange={(date) => updatePhase(pIdx, { startDate: date })}
                                  placeholder="dd-mm-yyyy"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] text-muted-foreground">End</label>
                                <DatePickerInput
                                  value={phase.endDate || ""}
                                  onChange={(date) => updatePhase(pIdx, { endDate: date })}
                                  placeholder="dd-mm-yyyy"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <hr className="border-border" />

                        <div className="space-y-3">
                          <FieldLabel>Checkpoints (optional)</FieldLabel>
                          <div className="flex flex-wrap gap-2">
                            {phase.items.map((item, iIdx) => (
                              <SoftBadge
                                key={iIdx}
                              >
                                {item}
                                <button
                                  onClick={() =>
                                    updatePhase(pIdx, {
                                      items: phase.items.filter((_, i) => i !== iIdx),
                                    })
                                  }
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </SoftBadge>
                            ))}
                            <TextInput
                              placeholder="+ Add checkpoint (Enter)…"
                              className="h-9 text-xs border-dashed"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
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
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => removePhase(pIdx)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete Phase
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
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b bg-muted/20 p-6">
              <SectionHeader
                title="Optional details"
                icon={<Settings2 className="w-5 h-5" />}
                description="Fill these only if they add value for the client."
              />
            </div>
            <div className="p-6 space-y-3">
              <details className="group border rounded-xl bg-card px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 [&::-webkit-details-marker]:hidden">
                  <Cpu className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold">Technical Blueprint</span>
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="pt-3 pb-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
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
                    <div className="space-y-2">
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
                    <div className="space-y-2">
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

              <details className="group border rounded-xl bg-card px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 [&::-webkit-details-marker]:hidden">
                  <Settings2 className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold">Tools</span>
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="pt-3 pb-4 space-y-4">
                  <div className="space-y-2">
                    <FieldLabel className="text-[10px]">Selected</FieldLabel>
                    {data.techStack.tools.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tools selected yet.</p>
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
                              className="text-muted-foreground hover:text-foreground"
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
                  <hr className="border-border" />
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
                          className="h-4 w-4 rounded border bg-background text-primary focus:ring-2 focus:ring-ring/30"
                        />
                        <label
                          htmlFor={`tool-${tool}`}
                          className="text-sm cursor-pointer"
                        >
                          {tool}
                        </label>
                      </div>
                    ))}
                  </div>
                  <hr className="border-border" />
                  <div className="space-y-2">
                    <FieldLabel className="text-[10px]">Custom tool</FieldLabel>
                    <TextInput
                      placeholder="Type a tool name and press Enter…"
                      className="h-9 text-sm"
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

              <details className="group border rounded-xl bg-card px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 [&::-webkit-details-marker]:hidden">
                  <HandCoins className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold">Payment Milestones</span>
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="pt-3 pb-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      Optional — helps clients understand payment timing.
                    </p>
                    <PrimaryButton
                      variant="secondary"
                      onClick={() => addPaymentMilestone()}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </PrimaryButton>
                  </div>

                  {(data.paymentMilestones || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No milestones yet.</p>
                  ) : null}

                  {(data.paymentMilestones || []).map((m, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center rounded-lg border bg-card p-2"
                    >
                      <TextInput
                        className="col-span-7 h-9 text-sm"
                        value={m.label}
                        onChange={(e) =>
                          updatePaymentMilestone(idx, { label: e.target.value })
                        }
                        placeholder="Milestone label"
                      />
                      <div className="col-span-3 flex items-center gap-1">
                        <TextInput
                          className="h-9 text-sm"
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
                        className="col-span-2 text-muted-foreground hover:text-foreground"
                        onClick={() => removePaymentMilestone(idx)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </PrimaryButton>
                    </div>
                  ))}

                  {(() => {
                    const total = (data.paymentMilestones || []).reduce(
                      (s, m) => s + (Number(m.percentage) || 0),
                      0,
                    );
                    const ok = total === 100;
                    return (
                      <div className="flex items-center justify-between text-xs rounded-md px-3 py-2 bg-muted/40 text-foreground">
                        <span className="flex items-center gap-1">
                          <PieChart className="w-3.5 h-3.5" /> Allocation
                        </span>
                        <span className="font-semibold">
                          {total}% {ok ? "✓" : "of 100%"}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <PrimaryButton
                      variant="outline"
                      className="h-10 px-3 text-sm"
                      onClick={() =>
                        setPaymentMilestones([
                          { label: "Upfront on acceptance", percentage: 50 },
                          { label: "After delivery handover", percentage: 30 },
                          { label: "Final approval / clearance", percentage: 20 },
                        ])
                      }
                    >
                      Use 50 / 30 / 20
                    </PrimaryButton>
                    <PrimaryButton
                      variant="outline"
                      className="h-10 px-3 text-sm"
                      onClick={() =>
                        setPaymentMilestones([
                          { label: "Upfront on acceptance", percentage: 40 },
                          { label: "Mid-project review", percentage: 30 },
                          { label: "Final delivery", percentage: 30 },
                        ])
                      }
                    >
                      Use 40 / 30 / 30
                    </PrimaryButton>
                  </div>
                </div>
              </details>

              <details className="group border rounded-xl bg-card px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 [&::-webkit-details-marker]:hidden">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold">Workflow</span>
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="pt-3 pb-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {data.workflow.map((step, idx) => (
                      <SoftBadge key={idx}>
                        <span className="text-[8px] opacity-40 font-mono">
                          {idx + 1}
                        </span>
                        {step}
                        <button
                          onClick={() =>
                            updateWorkflow(data.workflow.filter((_, i) => i !== idx))
                          }
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </SoftBadge>
                    ))}
                  </div>
                  <TextInput
                    placeholder="Add lifecycle step…"
                    className="h-10 text-sm border-dashed"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
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

        {/* Sidebar: Financials */}
        <div className="space-y-6">
          <div className="border overflow-hidden rounded-xl bg-card">
            <div className="bg-muted/20 border-b p-6">
              <div className="text-lg font-semibold flex items-center gap-2">
                <span className="inline-flex w-9 h-9 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
                  <Receipt className="w-4 h-4 text-muted-foreground" />
                </span>
                Cost Projection
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <FieldLabel className="tracking-widest">Base Investment</FieldLabel>
                  <TextInput
                    type="number"
                    value={data.pricing.basePrice === 0 ? "" : String(data.pricing.basePrice)}
                    onChange={(e) =>
                      updatePricing({
                        basePrice: e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                    className="font-semibold text-lg h-11"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Tax (%)</label>
                    <TextInput
                      type="number"
                      value={data.pricing.taxRate === 0 ? "" : String(data.pricing.taxRate)}
                      onChange={(e) =>
                        updatePricing({
                          taxRate: e.target.value === "" ? 0 : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Discount (%)</label>
                    <TextInput
                      type="number"
                      value={data.pricing.discount === 0 ? "" : String(data.pricing.discount)}
                      onChange={(e) =>
                        updatePricing({
                          discount: e.target.value === "" ? 0 : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <hr className="border-border" />

              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal (Net)</span>
                  <span className="font-bold">{formatMoney(computedTotals.subtotal, data.currency)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    Govt. Tax{" "}
                    <span className="inline-flex items-center rounded border bg-muted/30 px-1 text-[10px] leading-4">
                      {data.pricing.taxRate}%
                    </span>
                  </span>
                  <span className="font-bold">+ {formatMoney(computedTotals.taxAmount, data.currency)}</span>
                </div>
                {data.pricing.discount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      Campaign Discount{" "}
                      <span className="inline-flex items-center rounded border bg-muted/30 px-1 text-[10px] leading-4">
                        {data.pricing.discount}%
                      </span>
                    </span>
                    <span className="font-bold">- {formatMoney(((data.pricing.basePrice + data.additionalServices.reduce((acc, s) => acc + s.price, 0)) * data.pricing.discount) / 100, data.currency)}</span>
                  </div>
                )}

                <div className="pt-6 border-t space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Grand Project Total</span>
                  <div className="text-3xl font-bold tracking-tight text-foreground leading-none">
                    {formatMoney(computedTotals.grandTotal, data.currency)}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 px-6 pb-6">
              <PrimaryButton
                onClick={openRecipientPicker}
                disabled={isCreating || isUpdating || isSending}
              >
                <Send className="w-4 h-4 mr-2" /> Dispatch to Client
              </PrimaryButton>
              <PrimaryButton
                variant="outline"
                className="w-full"
                onClick={() => saveQuotation("draft")}
                disabled={isCreating || isUpdating || isSending}
              >
                <Save className="w-4 h-4 mr-2" /> Save Internal Draft
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>

      <QuotationEmailDialog
        open={recipientModalOpen}
        clientId={data.clientId || ""}
        quotationLabel={data.details?.title || "this quotation"}
        extraEmails={data.client?.email ? [data.client.email] : []}
        onClose={() => !isSending && setRecipientModalOpen(false)}
        onSend={confirmDispatch}
        isSending={isSending}
      />
    </div>
  );
}

