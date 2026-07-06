"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Sparkles,
  ClipboardPaste,
  Plus,
  Trash2,
  XCircle,
  ClipboardList,
  Copy,
  RotateCcw,
  Save,
  Layers,
  Building2,
  Check,
  Code,
  TrendingUp,
  Video,
  Camera,
} from "lucide-react";
import { PremiumCard } from "@/components/ui/shared/PremiumCard";
import { PremiumButton } from "@/components/ui/shared/PremiumButton";
import { PremiumInput } from "@/components/ui/shared/PremiumInput";
import { PremiumTextarea } from "@/components/ui/shared/PremiumTextarea";
import { PremiumBadge } from "@/components/ui/shared/PremiumBadge";
import { IQuotationPhase, QuotationCategory } from "@/types/quotation.type";

type ServiceCategoryKey = "web-dev" | "marketing" | "video-editing" | "photo-editing";

interface ServiceCategory {
  id: ServiceCategoryKey;
  label: string;
  badgeText: string;
  color: string;
  borderColor: string;
  bgColor: string;
  iconChar: string;
  iconBg: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: "web-dev",
    label: "Web Design & Development",
    badgeText: "Web Dev",
    color: "text-[#4E12D4] dark:text-[#C850FA]",
    borderColor: "border-[#4E12D4]/40 hover:border-[#4E12D4]",
    bgColor: "bg-[#4E12D4]/10 dark:bg-[#4E12D4]/20",
    iconChar: "⚡",
    iconBg: "bg-gradient-to-br from-[#4E12D4] to-[#1E0078] text-white shadow-md shadow-[#4E12D4]/30 border border-white/20",
    icon: Code,
  },
  {
    id: "marketing",
    label: "Digital Marketing & SEO",
    badgeText: "Marketing",
    color: "text-[#C850FA] dark:text-purple-300",
    borderColor: "border-[#C850FA]/40 hover:border-[#C850FA]",
    bgColor: "bg-[#C850FA]/10 dark:bg-[#C850FA]/20",
    iconChar: "📈",
    iconBg: "bg-gradient-to-br from-[#C850FA] to-[#4E12D4] text-white shadow-md shadow-[#C850FA]/30 border border-white/20",
    icon: TrendingUp,
  },
  {
    id: "video-editing",
    label: "Video & Motion Graphics",
    badgeText: "Video Editing",
    color: "text-[#1E0078] dark:text-indigo-300",
    borderColor: "border-[#1E0078]/40 hover:border-[#1E0078]",
    bgColor: "bg-[#1E0078]/10 dark:bg-[#1E0078]/20",
    iconChar: "🎬",
    iconBg: "bg-gradient-to-br from-[#1E0078] to-[#4E12D4] text-white shadow-md shadow-[#1E0078]/30 border border-white/20",
    icon: Video,
  },
  {
    id: "photo-editing",
    label: "Photo Editing & Retouching",
    badgeText: "Photo Editing",
    color: "text-[#4E12D4] dark:text-blue-400",
    borderColor: "border-blue-500/40 hover:border-blue-500",
    bgColor: "bg-blue-500/10 dark:bg-blue-500/20",
    iconChar: "📸",
    iconBg: "bg-gradient-to-br from-blue-600 to-[#1E0078] text-white shadow-md shadow-blue-500/30 border border-white/20",
    icon: Camera,
  },
];

export interface TemplateData {
  name: string;
  category: QuotationCategory;
  overview: string;
  developmentScope?: string[];
  notIncluded?: string[];
  clientRequirements?: string[];
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
  additionalServices: any[];
  workflow: string[];
  paymentMilestones: any[];
}

export default function TemplateBuilder({
  data,
  onChange,
  onSave,
  isSaving,
  pageTitle = "Template Builder",
}: {
  data: TemplateData;
  onChange: (data: TemplateData) => void;
  onSave: () => void;
  isSaving: boolean;
  pageTitle?: string;
}) {
  // Active Services State (Default: Web Dev selected)
  const [activeServices, setActiveServices] = useState<ServiceCategoryKey[]>(["web-dev"]);

  // Scopes partitioned by Service Category
  const [categoryScopes, setCategoryScopes] = useState<Record<ServiceCategoryKey, string[]>>({
    "web-dev": [
      "Modern, clean, and responsive e-commerce website design & UX architecture",
      "Figma high-fidelity interactive wireframes & UI prototype screens",
      "Fast-loading structure optimized for core web vitals",
      "Mobile, tablet, and desktop responsive layout screens",
      "Product listing & details page with category filtering",
      "Cart and checkout flow with SSL payment gateway integration",
      "Admin dashboard setup for order & inventory management",
    ],
    "marketing": [
      "Comprehensive On-Page & Technical SEO audit and setup",
      "Google Analytics 4 & Meta Pixel e-commerce conversion tracking",
      "Social media ad campaign setup for Facebook and Instagram",
    ],
    "video-editing": [
      "Promotional video editing (up to 60 seconds widescreen & vertical reel)",
      "Professional color grading and cinematic sound design",
      "Custom motion graphics intro logo & lower thirds",
    ],
    "photo-editing": [
      "High-end product photo retouching and color correction (up to 50 photos)",
      "Background removal and studio shadow enhancement",
      "Promotional web banner & discount graphic creation",
    ],
  });

  const [notIncludedItems, setNotIncludedItems] = useState<string[]>(
    data.notIncluded && data.notIncluded.length > 0
      ? data.notIncluded
      : [
          "Domain name & VPS hosting server cost",
          "Paid third-party API or plugin subscription fees",
          "Payment gateway processing charges & Courier API integration fees",
          "Paid ad campaign budget (Facebook/Google Ads)",
          "Monthly maintenance & ongoing off-page SEO",
        ]
  );

  const [clientRequirements, setClientRequirements] = useState<string[]>(
    data.clientRequirements && data.clientRequirements.length > 0
      ? data.clientRequirements
      : [
          "Logo vector file (SVG/AI) & Brand color guidelines",
          "Product details, pricing spreadsheet & high-resolution product images",
          "Text content for static pages (About Us, Privacy Policy, Terms)",
          "Domain register & web server hosting access credentials",
          "Payment gateway merchant credentials & SMS/Email SMTP API keys",
        ]
  );

  // Sync incoming fetched data (if editing an existing template)
  useEffect(() => {
    if (data.phases && data.phases.length > 0) {
      const nextScopes: Record<ServiceCategoryKey, string[]> = {
        "web-dev": [],
        "marketing": [],
        "video-editing": [],
        "photo-editing": [],
      };
      const nextActive: ServiceCategoryKey[] = [];

      data.phases.forEach((phase) => {
        const titleLower = (phase.title || "").toLowerCase();
        let matchedKey: ServiceCategoryKey = "web-dev";
        if (titleLower.includes("marketing") || titleLower.includes("seo")) matchedKey = "marketing";
        else if (titleLower.includes("video") || titleLower.includes("motion")) matchedKey = "video-editing";
        else if (titleLower.includes("photo") || titleLower.includes("retouch")) matchedKey = "photo-editing";

        if (phase.items && phase.items.length > 0) {
          nextScopes[matchedKey] = phase.items;
          if (!nextActive.includes(matchedKey)) nextActive.push(matchedKey);
        }
      });

      if (nextActive.length > 0) {
        setActiveServices(nextActive);
        setCategoryScopes(nextScopes);
      }
    }
    if (data.notIncluded && data.notIncluded.length > 0) setNotIncludedItems(data.notIncluded);
    if (data.clientRequirements && data.clientRequirements.length > 0) setClientRequirements(data.clientRequirements);
  }, [data.phases, data.notIncluded, data.clientRequirements]);

  // Propagate state changes to parent's `onChange`
  const syncToParent = (
    newScopes = categoryScopes,
    newNotIncluded = notIncludedItems,
    newRequirements = clientRequirements,
    newActive = activeServices
  ) => {
    const constructedPhases: IQuotationPhase[] = newActive.map((catId) => {
      const cat = SERVICE_CATEGORIES.find((c) => c.id === catId)!;
      return {
        title: cat.label,
        description: `Deliverables and feature scope for ${cat.label}`,
        items: newScopes[catId] || [],
      };
    });

    const flattenedScope: string[] = [];
    newActive.forEach((catId) => {
      const items = newScopes[catId] || [];
      items.forEach((item) => flattenedScope.push(`[${SERVICE_CATEGORIES.find((c) => c.id === catId)?.badgeText}] ${item}`));
    });

    onChange({
      ...data,
      phases: constructedPhases,
      developmentScope: flattenedScope,
      notIncluded: newNotIncluded,
      clientRequirements: newRequirements,
    });
  };

  // AI Paste text & UI states
  const [aiInputText, setAiInputText] = useState("");
  const [newScopeInputs, setNewScopeInputs] = useState<Record<ServiceCategoryKey, string>>({
    "web-dev": "",
    "marketing": "",
    "video-editing": "",
    "photo-editing": "",
  });
  const [newNotIncludedInput, setNewNotIncludedInput] = useState("");
  const [newRequirementInput, setNewRequirementInput] = useState("");

  const finalAmount = useMemo(() => {
    const validBase = isNaN(data.pricing?.basePrice) ? 0 : Number(data.pricing?.basePrice);
    const validDiscount = isNaN(data.pricing?.discount) ? 0 : Number(data.pricing?.discount);
    const discountVal = (validBase * validDiscount) / 100;
    return Math.max(0, validBase - discountVal);
  }, [data.pricing?.basePrice, data.pricing?.discount]);

  const toggleService = (catId: ServiceCategoryKey) => {
    if (isSaving) return;
    let nextActive: ServiceCategoryKey[];
    if (activeServices.includes(catId)) {
      if (activeServices.length === 1) {
        toast.error("At least one service category must remain active!");
        return;
      }
      nextActive = activeServices.filter((id) => id !== catId);
      toast.info(`Disabled ${SERVICE_CATEGORIES.find((c) => c.id === catId)?.label}`);
    } else {
      nextActive = [...activeServices, catId];
      toast.success(`Enabled ${SERVICE_CATEGORIES.find((c) => c.id === catId)?.label}`);
    }
    setActiveServices(nextActive);
    syncToParent(categoryScopes, notIncludedItems, clientRequirements, nextActive);
  };

  const handleParseAI = () => {
    if (!aiInputText.trim()) {
      toast.error("Please paste ChatGPT output first!");
      return;
    }

    const lines = aiInputText.split(/\r?\n/);
    let currentSection: ServiceCategoryKey | "notIncluded" | "clientRequirements" | "none" = "none";

    const parsedScopes: Record<ServiceCategoryKey, string[]> = {
      "web-dev": [],
      "marketing": [],
      "video-editing": [],
      "photo-editing": [],
    };
    const parsedNotIncluded: string[] = [];
    const parsedRequirements: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const lower = line.toLowerCase();
      if (lower.includes("web design") || lower.includes("web development") || lower.includes("website scope") || lower.includes("ui/ux") || lower.includes("product design")) {
        currentSection = "web-dev";
        if (!/^\d+[\.\)]/.test(line) && !/^[-\*•]/.test(line)) continue;
      } else if (lower.includes("marketing") || lower.includes("seo") || lower.includes("campaign")) {
        currentSection = "marketing";
        if (!/^\d+[\.\)]/.test(line) && !/^[-\*•]/.test(line)) continue;
      } else if (lower.includes("video") || lower.includes("motion")) {
        currentSection = "video-editing";
        if (!/^\d+[\.\)]/.test(line) && !/^[-\*•]/.test(line)) continue;
      } else if (lower.includes("photo") || lower.includes("retouch") || lower.includes("graphic")) {
        currentSection = "photo-editing";
        if (!/^\d+[\.\)]/.test(line) && !/^[-\*•]/.test(line)) continue;
      } else if (lower.includes("not included") || lower.includes("exclusions") || lower.includes("out of scope")) {
        currentSection = "notIncluded";
        if (!/^\d+[\.\)]/.test(line) && !/^[-\*•]/.test(line)) continue;
      } else if (lower.includes("client needs to provide") || lower.includes("client provides") || lower.includes("client requirements")) {
        currentSection = "clientRequirements";
        if (!/^\d+[\.\)]/.test(line) && !/^[-\*•]/.test(line)) continue;
      }

      if (currentSection !== "none") {
        const cleaned = line.replace(/^(\d+[\.\)]|[-\*•+])\s*/, "").trim();
        if (cleaned && !cleaned.endsWith(":") && cleaned.length > 2) {
          if (currentSection === "notIncluded") parsedNotIncluded.push(cleaned);
          else if (currentSection === "clientRequirements") parsedRequirements.push(cleaned);
          else parsedScopes[currentSection].push(cleaned);
        }
      }
    }

    let totalParsed =
      Object.values(parsedScopes).reduce((acc, arr) => acc + arr.length, 0) +
      parsedNotIncluded.length +
      parsedRequirements.length;

    if (totalParsed > 0) {
      const nextScopes = { ...categoryScopes };
      const nextActive = [...activeServices];
      let addedCategories = 0;

      for (const key of Object.keys(parsedScopes) as ServiceCategoryKey[]) {
        if (parsedScopes[key].length > 0) {
          nextScopes[key] = parsedScopes[key];
          if (!nextActive.includes(key)) {
            nextActive.push(key);
            addedCategories++;
          }
        }
      }

      setCategoryScopes(nextScopes);
      if (addedCategories > 0) setActiveServices(nextActive);
      const nextNotIncluded = parsedNotIncluded.length > 0 ? parsedNotIncluded : notIncludedItems;
      const nextReq = parsedRequirements.length > 0 ? parsedRequirements : clientRequirements;

      if (parsedNotIncluded.length > 0) setNotIncludedItems(nextNotIncluded);
      if (parsedRequirements.length > 0) setClientRequirements(nextReq);

      syncToParent(nextScopes, nextNotIncluded, nextReq, nextActive);
      toast.success(`🎉 Successfully auto-filled ${totalParsed} items across multi-service categories!`);
    } else {
      toast.error("Could not auto-detect sections! Ensure headings like 'Web Design Scope' or 'Not Included' are present.");
    }
  };

  const dynamicAiPrompt = useMemo(() => {
    const activeHeaders = activeServices
      .map((catId, idx) => {
        const cat = SERVICE_CATEGORIES.find((c) => c.id === catId)!;
        let desc = "(List feature deliverables as bullet points)";
        if (catId === "web-dev") desc = "(List web structure, UI design, and development features as bullet points)";
        else if (catId === "marketing") desc = "(List SEO audit, GA4 setup, and ad campaign features as bullet points)";
        else if (catId === "video-editing") desc = "(List video editing, color grading, and reel features as bullet points)";
        else if (catId === "photo-editing") desc = "(List photo retouching, background removal, and graphic features as bullet points)";

        return `${idx + 1}. ${cat.label} Scope\n${desc}`;
      })
      .join("\n\n");

    const exclusionsIdx = activeServices.length + 1;
    const reqIdx = activeServices.length + 2;

    return `Please create a Multi-Service Agency Proposal for the selected services with these exact section headings:\n\n${activeHeaders}\n\n${exclusionsIdx}. Not Included in This Price\n(List exclusions like domain, hosting, ad budget as bullet points)\n\n${reqIdx}. Client Needs to Provide\n(List required client assets like brand guidelines, credentials as bullet points)`;
  }, [activeServices]);

  const copyPrompt = () => {
    navigator.clipboard.writeText(dynamicAiPrompt);
    const names = activeServices
      .map((id) => SERVICE_CATEGORIES.find((c) => c.id === id)?.badgeText)
      .filter(Boolean)
      .join(", ");
    toast.success(`🎉 AI Prompt for [${names}] copied to clipboard!`);
  };

  const updateScopeItem = (catId: ServiceCategoryKey, index: number, val: string) => {
    if (isSaving) return;
    const next = { ...categoryScopes };
    next[catId] = [...next[catId]];
    next[catId][index] = val;
    setCategoryScopes(next);
    syncToParent(next, notIncludedItems, clientRequirements, activeServices);
  };

  const deleteScopeItem = (catId: ServiceCategoryKey, index: number) => {
    if (isSaving) return;
    const next = { ...categoryScopes };
    next[catId] = next[catId].filter((_, i) => i !== index);
    setCategoryScopes(next);
    syncToParent(next, notIncludedItems, clientRequirements, activeServices);
  };

  const addScopeItem = (catId: ServiceCategoryKey) => {
    if (isSaving) return;
    const val = newScopeInputs[catId].trim();
    if (!val) return;
    const next = { ...categoryScopes };
    next[catId] = [...next[catId], val];
    setCategoryScopes(next);
    setNewScopeInputs({ ...newScopeInputs, [catId]: "" });
    syncToParent(next, notIncludedItems, clientRequirements, activeServices);
  };

  const updateItem = (listName: "notIncluded" | "req", index: number, val: string) => {
    if (isSaving) return;
    if (listName === "notIncluded") {
      const next = [...notIncludedItems];
      next[index] = val;
      setNotIncludedItems(next);
      syncToParent(categoryScopes, next, clientRequirements, activeServices);
    } else {
      const next = [...clientRequirements];
      next[index] = val;
      setClientRequirements(next);
      syncToParent(categoryScopes, notIncludedItems, next, activeServices);
    }
  };

  const deleteItem = (listName: "notIncluded" | "req", index: number) => {
    if (isSaving) return;
    if (listName === "notIncluded") {
      const next = notIncludedItems.filter((_, i) => i !== index);
      setNotIncludedItems(next);
      syncToParent(categoryScopes, next, clientRequirements, activeServices);
    } else {
      const next = clientRequirements.filter((_, i) => i !== index);
      setClientRequirements(next);
      syncToParent(categoryScopes, notIncludedItems, next, activeServices);
    }
  };

  const addItem = (listName: "notIncluded" | "req") => {
    if (isSaving) return;
    if (listName === "notIncluded") {
      if (!newNotIncludedInput.trim()) return;
      const next = [...notIncludedItems, newNotIncludedInput.trim()];
      setNotIncludedItems(next);
      setNewNotIncludedInput("");
      syncToParent(categoryScopes, next, clientRequirements, activeServices);
    } else {
      if (!newRequirementInput.trim()) return;
      const next = [...clientRequirements, newRequirementInput.trim()];
      setClientRequirements(next);
      setNewRequirementInput("");
      syncToParent(categoryScopes, notIncludedItems, next, activeServices);
    }
  };

  return (
    <>
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;800&family=Outfit:wght@300;400;500;600;700;800&display=swap");
        .font-editorial {
          font-family: "Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .font-mono-numbers {
          font-family: "JetBrains Mono", monospace;
        }
      `}</style>

      <div className="w-full max-w-6xl mx-auto space-y-8 font-editorial text-slate-800 dark:text-slate-100 py-6 px-2">
        
        {/* Step 1: Multi-Service Selection Bar with SAVE TEMPLATE BUTTON AT THE TOP! */}
        <PremiumCard accent="purple">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#4E12D4] to-[#1E0078] text-white flex items-center justify-center shadow-md shadow-[#4E12D4]/20">
                <Layers className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {pageTitle || "Active Quotation Services"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                  Select 1, 2, or multiple agency services to bundle into this reusable proposal template
                </p>
              </div>
            </div>

            {/* SAVE TEMPLATE BUTTON PLACED PROMINENTLY AT THE TOP! */}
            <div className="flex items-center gap-3 self-end sm:self-center">
              <PremiumBadge variant="purple" size="md">
                {activeServices.length} Services Active
              </PremiumBadge>
              <PremiumButton
                variant="purple"
                size="lg"
                onClick={onSave}
                isLoading={isSaving}
                disabled={isSaving}
                leftIcon={<Save className="w-5 h-5 stroke-[2.5]" />}
                className="px-6 py-3 shadow-lg shadow-[#1E0078]/25"
              >
                Save Template
              </PremiumButton>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {SERVICE_CATEGORIES.map((cat) => {
              const isActive = activeServices.includes(cat.id);
              const IconComponent = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleService(cat.id)}
                  disabled={isSaving}
                  className={`flex items-center gap-3 px-4.5 py-3 rounded-2xl border transition-all duration-200 text-xs font-extrabold tracking-wide select-none ${
                    isActive
                      ? "bg-gradient-to-r from-[#1E0078] to-[#4E12D4] text-white border-[#4E12D4] shadow-md shadow-[#4E12D4]/25 scale-[1.02]"
                      : "bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-[#4E12D4]/50 hover:bg-slate-50/80 shadow-2xs"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-xl ${isActive ? 'bg-white/20' : cat.iconBg} flex items-center justify-center shrink-0`}>
                    <IconComponent className="w-4 h-4 stroke-[2.2] text-white" />
                  </div>
                  <span>{cat.label}</span>
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                      isActive ? "bg-white text-[#1E0078] shadow-sm scale-110" : "bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-transparent"
                    }`}
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                </button>
              );
            })}
          </div>
        </PremiumCard>

        {/* Step 2: Template Name & Investment Pricing (NO QUOTATION DATE/COMPANY/NUMBER FIELDS!) */}
        <PremiumCard accent="violet">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#1E0078] text-white flex items-center justify-center shadow-md shadow-[#1E0078]/20">
                <Building2 className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Template Basic Information & Investment
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                  Set template package name, base commercial pricing, and default discount tier
                </p>
              </div>
            </div>
            <PremiumBadge variant="violet" size="md">
              Reusable Agency Package
            </PremiumBadge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-6">
              <PremiumInput
                label="Proposal Template Name"
                placeholder="e.g. Corium Bangladesh E-Commerce & UX Package"
                value={data.name || ""}
                onChange={(e) => onChange({ ...data, name: e.target.value })}
                disabled={isSaving}
              />
            </div>

            <div className="lg:col-span-3">
              <PremiumInput
                label="Base Price (BDT)"
                type="number"
                value={data.pricing?.basePrice || ""}
                onChange={(e) =>
                  onChange({
                    ...data,
                    pricing: { ...data.pricing, basePrice: Number(e.target.value) },
                  })
                }
                disabled={isSaving}
                placeholder="120000"
              />
            </div>

            <div className="lg:col-span-3">
              <PremiumInput
                label="Discount (%)"
                type="number"
                value={data.pricing?.discount || ""}
                onChange={(e) =>
                  onChange({
                    ...data,
                    pricing: { ...data.pricing, discount: Number(e.target.value) },
                  })
                }
                disabled={isSaving}
                rightIcon={<span className="text-xs font-bold text-[#4E12D4] font-mono-numbers">%</span>}
              />
            </div>
          </div>

          {/* Prominent Final Amount Banner */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#4E12D4]/[0.03] dark:bg-[#4E12D4]/[0.05] p-5 rounded-2xl border border-[#4E12D4]/15">
            <div>
              <span className="text-[11px] font-extrabold text-[#4E12D4] dark:text-[#C850FA] uppercase tracking-[0.18em] block">
                Calculated Investment Total
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Computed dynamically based on base price and discount percentage
              </p>
            </div>
            <div className="text-right flex items-baseline gap-2 justify-end">
              {(data.pricing?.discount || 0) > 0 && (
                <span className="text-sm text-slate-400 line-through font-mono-numbers mr-2">
                  Reg: ৳ {Number(data.pricing?.basePrice || 0).toLocaleString()}
                </span>
              )}
              <span className="text-sm font-bold text-[#1E0078] dark:text-[#C850FA] font-mono-numbers">৳</span>
              <span className="text-3xl font-black text-[#1E0078] dark:text-white font-mono-numbers tracking-tight">
                {finalAmount.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-[#4E12D4] dark:text-[#C850FA] font-mono-numbers uppercase ml-1">
                BDT
              </span>
            </div>
          </div>
        </PremiumCard>

        {/* AI Paste Box Card */}
        <PremiumCard accent="magenta">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#C850FA] text-white flex items-center justify-center shadow-md shadow-[#C850FA]/20">
                <ClipboardPaste className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  AI Smart Import & Multi-Service Parser
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                  Paste raw ChatGPT proposals to automatically partition deliverables across active services
                </p>
              </div>
            </div>
            <PremiumButton
              variant="outline"
              size="sm"
              onClick={copyPrompt}
              disabled={isSaving}
              leftIcon={<Copy className="w-4 h-4 text-[#4E12D4] stroke-[2.5]" />}
            >
              Copy Multi-Service AI Prompt
            </PremiumButton>
          </div>

          <div className="space-y-4">
            <PremiumTextarea
              placeholder={`Paste ChatGPT output here... (e.g. 1. ${SERVICE_CATEGORIES.find((c) => c.id === activeServices[0])?.label || "Web Design"} Scope: ... ${activeServices.length > 1 ? `2. ${SERVICE_CATEGORIES.find((c => c.id === activeServices[1]))?.label} Scope: ... ` : ""}${activeServices.length + 1}. Not Included: ...)`}
              value={aiInputText}
              onChange={(e) => setAiInputText(e.target.value)}
              disabled={isSaving}
              rows={4}
            />
            <div className="flex items-center justify-between pt-2">
              <PremiumButton
                variant="ghost"
                size="sm"
                onClick={() => setAiInputText("")}
                disabled={isSaving || !aiInputText}
                leftIcon={<RotateCcw className="w-4 h-4 stroke-[2.5]" />}
              >
                Clear Text
              </PremiumButton>
              <PremiumButton
                variant="magenta"
                size="md"
                onClick={handleParseAI}
                disabled={isSaving}
                leftIcon={<Sparkles className="w-4 h-4 stroke-[2.5]" />}
              >
                Auto-Parse & Fill Active Categories
              </PremiumButton>
            </div>
          </div>
        </PremiumCard>

        {/* Step 3: Multi-Service Deliverables Scopes (DIVIDED BY ACTIVE CATEGORIES WITH COLORED BORDERS WITHOUT SHADOWS!) */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              <span className="w-3 h-8 rounded-full bg-gradient-to-b from-[#4E12D4] to-[#C850FA]" />
              1. Services & Deliverables Scope
            </h2>
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#4E12D4] bg-[#4E12D4]/10 px-3.5 py-1.5 rounded-full border border-[#4E12D4]/20">
              {activeServices.length} Active Modules
            </span>
          </div>

          {activeServices.map((catId, catIdx) => {
            const cat = SERVICE_CATEGORIES.find((c) => c.id === catId)!;
            const items = categoryScopes[catId] || [];
            const IconComponent = cat.icon;

            return (
              <PremiumCard key={catId} accent={catIdx % 2 === 0 ? "purple" : "violet"}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-11 h-11 rounded-2xl ${cat.iconBg} flex items-center justify-center shrink-0`}>
                      <IconComponent className="w-5 h-5 stroke-[2.2] text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                        {String.fromCharCode(65 + catIdx)}. {cat.label}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Itemized feature deliverables for {cat.badgeText} module
                      </p>
                    </div>
                  </div>
                  <PremiumBadge variant={catIdx % 2 === 0 ? "purple" : "violet"} size="sm">
                    {items.length} Items Included
                  </PremiumBadge>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <PremiumInput
                      placeholder={`Add deliverable to ${cat.badgeText}... (Press Enter)`}
                      value={newScopeInputs[catId]}
                      onChange={(e) => setNewScopeInputs({ ...newScopeInputs, [catId]: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && addScopeItem(catId)}
                      disabled={isSaving}
                    />
                    <PremiumButton
                      variant={catIdx % 2 === 0 ? "purple" : "primary"}
                      size="md"
                      onClick={() => addScopeItem(catId)}
                      disabled={isSaving || !newScopeInputs[catId].trim()}
                      leftIcon={<Plus className="w-4 h-4 stroke-[3]" />}
                      className="shrink-0 sm:w-auto w-full justify-center"
                    >
                      Add Item
                    </PremiumButton>
                  </div>

                  {/* 2-Column Grid with GORGEOUS COLORED BORDERS AND NO BOX SHADOW! */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                    <AnimatePresence initial={false}>
                      {items.map((item, index) => (
                        <motion.div
                          key={`${index}-${item.slice(0, 20)}`}
                          layout
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.2 }}
                          className={`flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900/80 border ${cat.borderColor} group transition-all shadow-xs hover:shadow-md`}
                        >
                          <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#4E12D4] to-[#1E0078] text-white flex items-center justify-center text-xs font-bold shrink-0 select-none font-mono shadow-xs border border-white/20">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <input
                            value={item}
                            onChange={(e) => updateScopeItem(catId, index, e.target.value)}
                            disabled={isSaving}
                            className="border-0 bg-transparent shadow-none h-auto p-1 text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#4E12D4] rounded-lg flex-1 disabled:opacity-70"
                          />
                          <button
                            type="button"
                            onClick={() => deleteScopeItem(catId, index)}
                            disabled={isSaving}
                            className="p-1.5 rounded-xl text-[#C850FA] hover:text-white hover:bg-red-500 opacity-70 group-hover:opacity-100 transition-all disabled:pointer-events-none"
                          >
                            <Trash2 className="w-4 h-4 stroke-[2.5]" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {items.length === 0 && (
                      <div className="col-span-1 md:col-span-2 text-center py-8 text-sm text-slate-400 italic bg-slate-50/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        No items in {cat.label}. Add above or auto-parse from AI.
                      </div>
                    )}
                  </div>
                </div>
              </PremiumCard>
            );
          })}
        </div>

        {/* Section 2: Not Included in This Price */}
        <PremiumCard accent="magenta">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#C850FA]/10 text-[#C850FA] flex items-center justify-center border border-[#C850FA]/25">
                <XCircle className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  2. Not Included in This Price
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                  Commercial exclusions and out-of-scope items across all active services
                </p>
              </div>
            </div>
            <PremiumBadge variant="magenta" size="md">
              {notIncludedItems.length} Exclusions
            </PremiumBadge>
          </div>

          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row gap-3">
              <PremiumInput
                placeholder="Type an exclusion item... (e.g. Domain cost, Monthly maintenance)"
                value={newNotIncludedInput}
                onChange={(e) => setNewNotIncludedInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addItem("notIncluded")}
                disabled={isSaving}
              />
              <PremiumButton
                variant="magenta"
                size="md"
                onClick={() => addItem("notIncluded")}
                disabled={isSaving || !newNotIncludedInput.trim()}
                leftIcon={<Plus className="w-4 h-4 stroke-[3]" />}
                className="shrink-0 sm:w-auto w-full justify-center"
              >
                Add Item
              </PremiumButton>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {notIncludedItems.map((item, index) => (
                  <motion.div
                    key={`${index}-${item.slice(0, 20)}`}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-[#C850FA]/[0.03] border border-[#C850FA]/20 group hover:border-[#C850FA]/40 hover:bg-[#C850FA]/[0.06] transition-all"
                  >
                    <span className="w-7 h-7 rounded-xl bg-[#C850FA]/15 text-[#1E0078] dark:text-[#C850FA] flex items-center justify-center text-xs font-bold shrink-0 select-none font-mono-numbers">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <input
                      value={item}
                      onChange={(e) => updateItem("notIncluded", index, e.target.value)}
                      disabled={isSaving}
                      className="border-0 bg-transparent shadow-none h-auto p-1 text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#C850FA] rounded-lg flex-1 disabled:opacity-70"
                    />
                    <button
                      type="button"
                      onClick={() => deleteItem("notIncluded", index)}
                      disabled={isSaving}
                      className="p-1.5 rounded-xl text-[#C850FA] hover:text-white hover:bg-red-500 opacity-70 group-hover:opacity-100 transition-all disabled:pointer-events-none"
                    >
                      <Trash2 className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </PremiumCard>

        {/* Section 3: Client Requirements */}
        <PremiumCard accent="violet">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#1E0078]/10 text-[#1E0078] dark:text-indigo-300 flex items-center justify-center border border-[#1E0078]/25">
                <ClipboardList className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  3. Client Needs to Provide
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                  Required assets, logo, content, and access credentials from the client
                </p>
              </div>
            </div>
            <PremiumBadge variant="violet" size="md">
              {clientRequirements.length} Prerequisites
            </PremiumBadge>
          </div>

          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row gap-3">
              <PremiumInput
                placeholder="Type a prerequisite... (e.g. Logo, Brand guideline, Access)"
                value={newRequirementInput}
                onChange={(e) => setNewRequirementInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addItem("req")}
                disabled={isSaving}
              />
              <PremiumButton
                variant="primary"
                size="md"
                onClick={() => addItem("req")}
                disabled={isSaving || !newRequirementInput.trim()}
                leftIcon={<Plus className="w-4 h-4 stroke-[3]" />}
                className="shrink-0 sm:w-auto w-full justify-center"
              >
                Add Item
              </PremiumButton>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {clientRequirements.map((item, index) => (
                  <motion.div
                    key={`${index}-${item.slice(0, 20)}`}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-[#1E0078]/[0.03] border border-[#1E0078]/20 group hover:border-[#1E0078]/40 hover:bg-[#1E0078]/[0.06] transition-all"
                  >
                    <span className="w-7 h-7 rounded-xl bg-[#1E0078]/15 text-[#1E0078] dark:text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0 select-none font-mono-numbers">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <input
                      value={item}
                      onChange={(e) => updateItem("req", index, e.target.value)}
                      disabled={isSaving}
                      className="border-0 bg-transparent shadow-none h-auto p-1 text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#1E0078] rounded-lg flex-1 disabled:opacity-70"
                    />
                    <button
                      type="button"
                      onClick={() => deleteItem("req", index)}
                      disabled={isSaving}
                      className="p-1.5 rounded-xl text-[#1E0078] hover:text-white hover:bg-red-500 opacity-70 group-hover:opacity-100 transition-all disabled:pointer-events-none"
                    >
                      <Trash2 className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </PremiumCard>
      </div>
    </>
  );
}
