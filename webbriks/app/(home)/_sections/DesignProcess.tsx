"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import { Star, Pencil, Code2, Rocket } from "lucide-react";
import SectionHeader from "@/components/SectionHeader/SectionHeader";

// 1. Process Data
const processPhases = [
  {
    id: "01",
    title: "Discovery Phase",
    description: "Understanding your brand, objectives, and target audience to define project goals.",
    icon: <Star size={20} fill="white" />,
  },
  {
    id: "02",
    title: "Design Concept",
    description: "Creating initial design concepts based on insights gathered during the discovery phase.",
    icon: <Pencil size={20} fill="white" />,
  },
  {
    id: "03",
    title: "Development & Testing",
    description: "Building and refining the website, ensuring functionality and compatibility across devices.",
    icon: <Code2 size={20} />,
  },
  {
    id: "04",
    title: "Launch & Support",
    description: "Deploying the finalized website and providing ongoing support to ensure long-term success.",
    icon: <Rocket size={20} fill="white" />,
  },
];

// 2. Animation Variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const DesignProcess = () => {
  return (
    <section className="bg-[#01050A] py-20 px-4 overflow-hidden">
      <div className="max-w-[1440px] mx-auto">
        <SectionHeader
          title="Our Design Process"
          description="Explore our streamlined approach to creating bespoke websites that align with your goals."
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12"
        >
          {processPhases.map((phase) => (
            <motion.div
              key={phase.id}
              variants={cardVariants}
              className="relative group rounded-[20px] p-8 md:p-10 border border-[#923ff077] overflow-hidden"
              style={{
                background: "linear-gradient(257deg, rgba(153, 41, 219, 0.20) 6.55%, rgba(82, 22, 117, 0.00) 33.56%), #00020F",
              }}
            >
              {/* --- Background Grid Texture (Left Side) --- */}
              <div
                className="absolute left-0 top-0 w-[40%] h-full z-0 pointer-events-none"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, #B5D3FD1A 1px, transparent 1px), 
                    linear-gradient(to bottom, #B5D3FD1A 1px, transparent 1px)
                  `,
                  backgroundSize: "24px 24px",
                  maskImage: "linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
                  WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
                }}
              />

              {/* --- Background Grid Texture (Right Side) --- */}
              <div
                className="absolute right-0 top-0 w-[40%] h-full z-0 pointer-events-none"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, #B5D3FD1A 1px, transparent 1px), 
                    linear-gradient(to bottom, #B5D3FD1A 1px, transparent 1px)
                  `,
                  backgroundSize: "24px 24px",
                  maskImage: "linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
                  WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
                }}
              />

              <div className="relative z-10 flex flex-col h-full">
                {/* Header: Icon & Step Badge */}
                <div className="flex items-center justify-between mb-8">
                  {/* Icon Box */}
                  <div
                    className="w-12 h-12 rounded-[12px] flex items-center justify-center text-white"
                    style={{
                      background: "linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)",
                    }}
                  >
                    {phase.icon}
                  </div>

                  {/* Step Badge with Gradient Border (AQ) */}
                  <div className="relative p-[1px] rounded-full overflow-hidden shadow-lg">
                    {/* Border Layer */}
                    <div 
                      className="absolute inset-0" 
                      style={{ background: "linear-gradient(180deg, #36F 0%, #FFF 50%, #3872F4 100%)" }}
                    />
                    {/* Content Layer */}
                    <div className="relative bg-[#00020F] px-5 py-1.5 rounded-full">
                      <span className="text-[#E1E3E9] text-[16px] font-medium leading-[24px] font-redrose">
                        Step {phase.id}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Text Content */}
                <h3 className="text-white text-[18px] font-semibold leading-[27px] font-redrose mb-3 transition-colors group-hover:text-[#9C46F4]">
                  {phase.title}
                </h3>
                <p className="text-[#A7ADBE] text-[18px] font-normal leading-[27px] font-redrose max-w-[450px]">
                  {phase.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default DesignProcess;