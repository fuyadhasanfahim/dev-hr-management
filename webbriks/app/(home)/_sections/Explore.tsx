"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { CheckCircle2, ArrowRight } from "lucide-react";

const services = [
  {
    id: "01",
    title: "Web Design & Development",
    description:
      "We design intuitive interfaces and seamless user experiences that enhance usability and keep your audience engaged. Creating powerful branding that captures attention.",
    features: [
      "Custom UI/UX Design",
      "Responsive Layouts",
      "SEO Optimized",
      "CMS Integration",
    ],
    image: "/images/explore/web-development.png",
  },
  {
    id: "02",
    title: "Software Development",
    description:
      "Robust and scalable software solutions built for performance and growth. From custom SaaS platforms to seamless API integrations and enterprise CRM tools.",
    features: [
      "Custom SaaS Solutions",
      "API Development",
      "Cloud Infrastructure",
      "Enterprise ERP/CRM",
    ],
    image: "/images/explore/software-development.png",
  },
  {
    id: "03",
    title: "End to End E-commerce",
    description:
      "Complete eCommerce solutions that scale with your business. We build secure payment gateways, inventory management systems, and multi-vendor marketplaces.",
    features: [
      "Multi-vendor Platforms",
      "Secure Payments",
      "Inventory Systems",
      "Cart Optimization",
    ],
    image: "/images/explore/end-to-end.png",
  },
];

const Explore = () => {
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile to disable heavy animations
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Simplified variants for mobile to stop flickering
  const fadeInUp: Variants = {
    hidden: { opacity: 0, y: isMobile ? 0 : 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: isMobile ? 0 : 0.1 },
    },
  };

  return (
    <div className="bg-[#01050A] text-white font-sans overflow-x-hidden">
      {/* Header Section */}
      <section className="relative w-full flex items-center justify-center overflow-hidden py-10 md:py-20">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <Image
            src="/images/explore/explore-bg.svg"
            alt=""
            fill
            priority
            className="object-cover object-center opacity-60"
          />
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={fadeInUp}
          className="relative z-10 w-full max-w-[1440px] mx-auto px-4 text-center"
        >
          <h2 className="text-white text-3xl md:text-[42px] font-bold leading-tight md:leading-[50.4px] mb-4">
            Explore Our Core Services
          </h2>
          <p className="text-[#A7ADBE] text-base md:text-[18px] font-medium leading-relaxed md:leading-[27px] max-w-[600px] mx-auto">
            Discover our comprehensive range of services tailored to enhance
            your digital presence.
          </p>
        </motion.div>
      </section>

      {/* Services Cards Section */}
      <section className="pb-10 px-4 mt-6 md:mt-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.05 }}
          variants={staggerContainer}
          className="max-w-[1440px] mx-auto flex flex-col gap-6"
        >
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} isMobile={isMobile} />
          ))}
        </motion.div>
      </section>
    </div>
  );
};

const ServiceCard = ({ service, isMobile }: { service: any; isMobile: boolean }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: isMobile ? 10 : 30 },
        visible: { opacity: 1, y: 0 },
      }}
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
      className="group relative w-full rounded-[24px] border-t border-white/20 overflow-hidden backdrop-blur-[2px] bg-white/[0.02] hover:bg-[#030A1A]/80 transition-all duration-500"
    >
      {/* Optimized Purple Glow: Reduced opacity on mobile to prevent GPU lag */}
      <div 
        className="absolute right-[-10%] top-[-20%] w-[600px] md:w-[800px] h-[600px] md:h-[800px] rounded-full bg-[#9929DB] opacity-[0.07] md:opacity-15 blur-[120px] md:blur-[250px] pointer-events-none z-0" 
        style={{ transform: "translateZ(0)" }}
      />

      <div className="relative z-10 p-6 md:p-12 flex flex-col lg:flex-row items-center justify-between gap-8">
        <div className="flex-1 flex flex-col md:flex-row gap-6 md:gap-10 w-full">
          {/* Service ID */}
          <div className="relative inline-block h-fit">
            {!isMobile && (
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute left-[-6px] top-[-8px] w-full h-full bg-[#9929DB] blur-[40px] z-0"
                  />
                )}
              </AnimatePresence>
            )}
            <span
              className={`relative z-10 text-[40px] md:text-[47.4px] font-bold leading-none transition-colors duration-300 ${
                isHovered && !isMobile ? "text-[#1A4FFF]" : "text-white/10"
              }`}
            >
              {service.id}
            </span>
          </div>

          <div className="flex flex-col gap-6 w-full max-w-[650px]">
            <div>
              <h3 className="text-white text-2xl md:text-[35.6px] font-bold leading-tight md:leading-[40px] mb-4">
                {service.title}
              </h3>
              <p className="text-[#9CA3AF] text-[14px] leading-relaxed">
                {service.description}
              </p>
            </div>

            {/* Mobile Image: Static on mobile to prevent flickering */}
            <div className="lg:hidden relative w-full aspect-video rounded-[16px] overflow-hidden border border-white/10">
              <Image
                src={service.image}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#01050A]/60 to-transparent" />
            </div>

            {/* Features Grid: Instant on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8">
              {service.features.map((feature: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#4C75FF] shrink-0" />
                  <span className="text-[#D1D5DB] text-[13px]">
                    {feature}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 mt-2">
              <button className="px-6 py-2.5 rounded-[5px] text-white text-[13px] font-semibold bg-gradient-to-br from-[#9C46F4] to-[#28048B] hover:brightness-110 active:scale-95 transition-all">
                Get Quotation
              </button>
              <button className="px-6 py-2.5 rounded-[5px] text-white text-[13px] font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
                Learn More
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Only Area */}
        <div className="relative hidden lg:flex items-center gap-8 min-h-[260px]">
          <div className="w-[380px] xl:w-[420px] h-[260px] overflow-hidden relative">
            <AnimatePresence mode="wait">
              {isHovered && (
                <motion.div
                  key={service.id}
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="absolute inset-0 rounded-[16px] overflow-hidden border border-white/10"
                >
                  <Image
                    src={service.image}
                    alt=""
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#01050A]/40 to-transparent" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.div
            className="flex-shrink-0 w-[60px] h-[60px] rounded-full border border-white/40 flex items-center justify-center bg-[#1A4FFF] cursor-pointer"
            whileHover={{ scale: 1.1, backgroundColor: "#2563eb" }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              animate={{ rotate: isHovered ? -45 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <ArrowRight size={24} className="text-white" />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default Explore;