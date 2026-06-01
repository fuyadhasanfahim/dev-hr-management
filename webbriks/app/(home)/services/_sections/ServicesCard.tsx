"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Check, ArrowUpRight } from "lucide-react";

// --- DATA CONFIGURATION ---
const servicesData = [
  {
    id: "01",
    title: "Web Design & Development",
    description:
      "Crafting modern, high-performing websites with seamless design, smooth functionality, and user-focused experiences that help brands grow, engage, and stand out digitally.",
    features: [
      "Custom UI/UX Design",
      "SEO Optimized",
      "Performance Optimization",
      "Responsive Layout",
      "Modern Web Development",
      "Brand-Focused Digital Solutions",
    ],
    tools: [
      "/images/services/figma.svg",
      "/images/services/nextjs.svg",
      "/images/services/nodejs.svg",
      "/images/services/react.svg",
      "/images/services/prisma.svg",
      "/images/services/docker.svg",
      "/images/services/js.svg",
    ],
    mainImage: "/images/services/web-dev-preview.png",
  },
  {
    id: "02",
    title: "Software Development",
    description:
      "Building scalable, high-performing software solutions with clean architecture, modern technologies, and seamless user experiences that help businesses grow faster and operate smarter.",
    features: [
      "Custom UI/UX Design",
      "Inventory Management System",
      "Multi-Vendor E-commerce",
      "POS & Billing System",
      "Hospital Management System",
      "HR & Payroll Management",
    ],
    tools: [
      "/images/services/figma.svg",
      "/images/services/nextjs.svg",
      "/images/services/nodejs.svg",
      "/images/services/react.svg",
      "/images/services/prisma.svg",
      "/images/services/docker.svg",
      "/images/services/js.svg",
    ],
    mainImage: "/images/services/service-software.png",
  },
  {
    id: "03",
    title: "End to End E-commerce Solution",
    description:
      "Powerful tools and technologies combined to build, manage, scale, and optimize your complete e-commerce journey from design and development to payments, marketing, and growth.",
    features: [
      "Marketing & Conversion Setup",
      "Maintenance & Growth Support",
      "Customer Support System",
      "Analytics & Performance Tracking",
      "SEO Optimization",
      "Payment Gateway Integration",
    ],
    tools: [
      "/images/services/figma.svg",
      "/images/services/nextjs.svg",
      "/images/services/nodejs.svg",
      "/images/services/react.svg",
      "/images/services/prisma.svg",
      "/images/services/docker.svg",
      "/images/services/js.svg",
    ],
    mainImage: "/images/services/service-ecommerce.png",
  },
];

// --- SUB-COMPONENT: INDIVIDUAL CARD ---
const ServicesCard = ({
  id,
  title,
  description,
  features,
  tools,
  mainImage,
}: any) => {
  return (
    <div className=" overflow-hidden rounded-[32px] border border-[#36F] bg-[#030A1A] shadow-[0_0_30px_0_#7E69CE] grid grid-cols-1 lg:grid-cols-2 min-h-[550px]">
      {/* --- DECORATIVE TOP-RIGHT GRADIENT (Corrected to 486px) --- */}

      {/* --- LEFT SIDE: CONTENT --- */}
      <div className="p-8 md:p-12 flex flex-col z-10 relative">
        {/* Badge with Two-Layer Border */}
        <div className="mb-8 w-fit p-[1.5px] rounded-[16px] bg-[#36F]">
          <div className="px-5 py-2 rounded-[15px] flex items-center justify-center bg-[linear-gradient(134deg,#9C46F4_1.15%,#6A25E0_17.12%,#390CA4_47.7%,#28048B_71.73%)]">
            <span className="text-white text-[16px] font-bold leading-[24px]">
              {id}
            </span>
          </div>
        </div>
        <div
          className="absolute top-0 right-24 w-[486px] h-[486px] rounded-bl-full pointer-events-none blur-[60px] z-0 translate-x-20 -translate-y-20"
          style={{
            background:
              "linear-gradient(134deg, rgba(156, 70, 244, 0.40) 1.15%, rgba(106, 37, 224, 0.40) 17.12%, rgba(57, 12, 164, 0.40) 47.7%, rgba(40, 4, 139, 0.40) 71.73%)",
          }}
        />
        <h2 className="text-white text-[33px] font-bold leading-[40px] tracking-[-0.9px] mb-4">
          {title}
        </h2>

        <p className="text-white/70 text-[16px] font-normal leading-[26px] mb-8 max-w-[500px]">
          {description}
        </p>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6 mb-10">
          {features.map((feature: string, idx: number) => (
            <div key={idx} className="flex items-center gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-[linear-gradient(180deg,#36F_0%,#FFF_50%,#3872F4_100%)]">
                <Check className="w-3 h-3 text-[#030A1A] stroke-[4px]" />
              </div>
              <span className="text-white/70 text-[14px] font-normal leading-[20px]">
                {feature}
              </span>
            </div>
          ))}
        </div>

        {/* Tools Section */}
        <div className="mt-auto">
          <h4 className="text-white/70 text-[12px] font-bold uppercase tracking-wider mb-4">
            Tools We Use
          </h4>
          <div className="flex flex-wrap gap-3">
            {tools.map((tool: string, idx: number) => (
              <div
                key={idx}
                className="w-[38px] h-[38px] rounded-full border border-white/30 flex items-center justify-center bg-[linear-gradient(134deg,#9C46F4_1.15%,#6A25E0_17.12%,#390CA4_47.7%,#28048B_71.73%)] transition-transform hover:scale-110"
              >
                <div className="relative w-[22px] h-[22px]">
                  <Image
                    src={tool}
                    alt="Tool icon"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- RIGHT SIDE: IMAGE & HOVER OVERLAY --- */}
      <div className="relative group overflow-hidden h-full min-h-[450px]">
        <Image
          src={mainImage}
          alt={title}
          fill
          className="object-cover transition-transform duration-1000 group-hover:scale-105"
        />

        {/* Hover Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          className="absolute inset-0 z-20 flex items-center justify-center p-4"
        >
          {/* Blurred Background Overlay with user color specs */}
          <div className="absolute inset-0 bg-[#26135B]/30 backdrop-blur-[2.5px]" />

          {/* CTA Button */}
          <motion.button
            initial={{ scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.05 }}
            className="relative z-30 flex items-center gap-3 px-8 py-4 rounded-[100px] border border-[#36F] bg-[linear-gradient(134deg,#9C46F4_1.15%,#6A25E0_17.12%,#390CA4_47.7%,#28048B_71.73%)] shadow-[0_0_40px_0_#7E69CE]"
          >
            <span className="text-white text-[18px] font-bold leading-[27px]">
              View Full Details
            </span>
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-white" />
            </div>
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

// --- MAIN PAGE SECTION ---
const ServicesSection = () => {
  return (
    <section className="bg-[#050505] pb-20">
      <div className="max-w-[1440px] mx-auto px-4 flex flex-col gap-10">
        {servicesData.map((service) => (
          <ServicesCard key={service.id} {...service} />
        ))}
      </div>
    </section>
  );
};

export default ServicesSection;
