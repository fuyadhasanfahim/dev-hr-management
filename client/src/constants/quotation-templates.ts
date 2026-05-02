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
  },

  "ecommerce-complete": {
    details: {
      title: "E-commerce Website + UI/UX + Admin Dashboard",
      date: new Date().toISOString().split("T")[0],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
    overview: "Complete E-commerce custom web and dashboard solution based on business requirements. Includes 90 days of free technical support after project delivery.",
    phases: [
      {
        title: "Frontend Website Features",
        description: "Client-facing complete e-commerce platform",
        items: [
          "Custom UI/UX Design",
          "Fully Responsive Website",
          "Homepage Design",
          "Product Listing Page",
          "Product Details Page",
          "Category & Sub-category System",
          "Product Search",
          "Product Filter & Sorting",
          "Shopping Cart",
          "Checkout System",
          "Customer Login / Registration",
          "Customer Dashboard",
          "Order Tracking Page",
          "Wishlist System",
          "Coupon / Discount System",
          "SEO Friendly Structure",
          "Fast Loading Website",
          "Mobile Optimized Design",
          "Privacy Policy / Terms / Return Policy Pages",
          "Contact Page",
          "About Page"
        ],
      },
      {
        title: "Admin Dashboard Features",
        description: "Powerful dashboard for store management",
        items: [
          "Admin Login",
          "Dashboard Overview",
          "Product Management",
          "Category Management",
          "Inventory / Stock Management",
          "Order Management",
          "Customer Management",
          "Courier Management",
          "Payment Management",
          "SMS Notification System",
          "Order Status Update",
          "Fraud Order Check System",
          "Coupon Management",
          "Banner Management",
          "Custom CMS Pages",
          "Website Content Management",
          "Sales Report",
          "Customer Report",
          "Stock Report",
          "Admin Role Management",
          "Basic Analytics Setup",
          "Pixel & Data Layer Setup"
        ],
      },
      {
        title: "Technical Features",
        description: "Advanced backend and frontend architectural setup",
        items: [
          "Custom Code Development",
          "Next.js Frontend",
          "Node.js Backend",
          "Database Setup",
          "API Integration",
          "Secure Admin Panel",
          "Basic Security Setup",
          "Speed Optimization",
          "Deployment Support"
        ],
      }
    ],
    techStack: {
      frontend: "Next.js",
      backend: "Node.js",
      database: "PostgreSQL",
      tools: ["Custom UI/UX", "SEO Ready", "Fast Loading", "Mobile Optimized", "SMS System", "SMS Gateway", "Pixel Setup", "Data Layer"],
    },
    pricing: {
      basePrice: 120000,
      taxRate: 0,
      discount: 0,
    },
    additionalServices: [
      {
        title: "Managed Hosting by Web Briks",
        price: 5000,
        billingCycle: "yearly",
        description: "Includes: Yearly Hosting, Server Setup, Website Deployment, Basic Server Maintenance, Hosting Managed by Our Team, Basic Security Monitoring",
      }
    ],
    workflow: [
      "Requirement Discussion",
      "Feature Finalization",
      "Quotation Approval",
      "Advance Payment",
      "UI/UX Design",
      "Design Review & Feedback",
      "Frontend Development",
      "Backend Development",
      "Admin Dashboard Development",
      "API & Integration Setup",
      "Testing & Quality Check",
      "Client Review",
      "Final Revision",
      "Website Deployment",
      "Project Handover",
      "90 Days Free Support"
    ],
  },

  "saas-web-app": {
    details: {
      title: "SaaS Web Application",
      date: new Date().toISOString().split("T")[0],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
    overview: "Multi-functional SaaS web application for your business. Custom design, role-based access, and seamless integrations. Includes 90 days of free technical support after project delivery.",
    phases: [
      {
        title: "Core SaaS Features",
        description: "Essential platform capabilities",
        items: [
          "Custom UI/UX Design",
          "User Registration & Login",
          "User Dashboard",
          "Admin Dashboard",
          "Role-based Access Control",
          "Subscription Plan Management",
          "Package / Pricing Plan System",
          "Payment Gateway Integration",
          "User Management",
          "Team / Staff Management",
          "Permission Management",
          "Notification System",
          "Email Notification",
          "SMS Notification",
          "Activity Log",
          "Report & Analytics",
          "Settings Management",
          "Profile Management",
          "Data Management Module",
          "Search & Filter System",
          "Custom CMS Section",
          "Secure API Development",
          "Database Setup",
          "Responsive Web Application",
          "Basic Security Setup",
          "Deployment Support"
        ],
      },
      {
        title: "Optional SaaS Features",
        description: "Advanced add-ons for platform scale",
        items: [
          "Multi-tenant System",
          "Trial System",
          "Invoice System",
          "Auto Renewal System",
          "Usage Tracking",
          "API Key Management",
          "Third-party Integration",
          "Advanced Analytics",
          "Export Report PDF / Excel"
        ],
      }
    ],
    techStack: {
      frontend: "Next.js",
      backend: "Node.js",
      database: "PostgreSQL",
      tools: ["Custom UI/UX", "Role Access Control", "Payment Gateway", "Subscription System", "Report PDF/Excel"],
    },
    pricing: {
      basePrice: 150000,
      taxRate: 0,
      discount: 0,
    },
    additionalServices: [
      {
        title: "Managed Hosting by Web Briks",
        price: 5000,
        billingCycle: "yearly",
        description: "Includes: Yearly Hosting, Server Setup, Website Deployment, Basic Server Maintenance, Hosting Managed by Our Team, Basic Security Monitoring",
      }
    ],
    workflow: [
      "Requirement Discussion",
      "Feature Finalization",
      "Quotation Approval",
      "Advance Payment",
      "UI/UX Design",
      "Design Review & Feedback",
      "Frontend Development",
      "Backend Development",
      "Admin Dashboard Development",
      "API & Integration Setup",
      "Testing & Quality Check",
      "Client Review",
      "Final Revision",
      "Website Deployment",
      "Project Handover",
      "90 Days Free Support"
    ],
  },

  "business-website": {
    details: {
      title: "Business / Corporate / Service Website",
      date: new Date().toISOString().split("T")[0],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
    overview: "Professional and high-performance business or corporate website, custom-designed to wow your visitors and generate leads.",
    phases: [
      {
        title: "Website Features",
        description: "Corporate website features and capabilities",
        items: [
          "Custom UI/UX Design",
          "Fully Responsive Website",
          "Homepage",
          "About Us Page",
          "Service Pages",
          "Service Details Page",
          "Portfolio / Project Showcase",
          "Team Section",
          "Testimonial Section",
          "Contact Form",
          "Google Map Integration",
          "Blog / News Section",
          "FAQ Section",
          "Inquiry Form",
          "Call-to-Action Section",
          "Social Media Links",
          "SEO Friendly Structure",
          "Speed Optimized Website",
          "Mobile Optimized Design",
          "Basic CMS System",
          "Admin Panel for Content Update",
          "Privacy Policy / Terms Pages",
          "Deployment Support"
        ],
      }
    ],
    techStack: {
      frontend: "Next.js",
      backend: "Node.js",
      database: "MongoDB",
      tools: ["Custom UI/UX", "Google Maps", "SEO Optimized", "Responsive Layout", "Contact Form"],
    },
    pricing: {
      basePrice: 35000,
      taxRate: 0,
      discount: 0,
    },
    additionalServices: [
      {
        title: "Managed Hosting by Web Briks",
        price: 5000,
        billingCycle: "yearly",
        description: "Includes: Yearly Hosting, Server Setup, Website Deployment, Basic Server Maintenance, Hosting Managed by Our Team, Basic Security Monitoring",
      }
    ],
    workflow: [
      "Requirement Discussion",
      "Feature Finalization",
      "Quotation Approval",
      "Advance Payment",
      "UI/UX Design",
      "Design Review & Feedback",
      "Frontend Development",
      "Backend Development",
      "Testing & Quality Check",
      "Client Review",
      "Final Revision",
      "Website Deployment",
      "Project Handover",
      "90 Days Free Support"
    ],
  },

  "landing-page": {
    details: {
      title: "High-Converting Landing Page",
      date: new Date().toISOString().split("T")[0],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
    overview: "High-converting single-page landing page setup to capture quality leads and drive direct user conversions.",
    phases: [
      {
        title: "Landing Page Features",
        description: "Landing page highlights and optimization",
        items: [
          "Custom UI/UX Design",
          "Responsive Landing Page",
          "Hero Section",
          "Product / Service Highlight Section",
          "Benefits Section",
          "Feature Section",
          "Offer / Pricing Section",
          "Testimonial Section",
          "FAQ Section",
          "Lead Capture Form",
          "WhatsApp / Call Button",
          "Strong Call-to-Action",
          "Social Proof Section",
          "Contact Section",
          "Fast Loading Page",
          "Mobile Optimized Design",
          "SEO Basic Setup",
          "Pixel Setup",
          "Conversion Tracking Setup",
          "Deployment Support"
        ],
      }
    ],
    techStack: {
      frontend: "Next.js",
      backend: "Node.js",
      database: "MongoDB",
      tools: ["Custom UI/UX", "WhatsApp/Call Button", "Pixel Tracking", "Conversion Optimization"],
    },
    pricing: {
      basePrice: 15000,
      taxRate: 0,
      discount: 0,
    },
    additionalServices: [
      {
        title: "Managed Hosting by Web Briks",
        price: 5000,
        billingCycle: "yearly",
        description: "Includes: Yearly Hosting, Server Setup, Website Deployment, Basic Server Maintenance, Hosting Managed by Our Team, Basic Security Monitoring",
      }
    ],
    workflow: [
      "Requirement Discussion",
      "Feature Finalization",
      "Quotation Approval",
      "Advance Payment",
      "UI/UX Design",
      "Design Review & Feedback",
      "Frontend Development",
      "Testing & Quality Check",
      "Client Review",
      "Final Revision",
      "Website Deployment",
      "Project Handover",
      "90 Days Free Support"
    ],
  }
};
