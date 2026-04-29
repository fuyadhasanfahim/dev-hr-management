import { create } from "zustand";
import {
  QuotationData,
  IQuotationPhase,
  IAdditionalService,
  ServiceType,
} from "@/types/quotation.type";
import { QUOTATION_TEMPLATES } from "@/constants/quotation-templates";

const generateId = () => Math.random().toString(36).substr(2, 9);

interface QuotationStore {
  data: QuotationData;
  setServiceType: (type: ServiceType) => void;
  updateCompany: (company: Partial<QuotationData["company"]>) => void;
  updateClient: (client: Partial<QuotationData["client"]>) => void;
  updateDetails: (details: Partial<QuotationData["details"]>) => void;

  // Content Updates
  updateOverview: (overview: string) => void;
  updateTechStack: (stack: Partial<QuotationData["techStack"]>) => void;
  updateWorkflow: (workflow: string[]) => void;
  updatePricing: (pricing: Partial<QuotationData["pricing"]>) => void;

  // Phase CRUD
  addPhase: (phase?: IQuotationPhase) => void;
  updatePhase: (index: number, updates: Partial<IQuotationPhase>) => void;
  removePhase: (index: number) => void;

  // Additional Services CRUD
  addService: (service?: IAdditionalService) => void;
  updateService: (index: number, updates: Partial<IAdditionalService>) => void;
  removeService: (index: number) => void;

  // Helpers
  loadTemplate: (templateKey: string) => void;
  setData: (data: QuotationData) => void;
  reset: () => void;
}

const initialState: QuotationData = {
  serviceType: "web-development",
  clientId: "",
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
  phases: [],
  techStack: {
    frontend: "",
    backend: "",
    database: "",
    tools: [],
  },
  pricing: {
    basePrice: 0,
    taxRate: 0,
    discount: 0,
  },
  additionalServices: [],
  workflow: [],
  totals: {
    subtotal: 0,
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

  updateTechStack: (stack) =>
    set((state) => ({
      data: { ...state.data, techStack: { ...state.data.techStack, ...stack } },
    })),

  updateWorkflow: (workflow) =>
    set((state) => ({ data: { ...state.data, workflow } })),

  updatePricing: (pricing) =>
    set((state) => ({
      data: { ...state.data, pricing: { ...state.data.pricing, ...pricing } },
    })),

  addPhase: (phase) =>
    set((state) => ({
      data: {
        ...state.data,
        phases: [
          ...state.data.phases,
          phase || { title: "New Phase", description: "", items: [] },
        ],
      },
    })),

  updatePhase: (index, updates) =>
    set((state) => {
      const newPhases = [...state.data.phases];
      newPhases[index] = { ...newPhases[index], ...updates };
      return { data: { ...state.data, phases: newPhases } };
    }),

  removePhase: (index) =>
    set((state) => ({
      data: {
        ...state.data,
        phases: state.data.phases.filter((_, i) => i !== index),
      },
    })),

  addService: (service) =>
    set((state) => ({
      data: {
        ...state.data,
        additionalServices: [
          ...state.data.additionalServices,
          service || { title: "New Service", price: 0, billingCycle: "one-time", description: "" },
        ],
      },
    })),

  updateService: (index, updates) =>
    set((state) => {
      const newServices = [...state.data.additionalServices];
      newServices[index] = { ...newServices[index], ...updates };
      return { data: { ...state.data, additionalServices: newServices } };
    }),

  removeService: (index) =>
    set((state) => ({
      data: {
        ...state.data,
        additionalServices: state.data.additionalServices.filter((_, i) => i !== index),
      },
    })),

  loadTemplate: (templateKey) =>
    set((state) => {
      const template = QUOTATION_TEMPLATES[templateKey];
      if (!template) return state;
      return { data: { ...state.data, ...template } as QuotationData };
    }),

  setData: (data) => set({ data }),
  reset: () => set({ data: initialState }),
}));
