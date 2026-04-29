"use client";

import React, { useMemo, useEffect } from "react";
import { useQuotationStore } from "@/store/useQuotationStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  User,
  Building2,
  List,
  Cpu,
  Plus,
  Trash2,
  Sparkles,
  Save,
  Send,
  Receipt,
  Layers,
  Activity,
} from "lucide-react";
import { useGetClientsQuery } from "@/redux/features/client/clientApi";
import {
  useCreateQuotationMutation,
  useUpdateQuotationMutation,
} from "@/redux/features/quotation/quotationApi";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { QUOTATION_TEMPLATES } from "@/constants/quotation-templates";
import { cn } from "@/lib/utils";

// ── Components ───────────────────────────────────────────────────────────────

function FormSection({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden border-slate-200 shadow-sm", className)}>
      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
        <span className="text-slate-400">{icon}</span>
        <h2 className="font-semibold text-slate-900 text-sm uppercase tracking-wider">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </Card>
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
    updateOverview,
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

  // ── Computed Totals ──
  const computedTotals = useMemo(() => {
    const subtotal = data.pricing.basePrice + data.additionalServices.reduce((acc, s) => acc + s.price, 0);
    const discountAmount = data.pricing.discount;
    const netSubtotal = subtotal - discountAmount;
    const taxAmount = (netSubtotal * data.pricing.taxRate) / 100;
    const grandTotal = netSubtotal + taxAmount;

    return {
      subtotal: netSubtotal,
      taxAmount,
      grandTotal,
    };
  }, [data.pricing, data.additionalServices]);

  // Sync totals to store for PDF/Backend
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
    <div className="flex flex-col h-full bg-slate-50/30 overflow-hidden">
      {/* Top Bar / Controls */}
      <div className="p-6 pb-0 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between gap-4 border-slate-200">
          <div>
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service Type</Label>
            <Select value={data.serviceType} onValueChange={(v: any) => setServiceType(v)}>
              <SelectTrigger className="border-none p-0 h-auto shadow-none focus:ring-0 font-bold text-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="web-development">Web Development</SelectItem>
                <SelectItem value="product-photography">Photography</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between gap-4 border-slate-200">
          <div className="w-full">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Link Client</Label>
            <Select 
              value={data.clientId} 
              onValueChange={(id) => {
                const client = clientsData?.clients.find(c => c._id === id);
                if (client) {
                  updateClient({ 
                    contactName: client.name, 
                    email: client.emails[0], 
                    phone: client.phone,
                    companyName: client.name
                  });
                  useQuotationStore.setState(s => ({ data: { ...s.data, clientId: id } }));
                }
              }}
            >
              <SelectTrigger className="border-none p-0 h-auto shadow-none focus:ring-0 font-bold text-lg">
                <SelectValue placeholder={clientsLoading ? "Loading..." : "Select Client"} />
              </SelectTrigger>
              <SelectContent>
                {clientsData?.clients.map(c => (
                  <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between gap-4 border-teal-100 bg-teal-50/30">
          <div className="w-full">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3 h-3 text-teal-600" />
              <Label className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">Magic Templates</Label>
            </div>
            <Select onValueChange={loadTemplate}>
              <SelectTrigger className="border-none p-0 h-auto shadow-none focus:ring-0 font-bold text-lg text-teal-700">
                <SelectValue placeholder="Choose Template" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(QUOTATION_TEMPLATES).map(key => (
                  <SelectItem key={key} value={key}>{key.replace('-', ' ').toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>
      </div>

      {/* Main Form Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Basic Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FormSection title="Client & Document" icon={<FileText className="w-4 h-4" />}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Proposal Title</Label>
                  <Input value={data.details.title} onChange={e => updateDetails({ title: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Quotation #</Label>
                  <Input value={data.quotationNumber || "Auto-generated"} disabled className="bg-slate-50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Date</Label>
                  <Input type="date" value={data.details.date} onChange={e => updateDetails({ date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Valid Until</Label>
                  <Input type="date" value={data.details.validUntil} onChange={e => updateDetails({ validUntil: e.target.value })} />
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection title="Contact Person" icon={<User className="w-4 h-4" />}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Name</Label>
                  <Input value={data.client.contactName} onChange={e => updateClient({ contactName: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Email</Label>
                  <Input value={data.client.email} onChange={e => updateClient({ email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Address</Label>
                <Input value={data.client.address} onChange={e => updateClient({ address: e.target.value })} />
              </div>
            </div>
          </FormSection>
        </div>

        {/* Dynamic Phase Builder */}
        <FormSection title="Project Phases & Milestones" icon={<Layers className="w-4 h-4" />}>
          <div className="space-y-4">
            {data.phases.map((phase, pIdx) => (
              <div key={pIdx} className="p-4 border rounded-xl bg-white space-y-4 relative group">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
                  onClick={() => removePhase(pIdx)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase">Phase Title</Label>
                    <Input 
                      value={phase.title} 
                      onChange={e => updatePhase(pIdx, { title: e.target.value })}
                      className="font-bold border-none p-0 h-auto focus-visible:ring-0 text-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase">Short Description</Label>
                    <Input 
                      value={phase.description} 
                      onChange={e => updatePhase(pIdx, { description: e.target.value })}
                      className="text-sm text-slate-500 border-none p-0 h-auto focus-visible:ring-0"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase">Phase Checklist</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {phase.items.map((item, iIdx) => (
                      <div key={iIdx} className="flex items-center gap-2 group/item">
                        <Checkbox 
                          checked={true} 
                          onCheckedChange={() => {
                            const newItems = phase.items.filter((_, i) => i !== iIdx);
                            updatePhase(pIdx, { items: newItems });
                          }}
                        />
                        <span className="text-sm text-slate-600 truncate">{item}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Input 
                        placeholder="Add item..." 
                        className="h-8 text-xs border-dashed"
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
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full border-dashed py-6" onClick={() => addPhase()}>
              <Plus className="w-4 h-4 mr-2" /> Add New Phase
            </Button>
          </div>
        </FormSection>

        {/* Tech Stack & Workflow */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FormSection title="Tech Stack" icon={<Cpu className="w-4 h-4" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Frontend</Label>
                <Input value={data.techStack.frontend} onChange={e => updateTechStack({ frontend: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Backend</Label>
                <Input value={data.techStack.backend} onChange={e => updateTechStack({ backend: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Database</Label>
                <Input value={data.techStack.database} onChange={e => updateTechStack({ database: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Additional Tools (Comma separated)</Label>
              <Input 
                value={data.techStack.tools.join(", ")} 
                onChange={e => updateTechStack({ tools: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })} 
              />
            </div>
          </FormSection>

          <FormSection title="Project Workflow" icon={<Activity className="w-4 h-4" />}>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {data.workflow.map((step, idx) => (
                  <Badge key={idx} variant="secondary" className="pl-3 pr-1 py-1 gap-1">
                    {step}
                    <Button variant="ghost" size="icon" className="h-4 w-4 rounded-full p-0" onClick={() => updateWorkflow(data.workflow.filter((_, i) => i !== idx))}>
                      <Trash2 className="w-2.5 h-2.5" />
                    </Button>
                  </Badge>
                ))}
              </div>
              <Input 
                placeholder="Add workflow step (Enter)..." 
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const val = e.currentTarget.value;
                    if (val) {
                      updateWorkflow([...data.workflow, val]);
                      e.currentTarget.value = "";
                    }
                  }
                }}
              />
            </div>
          </FormSection>
        </div>

        {/* Additional Services */}
        <FormSection title="Additional Services" icon={<Plus className="w-4 h-4" />}>
          <div className="space-y-3">
            {data.additionalServices.map((service, idx) => (
              <div key={idx} className="flex items-start gap-4 p-3 border rounded-lg bg-white relative group">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase">Title</Label>
                    <Input value={service.title} onChange={e => updateService(idx, { title: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase">Price</Label>
                    <Input type="number" value={service.price} onChange={e => updateService(idx, { price: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase">Cycle</Label>
                    <Select value={service.billingCycle} onValueChange={(v: any) => updateService(idx, { billingCycle: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one-time">One-time</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="mt-6 text-slate-400 hover:text-red-500" onClick={() => removeService(idx)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" className="w-full text-xs" onClick={() => addService()}>
              Add Extra Service
            </Button>
          </div>
        </FormSection>

        {/* Pricing Section */}
        <FormSection title="Pricing & Calculations" icon={<Receipt className="w-4 h-4" />} className="border-teal-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Base Price</Label>
                  <Input type="number" value={data.pricing.basePrice} onChange={e => updatePricing({ basePrice: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Tax Rate %</Label>
                  <Input type="number" value={data.pricing.taxRate} onChange={e => updatePricing({ taxRate: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Discount</Label>
                  <Input type="number" value={data.pricing.discount} onChange={e => updatePricing({ discount: Number(e.target.value) })} />
                </div>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-2xl space-y-4 shadow-xl">
              <div className="flex justify-between text-sm opacity-60 font-medium">
                <span>Subtotal (Net)</span>
                <span>৳ {computedTotals.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm opacity-60 font-medium">
                <span>Tax Amount ({data.pricing.taxRate}%)</span>
                <span>৳ {computedTotals.taxAmount.toLocaleString()}</span>
              </div>
              <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                <div>
                  <div className="text-[10px] font-bold text-teal-400 uppercase tracking-widest mb-1">Grand Total</div>
                  <div className="text-4xl font-bold tracking-tighter">৳ {computedTotals.grandTotal.toLocaleString()}</div>
                </div>
                <Badge className="bg-teal-500 text-white border-none px-3 py-1">Payable in 3 Phases</Badge>
              </div>
            </div>
          </div>
        </FormSection>

      </div>

      {/* Action Footer */}
      <div className="p-6 bg-white border-t border-slate-200 flex justify-between items-center shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
        <Button variant="ghost" onClick={reset} className="text-slate-500">Reset Builder</Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => handleSave("draft")} disabled={isCreating || isUpdating} className="gap-2">
            <Save className="w-4 h-4" /> Save Draft
          </Button>
          <Button onClick={() => handleSave("sent")} disabled={isCreating || isUpdating} className="gap-2 bg-slate-900 hover:bg-slate-800 text-white px-8">
            <Send className="w-4 h-4" /> Send to Client
          </Button>
        </div>
      </div>
    </div>
  );
}
