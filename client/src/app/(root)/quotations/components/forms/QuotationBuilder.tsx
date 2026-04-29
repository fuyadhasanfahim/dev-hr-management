"use client";

import React, { useMemo, useEffect } from "react";
import { useQuotationStore } from "@/store/useQuotationStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  FileText,
  User,
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
} from "lucide-react";
import { useGetClientsQuery } from "@/redux/features/client/clientApi";
import {
  useCreateQuotationMutation,
  useUpdateQuotationMutation,
} from "@/redux/features/quotation/quotationApi";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { QUOTATION_TEMPLATES } from "@/constants/quotation-templates";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
        <span className="text-primary">{icon}</span>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      </div>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

// ── Main Builder ─────────────────────────────────────────────────────────────

export default function QuotationBuilder() {
  const router = useRouter();
  const {
    data,
    setServiceType,
    updateCompany,
    updateClient,
    updateDetails,
    loadTemplate,
    updateTechStack,
    updateWorkflow,
    updatePricing,
    addPhase,
    updatePhase,
    removePhase,
    addService,
    updateService,
    removeService,
    reset,
  } = useQuotationStore();

  const { data: clientsData, isLoading: clientsLoading } = useGetClientsQuery({});
  const [createQuotation, { isLoading: isCreating }] = useCreateQuotationMutation();
  const [updateQuotation, { isLoading: isUpdating }] = useUpdateQuotationMutation();

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

  const handleSave = async (status: "draft" | "sent") => {
    if (!data.clientId) return toast.error("Please select a client first");
    try {
      const payload = { ...data, status };
      if (data._id) {
        await updateQuotation({ id: data._id, ...payload }).unwrap();
        toast.success("Quotation updated successfully");
      } else {
        await createQuotation(payload).unwrap();
        toast.success("Quotation created successfully");
      }
      if (status === "sent") {
        reset();
        router.push("/quotations");
      }
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to save quotation");
    }
  };

  return (
    <div className="container max-w-7xl py-10 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotation Architect</h1>
          <p className="text-muted-foreground text-sm">Professional solution configuration & cost estimation.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select onValueChange={loadTemplate}>
            <SelectTrigger className="w-[240px] border-primary/20 bg-primary/5">
              <Sparkles className="w-4 h-4 mr-2 text-primary" />
              <SelectValue placeholder="Industry Templates" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(QUOTATION_TEMPLATES).map(key => (
                <SelectItem key={key} value={key}>{key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={reset}>Reset</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Col: Core Config (3 Cols) */}
        <div className="lg:col-span-3 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-4">
                <SectionHeader title="Project & Client" icon={<Building2 className="w-5 h-5" />} />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Proposal Name</Label>
                  <Input value={data.details.title} onChange={e => updateDetails({ title: e.target.value })} placeholder="e.g. Enterprise E-commerce" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Link Client Profile</Label>
                  <Select 
                    value={data.clientId} 
                    onValueChange={(id) => {
                      const client = clientsData?.clients.find(c => c._id === id);
                      if (client) {
                        updateClient({ contactName: client.name, email: client.emails[0], phone: client.phone, companyName: client.name });
                        useQuotationStore.setState(s => ({ data: { ...s.data, clientId: id } }));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={clientsLoading ? "Fetching..." : "Select Client"} />
                    </SelectTrigger>
                    <SelectContent>
                      {clientsData?.clients.map(c => (
                        <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <SectionHeader title="Timeline" icon={<CalendarIcon className="w-5 h-5" />} />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Issuance Date</Label>
                    <Input type="date" value={data.details.date} onChange={e => updateDetails({ date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Valid Until</Label>
                    <Input type="date" value={data.details.validUntil} onChange={e => updateDetails({ validUntil: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Phases Accordion */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <SectionHeader title="Project Phases" icon={<Layers className="w-5 h-5" />} description="Strategic scheduling and milestone tracking." />
              <Button size="sm" variant="secondary" onClick={() => addPhase()}>
                <Plus className="w-4 h-4 mr-1" /> New Phase
              </Button>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="space-y-4">
                {data.phases.map((phase, pIdx) => (
                  <AccordionItem key={pIdx} value={`phase-${pIdx}`} className="border rounded-xl px-4 overflow-hidden">
                    <AccordionTrigger className="hover:no-underline py-4 group">
                      <div className="flex items-center gap-4 text-left w-full">
                        <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">Phase {pIdx + 1}</Badge>
                        <span className="font-semibold text-slate-900 group-hover:text-primary transition-colors">{phase.title || "Define Phase Title"}</span>
                        <div className="ml-auto mr-4 flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                          {phase.startDate ? format(new Date(phase.startDate), "MMM dd") : "TBD"} — {phase.endDate ? format(new Date(phase.endDate), "MMM dd") : "TBD"}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase">Phase Overview</Label>
                            <Input value={phase.title} onChange={e => updatePhase(pIdx, { title: e.target.value })} placeholder="Title" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase">Description</Label>
                            <Textarea value={phase.description} onChange={e => updatePhase(pIdx, { description: e.target.value })} placeholder="Deliverables..." className="min-h-[80px]" />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <Label className="text-xs font-bold text-muted-foreground uppercase">Timeline Selection</Label>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-[10px]">Start Date</Label>
                              <Input type="date" value={phase.startDate || ""} onChange={e => updatePhase(pIdx, { startDate: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px]">End Date</Label>
                              <Input type="date" value={phase.endDate || ""} onChange={e => updatePhase(pIdx, { endDate: e.target.value })} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <Label className="text-xs font-bold text-muted-foreground uppercase">Detailed Checkpoints</Label>
                        <div className="flex flex-wrap gap-2">
                          {phase.items.map((item, iIdx) => (
                            <Badge key={iIdx} variant="secondary" className="pl-3 pr-1 py-1.5 gap-2 rounded-lg bg-slate-100/50">
                              {item}
                              <button onClick={() => updatePhase(pIdx, { items: phase.items.filter((_, i) => i !== iIdx) })} className="hover:text-red-500">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </Badge>
                          ))}
                          <Input 
                            placeholder="+ Add checkpoint (Enter)..." 
                            className="h-9 text-xs border-dashed"
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const val = e.currentTarget.value;
                                if (val) {
                                  updatePhase(pIdx, { items: [...phase.items, val] });
                                  e.currentTarget.value = "";
                                }
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="pt-4 flex justify-end">
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-red-500" onClick={() => removePhase(pIdx)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete Phase
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Tech Stack Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <SectionHeader title="Technical Blueprint" icon={<Cpu className="w-5 h-5" />} />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">Frontend Framework</Label>
                    <Select value={data.techStack.frontend} onValueChange={v => updateTechStack({ frontend: v })}>
                      <SelectTrigger><SelectValue placeholder="Select UI Library" /></SelectTrigger>
                      <SelectContent>
                        {FRONTEND_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">Backend Engine</Label>
                    <Select value={data.techStack.backend} onValueChange={v => updateTechStack({ backend: v })}>
                      <SelectTrigger><SelectValue placeholder="Select Server" /></SelectTrigger>
                      <SelectContent>
                        {BACKEND_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">Database Layer</Label>
                    <Select value={data.techStack.database} onValueChange={v => updateTechStack({ database: v })}>
                      <SelectTrigger><SelectValue placeholder="Select DB" /></SelectTrigger>
                      <SelectContent>
                        {DB_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionHeader title="Tools Checklist" icon={<Settings2 className="w-5 h-5" />} />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                  {PREDEFINED_TOOLS.map(tool => (
                    <div key={tool} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`tool-${tool}`}
                        checked={data.techStack.tools.includes(tool)}
                        onCheckedChange={(checked) => {
                          const newTools = checked 
                            ? [...data.techStack.tools, tool] 
                            : data.techStack.tools.filter(t => t !== tool);
                          updateTechStack({ tools: newTools });
                        }}
                      />
                      <Label htmlFor={`tool-${tool}`} className="text-sm cursor-pointer">{tool}</Label>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">Custom Infrastructure</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Add custom tool..." className="h-9 text-xs" onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = e.currentTarget.value;
                        if (val && !data.techStack.tools.includes(val)) {
                          updateTechStack({ tools: [...data.techStack.tools, val] });
                          e.currentTarget.value = "";
                        }
                      }
                    }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Col: Financials (1 Col) */}
        <div className="space-y-8">
          <Card className="sticky top-10 shadow-lg border-primary/20">
            <CardHeader className="bg-primary/5 rounded-t-xl">
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" /> Cost Projection
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Base Investment</Label>
                  <Input type="number" value={data.pricing.basePrice} onChange={e => updatePricing({ basePrice: Number(e.target.value) })} className="font-bold text-xl h-12" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Tax (%)</Label>
                    <Input type="number" value={data.pricing.taxRate} onChange={e => updatePricing({ taxRate: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Discount (%)</Label>
                    <Input type="number" value={data.pricing.discount} onChange={e => updatePricing({ discount: Number(e.target.value) })} />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal (Net)</span>
                  <span className="font-bold">৳ {computedTotals.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-emerald-600">
                  <span className="flex items-center gap-1">Govt. Tax <Badge variant="outline" className="text-[8px] h-4 px-1">{data.pricing.taxRate}%</Badge></span>
                  <span className="font-bold">+ ৳ {computedTotals.taxAmount.toLocaleString()}</span>
                </div>
                {data.pricing.discount > 0 && (
                  <div className="flex justify-between items-center text-sm text-rose-500">
                    <span className="flex items-center gap-1">Campaign Discount <Badge variant="outline" className="text-[8px] h-4 px-1 text-rose-500 border-rose-200">{data.pricing.discount}%</Badge></span>
                    <span className="font-bold">- Computed</span>
                  </div>
                )}
                
                <div className="pt-6 border-t space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Grand Project Total</span>
                  <div className="text-4xl font-bold tracking-tight text-slate-900 leading-none">
                    ৳ {computedTotals.grandTotal.toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pb-6">
              <Button className="w-full h-12 text-md shadow-xl shadow-primary/10" onClick={() => handleSave("sent")} disabled={isCreating || isUpdating}>
                <Send className="w-4 h-4 mr-2" /> Dispatch to Client
              </Button>
              <Button variant="outline" className="w-full h-11" onClick={() => handleSave("draft")} disabled={isCreating || isUpdating}>
                <Save className="w-4 h-4 mr-2" /> Save Internal Draft
              </Button>
            </CardFooter>
          </Card>

          {/* Workflow Snapshot */}
          <Card>
            <CardHeader className="pb-3">
              <SectionHeader title="Workflow" icon={<Activity className="w-4 h-4" />} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {data.workflow.map((step, idx) => (
                    <Badge key={idx} variant="secondary" className="pl-3 pr-1 py-1 gap-2 rounded-lg bg-slate-100/50">
                      <span className="text-[8px] opacity-40 font-mono">{idx + 1}</span>
                      {step}
                      <button onClick={() => updateWorkflow(data.workflow.filter((_, i) => i !== idx))}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Input placeholder="Add lifecycle step..." className="h-9 text-xs border-dashed" onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const val = e.currentTarget.value;
                    if (val) {
                      updateWorkflow([...data.workflow, val]);
                      e.currentTarget.value = "";
                    }
                  }
                }} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
