import { QuotationData } from "@/types/quotation.type";

export const QUOTATION_TEMPLATES: Record<string, Partial<QuotationData>> = {
  "web-saas": {
    serviceType: "web-development",
    details: {
      title: "SaaS Platform Development",
      date: new Date().toISOString().split("T")[0],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
    phases: [
      {
        title: "Discovery & Planning",
        description: "Initial requirements gathering and system architecture design.",
        items: ["User Flow Diagrams", "Database Schema Design", "API Documentation Plan"],
      },
      {
        title: "UI/UX Design",
        description: "Interactive prototypes and high-fidelity mockups.",
        items: ["Figma Wireframes", "Interactive Prototyping", "Design System Creation"],
      },
      {
        title: "Core Development",
        description: "Building the engine of the platform.",
        items: ["Authentication System", "Tenant Management", "Subscription Integration"],
      }
    ],
    techStack: {
      frontend: "Next.js 15 (App Router)",
      backend: "Node.js (TypeScript)",
      database: "PostgreSQL (Prisma)",
      tools: ["TailwindCSS", "Redux Toolkit", "Stripe API"],
    },
    pricing: {
      basePrice: 5000,
      taxRate: 15,
      discount: 0,
    },
    additionalServices: [
      { title: "Monthly Maintenance", price: 200, billingCycle: "monthly", description: "Security patches and minor updates." }
    ],
    workflow: [
      "Requirement Analysis",
      "UI/UX Approval",
      "Development Sprints",
      "QA & UAT",
      "Deployment"
    ]
  },
  "e-commerce": {
    serviceType: "web-development",
    details: {
      title: "Enterprise E-commerce Solution",
      date: new Date().toISOString().split("T")[0],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
    phases: [
      {
        title: "Storefront Design",
        items: ["Product Listing Pages", "Shopping Cart Flow", "User Accounts"],
      },
      {
        title: "Inventory & Payments",
        items: ["Inventory Sync", "Payment Gateway Integration", "Shipping API"],
      }
    ],
    techStack: {
      frontend: "React / Vite",
      backend: "Node.js",
      database: "MongoDB",
      tools: ["Firebase Auth", "Sentry", "Cloudinary"],
    },
    pricing: {
      basePrice: 3500,
      taxRate: 10,
      discount: 5,
    },
    additionalServices: [],
    workflow: ["Concept", "Design", "Dev", "Launch"]
  }
};
