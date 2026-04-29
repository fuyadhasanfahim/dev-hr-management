import { QuotationData } from "@/types/quotation.type";

export const QUOTATION_TEMPLATES: Record<string, Partial<QuotationData>> = {
  "ecommerce-website": {
    details: {
      title: "E-commerce Website Solution",
      date: new Date().toISOString().split("T")[0],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
    overview: "A high-performance e-commerce website designed for maximum conversion and seamless user experience.",
    phases: [
      {
        title: "Design & Prototyping",
        description: "UI/UX design and interactive wireframes",
        items: ["Homepage Design", "Product Listing UI", "Checkout Flow Optimization", "Mobile Responsive Layouts"],
      },
      {
        title: "Frontend Development",
        description: "Building the user interface with Next.js",
        items: ["Product Catalog", "Shopping Cart Integration", "User Account Section", "Search & Filtering"],
      },
      {
        title: "Backend & Payments",
        description: "Server-side logic and payment gateway",
        items: ["Stripe/SSLCommerz Integration", "Order Management API", "User Authentication", "Email Notifications"],
      }
    ],
    techStack: {
      frontend: "Next.js",
      backend: "Node.js",
      database: "PostgreSQL",
      tools: ["Tailwind CSS", "shadcn/ui", "Stripe", "Cloudinary"],
    },
    pricing: {
      basePrice: 45000,
      taxRate: 0,
      discount: 0,
    },
    workflow: ["Requirement Gathering", "Design Approval", "Development", "UAT", "Launch"],
  },

  "ecommerce-dashboard": {
    details: {
      title: "E-commerce Admin Dashboard",
      date: new Date().toISOString().split("T")[0],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
    overview: "Comprehensive management system for products, orders, and customer analytics.",
    phases: [
      {
        title: "Architecture & Security",
        description: "Role-based access and system design",
        items: ["RBAC Implementation", "Database Schema Design", "Admin Auth System"],
      },
      {
        title: "Core Management",
        description: "Managing the e-commerce lifecycle",
        items: ["Product & Inventory CRUD", "Order Processing Pipeline", "Customer Insights Dashboard"],
      },
      {
        title: "Analytics & Reports",
        description: "Data visualization and business intelligence",
        items: ["Sales Analytics Chart", "Inventory Alerts", "Exportable PDF/Excel Reports"],
      }
    ],
    techStack: {
      frontend: "React",
      backend: "NestJS",
      database: "PostgreSQL",
      tools: ["shadcn/ui", "Docker", "Sentry", "Postman"],
    },
    pricing: {
      basePrice: 65000,
      taxRate: 0,
      discount: 0,
    },
    workflow: ["System Architecture", "API Development", "Frontend Integration", "Beta Testing"],
  },

  "ecommerce-full-suite": {
    details: {
      title: "E-commerce Dashboard + Client Panel",
      date: new Date().toISOString().split("T")[0],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
    overview: "A complete enterprise-grade e-commerce ecosystem including Admin Dashboard and Customer self-service panel.",
    phases: [
      {
        title: "Unified Ecosystem Design",
        description: "Shared architecture for both panels",
        items: ["Multi-panel Auth System", "Shared Core API", "Centralized Database Structure"],
      },
      {
        title: "Admin Control Center",
        description: "Global business management",
        items: ["Advanced Inventory Control", "Sales Forecasting", "Vendor Management"],
      },
      {
        title: "Customer Success Panel",
        description: "Self-service for end-users",
        items: ["Order Tracking History", "Support Ticket System", "Personalized Recommendations"],
      }
    ],
    techStack: {
      frontend: "Next.js",
      backend: "Node.js",
      database: "PostgreSQL",
      tools: ["shadcn/ui", "AWS", "Stripe", "CI/CD", "Redis"],
    },
    pricing: {
      basePrice: 120000,
      taxRate: 0,
      discount: 0,
    },
    workflow: ["Planning", "MVP Development", "Scale Testing", "Deployment", "Maintenance"],
  }
};
