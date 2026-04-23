"use client";

import React, { useMemo, useEffect } from "react";
import { useQuotationStore } from "@/store/useQuotationStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  StickyNote,
  List,
  Cpu,
  Monitor,
  Briefcase,
  Plus,
  Trash2,
  Sparkles,
  Camera,
  Save,
  Send,
  Loader2,
} from "lucide-react";
import PDFDownloadBtn from "@/components/quotation/pdf/PDFDownloadBtn";
import { useGetClientsQuery } from "@/redux/features/client/clientApi";
import {
  useCreateQuotationMutation,
  useUpdateQuotationMutation,
} from "@/redux/features/quotation/quotationApi";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const PREDEFINED_WEB_PHASES = [
  {
    id: "phase-1",
    title: "UI/UX Design Phase",
    items: [
      "Full UI design shared for review.",
      "Feedback and revisions finalized in this phase.",
      "Upon approval, development begins.",
    ],
  },
  {
    id: "phase-2",
    title: "Frontend Development Phase",
    items: [
      "Homepage with banners & featured sections",
      "Product listing with categories & filters",
      "Product details page",
      "Search functionality",
      "Shopping cart system",
      "Checkout process",
      "User login & registration",
      "Order tracking interface",
      "Offers & discount display",
      "Contact & support pages",
      "Newsletter subscription",
      "Mobile responsive design",
    ],
  },
  {
    id: "phase-3",
    title: "Admin Dashboard & Backend Phase",
    items: [
      "Admin dashboard overview",
      "User & role management",
      "Product & category management",
      "Inventory management",
      "Order management & status tracking",
      "Customer management",
      "Shopping cart monitoring",
      "Payment management",
      "Coupon & discount management",
      "Review & rating management",
      "Marketing tools & campaign management",
      "Analytics & sales reports",
      "Courier integration & parcel booking",
      "Shipment tracking from courier",
      "Fraud detection & order validation",
      "CMS & content management",
      "Contact & support management",
      "System settings & configuration",
    ],
  },
  {
    id: "phase-4",
    title: "Marketing & SEO Phase",
    items: [
      "Facebook Pixel integration",
      "Google Analytics (GA4) setup",
      "Conversion tracking ready structure",
      "Custom data layer implementation",
      "Google Tag Manager (GTM) integration",
      "Event tracking (add to cart, purchase, etc.)",
      "Ecommerce tracking setup",
      "Page speed & performance optimization",
      "Search engine indexing setup (Google Search Console)",
    ],
  },
];

function FormSection({
  id,
  title,
  icon,
  badge,
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      id={`section-${id}`}
      className="overflow-hidden border-slate-200 shadow-sm"
    >
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <span className="text-slate-500">{icon}</span>
          <h2 className="font-semibold text-slate-900">{title}</h2>
        </div>
        {badge && (
          <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            {badge}
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

export default function QuotationBuilder() {
  const router = useRouter();
  const {
    data,
    setServiceType,
    updateCompany,
    updateClient,
    updateDetails,
    loadTemplate,
    updateSettings,
    updateOverview,
    updateTechStack,
    updateWorkflow,
    updateFinalNote,
    updatePricing,
    addScopePhase,
    updateScopePhase,
    removeScopePhase,
    addOptionalService,
    updateOptionalService,
    removeOptionalService,
    addPhotographyItem,
    updatePhotographyItem,
    removePhotographyItem,
    reset,
  } = useQuotationStore();

  const { data: clientsData, isLoading: clientsLoading } = useGetClientsQuery(
    {},
  );
  const [createQuotation, { isLoading: isCreating }] =
    useCreateQuotationMutation();
  const [updateQuotation, { isLoading: isUpdating }] =
    useUpdateQuotationMutation();

  const handleListChange = (val: string, updater: (arr: string[]) => void) => {
    updater(val.split("\n").filter(Boolean));
  };

  const totalAmounts = useMemo(() => {
    const packagePrice =
      data.serviceType === "web-development"
        ? data.pricing.totalCost
        : data.photographyItems.reduce(
            (acc, item) => acc + item.quantity * item.price,
            0,
          );

    const additionalTotal =
      data.serviceType === "web-development"
        ? data.optionalServices.reduce((acc, srv) => acc + srv.price, 0)
        : 0;

    const subtotal = packagePrice + additionalTotal - data.settings.discount;
    const taxAmount = (subtotal * data.settings.taxRate) / 100;
    const grandTotal = subtotal + taxAmount;

    return {
      packagePrice,
      additionalTotal,
      taxAmount,
      grandTotal,
    };
  }, [data]);

  // Sync totals to store for PDF generation without causing infinite loop
  useEffect(() => {
    if (
      data.totals.packagePrice !== totalAmounts.packagePrice ||
      data.totals.additionalTotal !== totalAmounts.additionalTotal ||
      data.totals.taxAmount !== totalAmounts.taxAmount ||
      data.totals.grandTotal !== totalAmounts.grandTotal
    ) {
      useQuotationStore.setState((state) => ({
        data: {
          ...state.data,
          totals: totalAmounts,
        },
      }));
    }
  }, [totalAmounts, data.totals]);

  const handleClientSelect = (clientId: string) => {
    const client = clientsData?.clients.find((c) => c._id === clientId);
    if (client) {
      updateClient({
        contactName: client.name,
        companyName: client.name, // Usually company name for B2B
        address: client.address || "",
        email: client.emails[0] || "",
        phone: client.phone || "",
      });
      useQuotationStore.setState((state) => ({
        data: {
          ...state.data,
          clientId: clientId,
        },
      }));
    }
  };

  const handleSave = async (status: "draft" | "sent") => {
    try {
      if (!data.clientId) {
        toast.error("Please select a client first");
        return;
      }

      const payload = { ...data, status };

      let result;
      if (data._id) {
        result = await updateQuotation({ id: data._id, ...payload }).unwrap();
        toast.success(
          `Quotation ${status === "draft" ? "draft saved" : "sent"} successfully`,
        );
      } else {
        result = await createQuotation(payload).unwrap();
        toast.success(
          `Quotation ${status === "draft" ? "draft created" : "sent"} successfully`,
        );
      }

      if (status === "sent") {
        reset();
        router.push("/quotations");
      } else if (result._id && !data._id) {
        useQuotationStore.setState((state) => ({
          data: {
            ...state.data,
            _id: result._id,
          },
        }));
      }
    } catch (error) {
      toast.error((error as Error).message || "Failed to save quotation");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50/30">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* ── Mode, Template & Client Selection ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-5 border-slate-200 shadow-sm flex items-center justify-between gap-4">
            <div className="shrink-0">
              <h3 className="font-bold text-slate-900">Service Type</h3>
              <p className="text-xs text-slate-500">Choose format</p>
            </div>
            <Select
              value={data.serviceType}
              onValueChange={(val) =>
                setServiceType(val as "web-development" | "product-photography")
              }
            >
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="web-development">
                  Web Design & Dev
                </SelectItem>
                <SelectItem value="product-photography">Photography</SelectItem>
              </SelectContent>
            </Select>
          </Card>

          <Card className="p-5 border-slate-200 shadow-sm flex items-center justify-between gap-4">
            <div className="shrink-0">
              <h3 className="font-bold text-slate-900">Select Client</h3>
              <p className="text-xs text-slate-500">Link to profile</p>
            </div>
            <Select value={data.clientId} onValueChange={handleClientSelect}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue
                  placeholder={clientsLoading ? "Loading..." : "Choose client"}
                />
              </SelectTrigger>
              <SelectContent>
                {clientsData?.clients.map((client) => (
                  <SelectItem key={client._id} value={client._id}>
                    {client.name} ({client.clientId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          <Card className="p-5 border-teal-100 bg-teal-50/20 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Templates</h3>
                <p className="text-xs text-slate-500">Auto-fill content</p>
              </div>
            </div>
            {data.serviceType === "web-development" ? (
              <Select
                onValueChange={(val) =>
                  loadTemplate(val as "ecommerce" | "saas" | "service")
                }
              >
                <SelectTrigger className="w-full bg-white border-teal-200 text-teal-700 font-medium">
                  <SelectValue placeholder="Choose template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ecommerce">E-Commerce</SelectItem>
                  <SelectItem value="saas">SaaS App</SelectItem>
                  <SelectItem value="service">Agency Site</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="text-xs text-slate-400 italic">
                No templates for photography
              </div>
            )}
          </Card>
        </div>

        {/* ── Document Details ── */}
        <FormSection
          id="details"
          title="Document Details"
          icon={<FileText className="w-5 h-5" />}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                Proposal Title
              </Label>
              <Input
                value={data.details.title || ""}
                onChange={(e) => updateDetails({ title: e.target.value })}
                className="bg-white border-slate-200 focus:border-teal-500 focus:ring-teal-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                  Quotation #
                </Label>
                <Input
                  value={data.details.quotationNumber || ""}
                  onChange={(e) =>
                    updateDetails({ quotationNumber: e.target.value })
                  }
                  className="bg-white"
                  disabled
                  placeholder="Generated on save"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                  Date
                </Label>
                <Input
                  type="date"
                  value={data.details.date || ""}
                  onChange={(e) => updateDetails({ date: e.target.value })}
                  className="bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                  Valid Until
                </Label>
                <Input
                  type="date"
                  value={data.details.validUntil || ""}
                  onChange={(e) =>
                    updateDetails({ validUntil: e.target.value })
                  }
                  className="bg-white"
                />
              </div>
            </div>
          </div>
        </FormSection>

        {/* ── Client & Company ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FormSection
            id="client"
            title="Client Information"
            icon={<User className="w-5 h-5" />}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                    Contact Name
                  </Label>
                  <Input
                    value={data.client.contactName || ""}
                    onChange={(e) =>
                      updateClient({ contactName: e.target.value })
                    }
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                    Company
                  </Label>
                  <Input
                    value={data.client.companyName || ""}
                    onChange={(e) =>
                      updateClient({ companyName: e.target.value })
                    }
                    className="bg-white"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                  Address
                </Label>
                <Textarea
                  value={data.client.address || ""}
                  onChange={(e) => updateClient({ address: e.target.value })}
                  rows={2}
                  className="bg-white resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                    Email
                  </Label>
                  <Input
                    type="email"
                    value={data.client.email || ""}
                    onChange={(e) => updateClient({ email: e.target.value })}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                    Phone
                  </Label>
                  <Input
                    value={data.client.phone || ""}
                    onChange={(e) => updateClient({ phone: e.target.value })}
                    className="bg-white"
                  />
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection
            id="company"
            title="Company Details"
            icon={<Building2 className="w-5 h-5" />}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                    Name
                  </Label>
                  <Input
                    value={data.company.name || ""}
                    onChange={(e) => updateCompany({ name: e.target.value })}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                    Website
                  </Label>
                  <Input
                    value={data.company.website || ""}
                    onChange={(e) => updateCompany({ website: e.target.value })}
                    className="bg-white"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                  Address
                </Label>
                <Textarea
                  value={data.company.address || ""}
                  onChange={(e) => updateCompany({ address: e.target.value })}
                  rows={2}
                  className="bg-white resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                    Email
                  </Label>
                  <Input
                    type="email"
                    value={data.company.email || ""}
                    onChange={(e) => updateCompany({ email: e.target.value })}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                    Phone
                  </Label>
                  <Input
                    value={data.company.phone || ""}
                    onChange={(e) => updateCompany({ phone: e.target.value })}
                    className="bg-white"
                  />
                </div>
              </div>
            </div>
          </FormSection>
        </div>

        {/* ── Pricing & Settings ── */}
        <Card className="p-6 border-slate-200 shadow-sm bg-white">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                Currency
              </Label>
              <Select
                value={data.settings.currency}
                onValueChange={(val) =>
                  updateSettings({ currency: val as "$" | "৳" | "€" | "£" })
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="৳">BDT (৳)</SelectItem>
                  <SelectItem value="$">USD ($)</SelectItem>
                  <SelectItem value="€">EUR (€)</SelectItem>
                  <SelectItem value="£">GBP (£)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {data.serviceType === "web-development" && (
              <div className="space-y-1.5 md:col-span-1">
                <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                  Base Cost
                </Label>
                <Input
                  type="number"
                  value={data.pricing.totalCost ?? 0}
                  onChange={(e) =>
                    updatePricing({ totalCost: Number(e.target.value) })
                  }
                  className="bg-white font-bold text-slate-900"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                Tax Rate (%)
              </Label>
              <Input
                type="number"
                value={data.settings.taxRate ?? 0}
                onChange={(e) =>
                  updateSettings({ taxRate: Number(e.target.value) })
                }
                className="bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                Discount ({data.settings.currency})
              </Label>
              <Input
                type="number"
                value={data.settings.discount ?? 0}
                onChange={(e) =>
                  updateSettings({ discount: Number(e.target.value) })
                }
                className="bg-white"
              />
            </div>
          </div>
        </Card>

        {/* ── Content Modules ── */}
        <FormSection
          id="overview"
          title="Project Overview"
          icon={<Monitor className="w-5 h-5" />}
        >
          <Textarea
            value={data.overview || ""}
            onChange={(e) => updateOverview(e.target.value)}
            rows={4}
            className="bg-white resize-none text-slate-700 leading-relaxed"
            placeholder="High-level description of the project goals..."
          />
        </FormSection>

        {data.serviceType === "web-development" ? (
          <>
            <FormSection
              id="scope"
              title="Scope of Work"
              icon={<Briefcase className="w-5 h-5" />}
              badge="Phases"
            >
              <div className="space-y-6">
                {/* Predefined phases */}
                {PREDEFINED_WEB_PHASES.map((phase, idx) => {
                  const activePhase = data.scopeOfWork.find(
                    (p) => p.title === phase.title,
                  );
                  const isPhaseActive = !!activePhase;

                  return (
                    <div
                      key={phase.id}
                      className={`p-4 rounded-xl border transition-all ${isPhaseActive ? "border-teal-200 bg-teal-50/20" : "border-slate-100 bg-slate-50/50 grayscale opacity-70"}`}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <input
                          type="checkbox"
                          checked={isPhaseActive}
                          onChange={(e) => {
                            if (e.target.checked) {
                              useQuotationStore.setState((state) => ({
                                data: {
                                  ...state.data,
                                  scopeOfWork: [
                                    ...state.data.scopeOfWork,
                                    {
                                      id: Math.random()
                                        .toString(36)
                                        .substr(2, 9),
                                      title: phase.title,
                                      description: "",
                                      items: [...phase.items],
                                    },
                                  ],
                                },
                              }));
                            } else if (activePhase) {
                              removeScopePhase(activePhase.id);
                            }
                          }}
                          className="w-5 h-5 rounded border-slate-300 accent-teal-600 cursor-pointer"
                        />
                        <h4 className="font-bold text-slate-900">
                          Phase {idx + 1}: {phase.title}
                        </h4>
                      </div>

                      {isPhaseActive && (
                        <div className="ml-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                          {phase.items.map((item, i) => {
                            const isItemActive =
                              activePhase.items.includes(item);
                            return (
                              <div key={i} className="flex items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isItemActive}
                                  onChange={(e) => {
                                    const newItems = e.target.checked
                                      ? [...activePhase.items, item]
                                      : activePhase.items.filter(
                                          (x) => x !== item,
                                        );
                                    updateScopePhase(activePhase.id, {
                                      items: newItems,
                                    });
                                  }}
                                  className="w-4 h-4 mt-0.5 rounded border-slate-300 accent-teal-600 cursor-pointer"
                                />
                                <span className="text-sm text-slate-600 leading-tight">
                                  {item}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Custom Phases */}
                {data.scopeOfWork
                  .filter(
                    (p) =>
                      !PREDEFINED_WEB_PHASES.some(
                        (pref) => pref.title === p.title,
                      ),
                  )
                  .map((phase) => (
                    <div
                      key={phase.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white relative"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
                        onClick={() => removeScopePhase(phase.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <div className="space-y-4">
                        <div className="pr-10">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                            Phase Title
                          </Label>
                          <Input
                            value={phase.title}
                            onChange={(e) =>
                              updateScopePhase(phase.id, {
                                title: e.target.value,
                              })
                            }
                            className="font-bold h-9"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                            Milestones (One per line)
                          </Label>
                          <Textarea
                            value={phase.items.join("\n")}
                            onChange={(e) =>
                              updateScopePhase(phase.id, {
                                items: e.target.value
                                  .split("\n")
                                  .filter(Boolean),
                              })
                            }
                            rows={3}
                            className="text-sm resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                <Button
                  variant="outline"
                  onClick={addScopePhase}
                  className="w-full border-dashed border-slate-300 py-6 hover:bg-slate-50 group"
                >
                  <Plus className="w-4 h-4 mr-2 text-slate-400 group-hover:text-teal-600" />
                  Add Custom Phase
                </Button>
              </div>
            </FormSection>

            <FormSection
              id="tech"
              title="Technology Stack"
              icon={<Cpu className="w-5 h-5" />}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500">
                    Frontend
                  </Label>
                  <Input
                    value={data.techStack.frontend.join(", ")}
                    onChange={(e) =>
                      updateTechStack({
                        frontend: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Next.js, React..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500">
                    Backend
                  </Label>
                  <Input
                    value={data.techStack.backend.join(", ")}
                    onChange={(e) =>
                      updateTechStack({
                        backend: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Node.js, Go..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500">
                    Database
                  </Label>
                  <Input
                    value={data.techStack.database?.join(", ")}
                    onChange={(e) =>
                      updateTechStack({
                        database: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="PostgreSQL, Redis..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500">
                    Tools
                  </Label>
                  <Input
                    value={data.techStack.tools.join(", ")}
                    onChange={(e) =>
                      updateTechStack({
                        tools: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Figma, Docker..."
                  />
                </div>
              </div>
            </FormSection>

            <FormSection
              id="additional"
              title="Additional Services"
              icon={<Plus className="w-5 h-5" />}
            >
              <div className="space-y-4">
                {data.optionalServices.map((srv) => (
                  <div
                    key={srv.id}
                    className="p-4 border border-slate-200 rounded-xl relative bg-white shadow-sm"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
                      onClick={() => removeOptionalService(srv.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-12 md:col-span-6 pr-8 space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500">
                          Service Title
                        </Label>
                        <Input
                          value={srv.title}
                          onChange={(e) =>
                            updateOptionalService(srv.id, {
                              title: e.target.value,
                            })
                          }
                          className="font-bold"
                        />
                      </div>
                      <div className="col-span-6 md:col-span-3 space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500">
                          Price
                        </Label>
                        <Input
                          type="number"
                          value={srv.price}
                          onChange={(e) =>
                            updateOptionalService(srv.id, {
                              price: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="col-span-6 md:col-span-3 space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500">
                          Billing
                        </Label>
                        <Select
                          value={srv.type}
                          onValueChange={(val) =>
                            updateOptionalService(srv.id, {
                              type: val as "recurring" | "one-time",
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="one-time">One-time</SelectItem>
                            <SelectItem value="recurring">Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-12 space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500">
                          Short Description
                        </Label>
                        <Input
                          value={srv.description}
                          onChange={(e) =>
                            updateOptionalService(srv.id, {
                              description: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={addOptionalService}
                  className="w-full border-dashed"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Service Line
                </Button>
              </div>
            </FormSection>
          </>
        ) : (
          <FormSection
            id="photography"
            title="Photography Packages"
            icon={<Camera className="w-5 h-5" />}
          >
            <div className="space-y-4">
              {data.photographyItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 border border-slate-200 rounded-xl relative bg-white shadow-sm"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
                    onClick={() => removePhotographyItem(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <div className="grid grid-cols-12 gap-4 pr-8">
                    <div className="col-span-12 md:col-span-6 space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
                        Item / Category
                      </Label>
                      <Input
                        value={item.title}
                        onChange={(e) =>
                          updatePhotographyItem(item.id, {
                            title: e.target.value,
                          })
                        }
                        placeholder="e.g. Model Shoot"
                      />
                    </div>
                    <div className="col-span-12 md:col-span-6 space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
                        Deliverables
                      </Label>
                      <Input
                        value={item.outputString}
                        onChange={(e) =>
                          updatePhotographyItem(item.id, {
                            outputString: e.target.value,
                          })
                        }
                        placeholder="e.g. 10 Retouched Images"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-3 space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
                        Quantity
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updatePhotographyItem(item.id, {
                            quantity: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="col-span-6 md:col-span-3 space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
                        Rate
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={item.price}
                        onChange={(e) =>
                          updatePhotographyItem(item.id, {
                            price: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="col-span-12 md:col-span-6 flex items-end">
                      <div className="h-10 w-full flex items-center justify-end px-4 bg-slate-50 border border-slate-200 rounded-md font-bold text-slate-700">
                        Subtotal: {data.settings.currency}
                        {(item.quantity * item.price).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Button
                onClick={addPhotographyItem}
                variant="outline"
                className="w-full border-dashed"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Photography Package
              </Button>
            </div>
          </FormSection>
        )}

        {/* ── Workflow & Notes ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FormSection
            id="workflow"
            title="Workflow Summary"
            icon={<List className="w-5 h-5" />}
          >
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
              Process Steps (One per line)
            </Label>
            <Textarea
              value={data.workflow.join("\n")}
              onChange={(e) => handleListChange(e.target.value, updateWorkflow)}
              rows={6}
              className="bg-white resize-none text-sm"
            />
          </FormSection>
          <FormSection
            id="notes"
            title="Final Note"
            icon={<StickyNote className="w-5 h-5" />}
          >
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
              Closing Remarks
            </Label>
            <Textarea
              value={data.finalNote}
              onChange={(e) => updateFinalNote(e.target.value)}
              rows={6}
              className="bg-white resize-none text-sm"
            />
          </FormSection>
        </div>

        {/* Padding for sticky footer */}
        <div className="h-20" />
      </div>

      {/* ── Sticky Footer ── */}
      <div className="p-4 border-t border-slate-200 bg-white shrink-0 flex items-center justify-between shadow-[0_-4px_12px_rgba(0,0,0,0.03)] z-10">
        <div className="flex items-center gap-6 pl-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Estimated Total
            </span>
            <span className="text-xl font-black text-teal-600">
              {data.settings.currency}
              {totalAmounts.grandTotal.toLocaleString()}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-3 text-xs text-slate-500 border-l border-slate-100 pl-6">
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Base:{" "}
              {data.settings.currency}
              {totalAmounts.packagePrice.toLocaleString()}
            </span>
            {totalAmounts.additionalTotal > 0 && (
              <span className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />{" "}
                Extras: {data.settings.currency}
                {totalAmounts.additionalTotal.toLocaleString()}
              </span>
            )}
            {data.settings.taxRate > 0 && (
              <span className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Tax:{" "}
                {totalAmounts.taxAmount.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="text-slate-600 border-slate-200"
            disabled={isCreating || isUpdating}
            onClick={() => handleSave("draft")}
          >
            {isCreating || isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Draft
          </Button>
          <Button
            className="bg-slate-900 hover:bg-slate-800 text-white"
            disabled={isCreating || isUpdating}
            onClick={() => handleSave("sent")}
          >
            {isCreating || isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Submit Proposal
          </Button>
          <PDFDownloadBtn data={data} totalAmounts={totalAmounts} />
        </div>
      </div>
    </div>
  );
}
