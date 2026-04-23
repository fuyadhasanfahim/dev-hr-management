import { create } from "zustand";
import {
  QuotationData,
  ScopePhase,
  OptionalService,
  Settings,
  PhotographyItem,
  ServiceType,
} from "@/types/quotation.type";
import { format } from "date-fns";

const generateId = () => Math.random().toString(36).substr(2, 9);

interface QuotationStore {
  data: QuotationData;
  setServiceType: (type: ServiceType) => void;
  updateCompany: (company: Partial<QuotationData["company"]>) => void;
  updateClient: (client: Partial<QuotationData["client"]>) => void;
  updateDetails: (details: Partial<QuotationData["details"]>) => void;
  updateSettings: (settings: Partial<Settings>) => void;

  // Section Updates
  updateOverview: (overview: string) => void;
  updateTechStack: (stack: Partial<QuotationData["techStack"]>) => void;
  updateFeatures: (features: string[]) => void;
  updateAdminFeatures: (features: string[]) => void;
  updateMarketingSetup: (setup: string[]) => void;
  updateDeliveryTimeline: (timeline: string) => void;
  updateWorkflow: (workflow: string[]) => void;
  updateFinalNote: (note: string) => void;

  // Pricing Updates
  updatePricing: (pricing: Partial<QuotationData["pricing"]>) => void;

  // Scope Phase CRUD
  addScopePhase: () => void;
  updateScopePhase: (id: string, updates: Partial<ScopePhase>) => void;
  removeScopePhase: (id: string) => void;

  // Optional Services CRUD
  addOptionalService: () => void;
  updateOptionalService: (
    id: string,
    updates: Partial<OptionalService>,
  ) => void;
  removeOptionalService: (id: string) => void;

  // Photography Items CRUD
  addPhotographyItem: () => void;
  updatePhotographyItem: (
    id: string,
    updates: Partial<PhotographyItem>,
  ) => void;
  removePhotographyItem: (id: string) => void;

  // Template Loader
  loadTemplate: (type: "ecommerce" | "saas" | "service") => void;
}

const ecommerceTemplate: Partial<QuotationData> = {
  details: {
    title: "E-commerce Website Design & Development Quotation",
    quotationNumber: `QT-${format(new Date(), "yyyyMMdd")}-01`,
    date: format(new Date(), "yyyy-MM-dd"),
    validUntil: format(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd",
    ),
  },
  overview:
    "We will design and develop a complete e-commerce website tailored to your business, inspired by modern platforms, ensuring a clean, user-friendly, and conversion-focused experience.",
  scopeOfWork: [
    {
      id: generateId(),
      title: "UI/UX Design Phase",
      description: "",
      items: [
        "Full UI design shared for review.",
        "Feedback and revisions finalized in this phase.",
        "Upon approval, development begins."
      ]
    },
    {
      id: generateId(),
      title: "Frontend Development Phase",
      description: "",
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
        "Mobile responsive design"
      ]
    },
    {
      id: generateId(),
      title: "Admin Dashboard & Backend Phase",
      description: "",
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
        "System settings & configuration"
      ]
    },
    {
      id: generateId(),
      title: "Marketing & SEO Phase",
      description: "",
      items: [
        "Facebook Pixel integration",
        "Google Analytics (GA4) setup",
        "Conversion tracking ready structure",
        "Custom data layer implementation",
        "Google Tag Manager (GTM) integration",
        "Event tracking (add to cart, purchase, etc.)",
        "Ecommerce tracking setup",
        "Page speed & performance optimization",
        "Search engine indexing setup (Google Search Console)"
      ]
    }
  ],
  techStack: {
    frontend: ["Next.js", "Tailwind CSS", "shadcn UI"],
    backend: ["Node.js"],
    tools: ["Figma"],
    database: ["PostgreSQL"],
  },
  features: [
    "Product listing with categories & filters",
    "Product details page",
    "Add to cart & checkout system",
    "User login / registration",
    "Order placement & tracking",
    "Mobile optimized speed performance",
  ],
  adminFeatures: [
    "Product Management",
    "Category Management",
    "Inventory Management",
    "Order Management",
    "Customer Management",
  ],
  marketingSetup: [
    "Facebook Pixel setup",
    "Conversion tracking ready structure",
  ],
  deliveryTimeline: "7 – 10 Working Days",
  pricing: {
    totalCost: 25000,
    included: [],
    notIncluded: ["Domain Cost", "Hosting Cost", "Third-party subscriptions"],
  },
  optionalServices: [
    {
      id: generateId(),
      title: "VPS Hosting Plan",
      price: 5000,
      type: "recurring",
      description: "Secure shared server environment and deployment setup",
      items: [],
    },
  ],
  workflow: [
    "UI Design",
    "Feedback & Approval",
    "Development",
    "Testing",
    "Delivery",
  ],
  finalNote:
    "We focus on building business-ready eCommerce solutions that help brands grow smoothly online. Please note that domain, hosting, and any third-party subscriptions are not included in this price",
};

const saasTemplate: Partial<QuotationData> = {
  details: {
    title: "SaaS Platform Development Quotation",
    quotationNumber: `QT-${format(new Date(), "yyyyMMdd")}-02`,
    date: format(new Date(), "yyyy-MM-dd"),
    validUntil: format(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd",
    ),
  },
  overview:
    "We will develop a customized, scalable Software-as-a-Service (SaaS) platform tailored to your specific operational needs with multi-tenancy and subscription management out of the box.",
  scopeOfWork: [
    {
      id: generateId(),
      title: "Architecture & System Design",
      description: "Database schema design and API structuring",
      items: [
        "System flow wireframing",
        "Database modeling and tenant isolation planning",
      ],
    },
    {
      id: generateId(),
      title: "SaaS Platform Development",
      description: "Full-stack application building",
      items: [
        "Multi-tenant backend integration",
        "Frontend app and dashboard creation",
      ],
    },
  ],
  techStack: {
    frontend: ["React", "Next.js", "Tailwind CSS"],
    backend: ["Node.js", "Express", "PostgreSQL"],
    tools: ["Docker", "AWS"],
    database: ["PostgreSQL"],
  },
  features: [
    "User roles & permissions",
    "Subscription & Stripe billing integration",
    "Tenant data isolation",
    "Scalable API endpoints",
    "Email notifications & triggers",
  ],
  adminFeatures: [
    "Super Admin Dashboard",
    "Tenant & User Management",
    "Global Subscription Analytics",
    "Billing issue monitoring",
  ],
  marketingSetup: ["Google Analytics Integration", "SEO foundation setup"],
  deliveryTimeline: "45 – 60 Working Days\n\n(Includes 2 weeks beta testing)",
  pricing: {
    totalCost: 150000,
    included: [
      "B2B SaaS Web Application",
      "Stripe Integration",
      "Super Admin Dashboard",
    ],
    notIncluded: [
      "AWS / Server Costs",
      "Stripe Transaction Fees",
      "Post-launch Feature requests",
    ],
  },
  optionalServices: [
    {
      id: generateId(),
      title: "Monthly Maintenance & Support",
      price: 20000,
      type: "recurring",
      description: "Guaranteed SLAs, bug fixes, and minor updates every month.",
      items: [],
    },
  ],
  workflow: [
    "Architecture Approval",
    "Frontend Setup",
    "Backend Integration",
    "Beta Release & Q/A",
    "Live Launch",
  ],
  finalNote:
    "We build enterprise-grade SaaS products ensuring maximum security and scalability.",
};

const serviceTemplate: Partial<QuotationData> = {
  details: {
    title: "Service & Agency Website Quotation",
    quotationNumber: `QT-${format(new Date(), "yyyyMMdd")}-03`,
    date: format(new Date(), "yyyy-MM-dd"),
    validUntil: format(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd",
    ),
  },
  overview:
    "A premium, high-conversion landing page and multi-page corporate website to showcase your services, build trust, and seamlessly capture client leads.",
  scopeOfWork: [
    {
      id: generateId(),
      title: "Design & Prototyping",
      description: "Modern corporate identity and web mockup",
      items: ["Brand alignment", "Home page and internal pages layout design"],
    },
    {
      id: generateId(),
      title: "Responsive Development",
      description: "Fast and responsive site creation",
      items: ["Cross-browser compatibility", "Mobile and tablet optimization"],
    },
  ],
  techStack: {
    frontend: ["Next.js", "Tailwind", "Framer Motion"],
    backend: ["Headless CMS (Sanity)"],
    tools: ["Figma"],
    database: [],
  },
  features: [
    "Dynamic Portfolio / Case Studies",
    "Service detail pages",
    "Lead generation contact forms",
    "Fast loading static generation",
    "Blog / News section",
  ],
  adminFeatures: [
    "Easy content updating via Headless CMS",
    "Blog post publishing",
    "Form submission viewing",
  ],
  marketingSetup: ["Basic On-Page SEO", "Sitemap submission"],
  deliveryTimeline: "14 – 20 Working Days",
  pricing: {
    totalCost: 35000,
    included: ["Up to 10 Custom Pages", "CMS Integration", "Basic SEO Setup"],
    notIncluded: [
      "Domain/Hosting",
      "Content Writing",
      "Advanced Custom Animations",
    ],
  },
  optionalServices: [
    {
      id: generateId(),
      title: "Professional Copywriting",
      price: 8000,
      type: "one-time",
      description:
        "Expertly written site copy to maximize conversion on up to 5 pages.",
      items: [],
    },
  ],
  workflow: [
    "Design Approval",
    "Development",
    "Content Integration",
    "Final Review",
    "Deployment",
  ],
  finalNote:
    "Your new website will establish serious authority and convert traffic into quality leads.",
};

const initialState: QuotationData = {
  serviceType: "web-development",
  company: {
    logo: "/assets/image/logo.svg",
    name: "WebBriks",
    address:
      "115 Senpara Parbata (3rd floor of Sheltech Rubynur),\nBegum Rokeya Avenue, Mirpur,\nDhaka 1216, Bangladesh.",
    email: "info@webbriks.com",
    phone: "+8801977201923",
    website: "www.webbriks.com",
  },
  client: {
    contactName: "Jane Doe",
    companyName: "Acme Corp",
    address: "456 Business Ave, Suite 100, New York, NY 10001",
    email: "jane.doe@acmecorp.com",
    phone: "+1 (555) 987-6543",
  },
  details: ecommerceTemplate.details as any,
  overview: ecommerceTemplate.overview as string,
  scopeOfWork: ecommerceTemplate.scopeOfWork as ScopePhase[],
  techStack: ecommerceTemplate.techStack as any,
  features: ecommerceTemplate.features as string[],
  adminFeatures: ecommerceTemplate.adminFeatures as string[],
  marketingSetup: ecommerceTemplate.marketingSetup as string[],
  deliveryTimeline: ecommerceTimeline.deliveryTimeline as string,
  pricing: ecommerceTemplate.pricing as any,
  optionalServices: ecommerceTemplate.optionalServices as OptionalService[],
  photographyItems: [],
  workflow: ecommerceTemplate.workflow as string[],
  finalNote: ecommerceTemplate.finalNote as string,
  settings: {
    currency: "৳",
    taxRate: 0,
    discount: 0,
  },
};

export const useQuotationStore = create<QuotationStore>((set) => ({
  data: initialState,

  setServiceType: (type) =>
    set((state) => {
      if (state.data.serviceType === type) return state;

      let overview = state.data.overview;
      let finalNote = state.data.finalNote;
      let title = state.data.details.title;

      if (type === "product-photography") {
        overview =
          "We focus on delivering high-quality, professional product photography that highlights the true value of your items and enhances your brand's visual identity.";
        finalNote =
          "We are excited to visually elevate your products with our dedicated photography sessions.";
        if (
          title === "E-commerce Website Design & Development Quotation" ||
          title.includes("Website")
        ) {
          title = "Product Photography Quotation";
        }
      } else {
        overview =
          "We will design and develop a complete e-commerce website tailored to your business, inspired by modern platforms, ensuring a clean, user-friendly, and conversion-focused experience.";
        finalNote =
          "We focus on building business-ready eCommerce solutions that help brands grow smoothly online. Please note that domain, hosting, and any third-party subscriptions are not included in this price";
        if (
          title === "Product Photography Quotation" ||
          title.includes("Photography")
        ) {
          title = "E-commerce Website Design & Development Quotation";
        }
      }

      return {
        data: {
          ...state.data,
          serviceType: type,
          overview,
          finalNote,
          details: {
            ...state.data.details,
            title,
          },
        },
      };
    }),
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
  updateSettings: (settings) =>
    set((state) => ({
      data: {
        ...state.data,
        settings: { ...state.data.settings, ...settings },
      },
    })),

  updateOverview: (overview) =>
    set((state) => ({ data: { ...state.data, overview } })),
  updateTechStack: (stack) =>
    set((state) => ({
      data: { ...state.data, techStack: { ...state.data.techStack, ...stack } },
    })),
  updateFeatures: (features) =>
    set((state) => ({ data: { ...state.data, features } })),
  updateAdminFeatures: (adminFeatures) =>
    set((state) => ({ data: { ...state.data, adminFeatures } })),
  updateMarketingSetup: (marketingSetup) =>
    set((state) => ({ data: { ...state.data, marketingSetup } })),
  updateDeliveryTimeline: (deliveryTimeline) =>
    set((state) => ({ data: { ...state.data, deliveryTimeline } })),
  updateWorkflow: (workflow) =>
    set((state) => ({ data: { ...state.data, workflow } })),
  updateFinalNote: (finalNote) =>
    set((state) => ({ data: { ...state.data, finalNote } })),

  updatePricing: (pricing) =>
    set((state) => ({
      data: { ...state.data, pricing: { ...state.data.pricing, ...pricing } },
    })),

  addScopePhase: () =>
    set((state) => ({
      data: {
        ...state.data,
        scopeOfWork: [
          ...state.data.scopeOfWork,
          { id: generateId(), title: "New Phase", description: "", items: [] },
        ],
      },
    })),

  updateScopePhase: (id, updates) =>
    set((state) => ({
      data: {
        ...state.data,
        scopeOfWork: state.data.scopeOfWork.map((p) =>
          p.id === id ? { ...p, ...updates } : p,
        ),
      },
    })),

  removeScopePhase: (id) =>
    set((state) => ({
      data: {
        ...state.data,
        scopeOfWork: state.data.scopeOfWork.filter((p) => p.id !== id),
      },
    })),

  addOptionalService: () =>
    set((state) => ({
      data: {
        ...state.data,
        optionalServices: [
          ...state.data.optionalServices,
          {
            id: generateId(),
            title: "New Optional Service",
            price: 0,
            type: "one-time",
            description: "",
            items: [],
          },
        ],
      },
    })),

  updateOptionalService: (id, updates) =>
    set((state) => ({
      data: {
        ...state.data,
        optionalServices: state.data.optionalServices.map((s) =>
          s.id === id ? { ...s, ...updates } : s,
        ),
      },
    })),

  removeOptionalService: (id) =>
    set((state) => ({
      data: {
        ...state.data,
        optionalServices: state.data.optionalServices.filter(
          (s) => s.id !== id,
        ),
      },
    })),

  addPhotographyItem: () =>
    set((state) => ({
      data: {
        ...state.data,
        photographyItems: [
          ...state.data.photographyItems,
          {
            id: generateId(),
            title: "New Product",
            outputString: "client gets 5 images",
            quantity: 1,
            price: 0,
          },
        ],
      },
    })),

  updatePhotographyItem: (id, updates) =>
    set((state) => ({
      data: {
        ...state.data,
        photographyItems: state.data.photographyItems.map((item) =>
          item.id === id ? { ...item, ...updates } : item,
        ),
      },
    })),

  removePhotographyItem: (id) =>
    set((state) => ({
      data: {
        ...state.data,
        photographyItems: state.data.photographyItems.filter(
          (item) => item.id !== id,
        ),
      },
    })),

  loadTemplate: (type) =>
    set((state) => {
      let tpl;
      if (type === "ecommerce") tpl = ecommerceTemplate;
      else if (type === "saas") tpl = saasTemplate;
      else if (type === "service") tpl = serviceTemplate;
      if (!tpl) return state;

      return { data: { ...state.data, ...tpl } as QuotationData };
    }),
}));
