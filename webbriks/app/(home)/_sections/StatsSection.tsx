"use client";

import React from "react";
import { motion, Variants } from "framer-motion";

const statsData = [
  { value: "213+", label: "Happy Customers" },
  { value: "52+", label: "Projects Completed" },
  { value: "12+", label: "Years of Experience" },
  { value: "148+", label: "Team Members" },
];

// Animation Variants
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

const StatsSection = () => {
  return (
    <section className="bg-[#01050A] py-20 px-4 overflow-hidden">
      <div className="max-w-[1440px] mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {statsData.map((stat, index) => (
            <motion.div
              key={index}
              variants={cardVariants}
              className="relative group rounded-[20px] border border-[#131839] bg-[#01050A] py-12 px-6 flex flex-col items-center justify-center overflow-hidden transition-colors hover:border-[#1a2350]"
            >
              {/* --- Lighting Effect with Grid Texture --- */}
              <div 
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                  background: "radial-gradient(46.22% 100.89% at 50.91% -0.89%, rgba(51, 98, 255, 0.20) 0%, rgba(0, 2, 15, 0.00) 100%)"
                }}
              >
                {/* Grid texture visible ONLY inside the lighting effect area using mask */}
                <div 
                  className="absolute inset-0 opacity-100"
                  style={{
                    backgroundImage: `linear-gradient(to right, #131839 1px, transparent 1px), linear-gradient(to bottom, #131839 1px, transparent 1px)`,
                    backgroundSize: "20px 20px",
                    maskImage: "radial-gradient(46.22% 100.89% at 50.91% -0.89%, black 0%, transparent 100%)",
                    WebkitMaskImage: "radial-gradient(46.22% 100.89% at 50.91% -0.89%, black 0%, transparent 100%)",
                  }}
                />
              </div>

              {/* --- Blue Accent Top Bar --- */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-[2px] bg-[#3362FF] rounded-b-full shadow-[0_0_10px_#3362FF]" />

              {/* --- Content --- */}
              <div className="relative z-10 text-center">
                <h2 className="text-[#F0F1F4] text-[45px] font-bold leading-normal font-redrose mb-2">
                  {stat.value}
                </h2>
                <p className="text-[#A7ADBE] text-[18px] font-bold leading-[27px] font-redrose uppercase tracking-wide">
                  {stat.label}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default StatsSection;