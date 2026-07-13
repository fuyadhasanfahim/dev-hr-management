import { create } from "zustand";
import {
  QuotationData,
  IQuotationService,
  IQuotationLineItem,
  IQuotationTechStack,
  IPaymentMilestone,
  QuotationCategory,
  ServiceType,
} from "@/types/quotation.type";
import { QUOTATION_TEMPLATES, getDefaultBillingCycle, isUnitBased } from "@/constants/quotation-templates";

function emptyService(category: QuotationCategory): IQuotationService {
  return {
    category,
    scopeDescription: "",
    scopeItems: [],
    ...(category === "web-development"
      ? { techStack: { description: "", frontend: [], backend: [], database: [], tools: [] } }
      : {}),
    basePrice: 0,
    lineItems: [],
    discount: 0,
    taxRate: 0,
  };
}

function defaultLineItem(category: QuotationCategory): IQuotationLineItem {
  return {
    title: "New Line Item",
    price: 0,
    billingCycle: getDefaultBillingCycle(category),
    ...(isUnitBased(category) ? { quantity: 1 } : {}),
    description: "",
  };
}

interface QuotationStore {
  data: QuotationData;
  setServiceType: (type: ServiceType) => void;
  updateCompany: (company: Partial<QuotationData["company"]>) => void;
  updateClient: (client: Partial<QuotationData["client"]>) => void;
  updateDetails: (details: Partial<QuotationData["details"]>) => void;

  // Content Updates
  updateOverview: (overview: string) => void;
  updateWorkflow: (workflow: string[]) => void;
  updateNotIncluded: (items: string[]) => void;
  updateClientRequirements: (items: string[]) => void;

  // Multi-service CRUD — one IQuotationService per selected category.
  toggleService: (category: QuotationCategory) => void;
  updateService: (category: QuotationCategory, updates: Partial<IQuotationService>) => void;
  updateTechStack: (category: QuotationCategory, updates: Partial<IQuotationTechStack>) => void;
  addScopeItem: (category: QuotationCategory, item?: string) => void;
  updateScopeItem: (category: QuotationCategory, index: number, value: string) => void;
  removeScopeItem: (category: QuotationCategory, index: number) => void;
  addLineItem: (category: QuotationCategory, item?: IQuotationLineItem) => void;
  updateLineItem: (category: QuotationCategory, index: number, updates: Partial<IQuotationLineItem>) => void;
  removeLineItem: (category: QuotationCategory, index: number) => void;

  // Payment Milestones CRUD
  setPaymentMilestones: (milestones: IPaymentMilestone[]) => void;
  addPaymentMilestone: (milestone?: IPaymentMilestone) => void;
  updatePaymentMilestone: (index: number, updates: Partial<IPaymentMilestone>) => void;
  removePaymentMilestone: (index: number) => void;

  // Helpers
  loadTemplate: (templateKey: string) => void;
  setData: (data: QuotationData) => void;
  reset: () => void;
}

const initialState: QuotationData = {
  serviceType: "web-development",
  clientId: "",
  currency: "৳",
  company: {
    name: "WebBriks",
    address: "115 Senpara Parbata, Mirpur, Dhaka 1216, Bangladesh.",
    email: "info@webbriks.com",
    phone: "+8801977201923",
    website: "www.webbriks.com",
    logo: "/assets/image/logo.svg",
  },
  client: {
    contactName: "",
    companyName: "",
    address: "",
    email: "",
    phone: "",
  },
  details: {
    title: "Project Quotation",
    date: new Date().toISOString().split("T")[0],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  },
  overview: "",
  services: [],
  notIncluded: [
    "Domain Registration & Premium Web Hosting (Billed Separately)",
    "Third-party Paid API Licenses, Plugins, or Premium Fonts",
    "Paid Ad Spend for Facebook, Google, or LinkedIn Campaigns",
    "Raw Unedited Studio Footage or Source Design Files (Unless specified)",
  ],
  clientRequirements: [
    "High-resolution Brand Logo, Color Palette & Typography Guidelines",
    "Admin Access / Credentials to Hosting, Domain, or CMS Platform",
    "Final Approved Text Content, Copywriting & Product Photography",
    "Dedicated Point of Contact for Prompt Feedback and Approvals",
  ],
  recurringCharges: [],
  workflow: [],
  paymentMilestones: [
    { label: "30% Upfront Payment", percentage: 30 },
    { label: "40% Midway Progress Milestone", percentage: 40 },
    { label: "30% Final Delivery & Handover", percentage: 30 },
  ],
  totals: {
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    grandTotal: 0,
  }
};

export const useQuotationStore = create<QuotationStore>((set) => ({
  data: initialState,

  setServiceType: (type) =>
    set((state) => ({
      data: { ...state.data, serviceType: type },
    })),

  updateCompany: (company) =>
    set((state) => ({
      data: { ...state.data, company: { ...state.data.company, ...company } },
    })),

  updateClient: (client) =>
    set((state) => ({
      data: { ...state.data, client: { ...state.data.client, ...client } },
    })),

  updateDetails: (details) =>
    set((state) => ({
      data: { ...state.data, details: { ...state.data.details, ...details } },
    })),

  updateOverview: (overview) =>
    set((state) => ({ data: { ...state.data, overview } })),

  updateWorkflow: (workflow) =>
    set((state) => ({ data: { ...state.data, workflow } })),

  updateNotIncluded: (items) =>
    set((state) => ({ data: { ...state.data, notIncluded: items } })),

  updateClientRequirements: (items) =>
    set((state) => ({ data: { ...state.data, clientRequirements: items } })),

  toggleService: (category) =>
    set((state) => {
      const exists = state.data.services.some((s) => s.category === category);
      const services = exists
        ? state.data.services.filter((s) => s.category !== category)
        : [...state.data.services, emptyService(category)];
      return { data: { ...state.data, services } };
    }),

  updateService: (category, updates) =>
    set((state) => ({
      data: {
        ...state.data,
        services: state.data.services.map((s) =>
          s.category === category ? { ...s, ...updates } : s,
        ),
      },
    })),

  updateTechStack: (category, updates) =>
    set((state) => ({
      data: {
        ...state.data,
        services: state.data.services.map((s) =>
          s.category === category
            ? {
                ...s,
                techStack: {
                  description: "",
                  frontend: [],
                  backend: [],
                  database: [],
                  tools: [],
                  ...s.techStack,
                  ...updates,
                },
              }
            : s,
        ),
      },
    })),

  addScopeItem: (category, item = "New feature deliverable description...") =>
    set((state) => ({
      data: {
        ...state.data,
        services: state.data.services.map((s) =>
          s.category === category ? { ...s, scopeItems: [...s.scopeItems, item] } : s,
        ),
      },
    })),

  updateScopeItem: (category, index, value) =>
    set((state) => ({
      data: {
        ...state.data,
        services: state.data.services.map((s) =>
          s.category === category
            ? { ...s, scopeItems: s.scopeItems.map((it, i) => (i === index ? value : it)) }
            : s,
        ),
      },
    })),

  removeScopeItem: (category, index) =>
    set((state) => ({
      data: {
        ...state.data,
        services: state.data.services.map((s) =>
          s.category === category
            ? { ...s, scopeItems: s.scopeItems.filter((_, i) => i !== index) }
            : s,
        ),
      },
    })),

  addLineItem: (category, item) =>
    set((state) => ({
      data: {
        ...state.data,
        services: state.data.services.map((s) =>
          s.category === category
            ? { ...s, lineItems: [...s.lineItems, item || defaultLineItem(category)] }
            : s,
        ),
      },
    })),

  updateLineItem: (category, index, updates) =>
    set((state) => ({
      data: {
        ...state.data,
        services: state.data.services.map((s) => {
          if (s.category !== category) return s;
          const lineItems = [...s.lineItems];
          lineItems[index] = { ...lineItems[index], ...updates };
          return { ...s, lineItems };
        }),
      },
    })),

  removeLineItem: (category, index) =>
    set((state) => ({
      data: {
        ...state.data,
        services: state.data.services.map((s) =>
          s.category === category
            ? { ...s, lineItems: s.lineItems.filter((_, i) => i !== index) }
            : s,
        ),
      },
    })),

  setPaymentMilestones: (milestones) =>
    set((state) => ({
      data: { ...state.data, paymentMilestones: milestones },
    })),

  addPaymentMilestone: (milestone) =>
    set((state) => ({
      data: {
        ...state.data,
        paymentMilestones: [
          ...(state.data.paymentMilestones || []),
          milestone || { label: "New milestone", percentage: 0 },
        ],
      },
    })),

  updatePaymentMilestone: (index, updates) =>
    set((state) => {
      const list = [...(state.data.paymentMilestones || [])];
      list[index] = { ...list[index], ...updates };
      return { data: { ...state.data, paymentMilestones: list } };
    }),

  removePaymentMilestone: (index) =>
    set((state) => ({
      data: {
        ...state.data,
        paymentMilestones: (state.data.paymentMilestones || []).filter((_, i) => i !== index),
      },
    })),

  loadTemplate: (templateKey) =>
    set((state) => {
      const template = QUOTATION_TEMPLATES[templateKey];
      if (!template) return state;
      return {
        data: {
          ...state.data,
          ...template,
          details: {
            ...state.data.details,
            ...template.details,
          },
        } as QuotationData
      };
    }),

  setData: (data) => set({ data }),
  reset: () => set({ data: initialState }),
}));
