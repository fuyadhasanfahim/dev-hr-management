"use client";

import React from "react";
import { motion } from "framer-motion";
import { Flame, Globe } from "lucide-react"; // Using Lucide as a placeholder for the icon

const brands = [
  "Trenzobd.com",
  "Wildbd.com",
  "CatalystAdvisory.co",
  "Stylezon.bd",
  "AestheticPixelStudio.com",
  "WomenVoicebd.com",
  "DoDesignly.com",
];

const MarqueeRow = ({ 
  items, 
  direction = "left" 
}: { 
  items: string[], 
  direction?: "left" | "right" 
}) => {
  // We double the items to ensure there's no gap during the infinite loop
  const duplicatedItems = [...items, ...items, ...items];

  return (
    <div className="flex overflow-hidden select-none">
      <motion.div
        initial={{ x: direction === "left" ? 0 : "-50%" }}
        animate={{ x: direction === "left" ? "-50%" : 0 }}
        transition={{
          duration: 60, // Adjust for speed
          ease: "linear",
          repeat: Infinity,
        }}
        className="flex flex-nowrap gap-6 py-2"
      >
        {duplicatedItems.map((brand, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 px-8 py-3 rounded-[100px] bg-[#000529] border border-white/5 whitespace-nowrap"
          >
            <Flame size={20} className="text-[#3362FF]" />
            <span className="text-[#F0F1F4] text-[18px] font-bold leading-[27px] font-redrose">
              {brand}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

const TrustedBrands = () => {
  return (
    <section className="w-full bg-[#01050A] py-20 overflow-hidden">
      {/* Section Header with Gradient Lines */}
      <div className="max-w-[1440px] mx-auto px-4 mb-12 flex items-center justify-center gap-6">
        {/* Left Line */}
        <div 
          className="h-[1px] flex-1" 
          style={{ 
            background: "linear-gradient(270deg, #0E122E 0%, rgba(26, 75, 255, 0.30) 13.51%, rgba(26, 75, 255, 0.00) 100%)" 
          }} 
        />
        
        <h2 className="text-white text-[20px] font-bold leading-[30px] font-redrose whitespace-nowrap text-center">
          Trusted by Leading Brands
        </h2>

        {/* Right Line (Flipped) */}
        <div 
          className="h-[1px] flex-1 rotate-180" 
          style={{ 
            background: "linear-gradient(270deg, #0E122E 0%, rgba(26, 75, 255, 0.30) 13.51%, rgba(26, 75, 255, 0.00) 100%)" 
          }} 
        />
      </div>

      {/* Marquee Rows Container */}
      <div className="flex flex-col gap-6 w-full">
        {/* Row 1: Left to Right */}
        <MarqueeRow items={brands} direction="right" />
        
        {/* Row 2: Right to Left (Reverse) */}
        <MarqueeRow items={brands} direction="left" />
      </div>
    </section>
  );
};

export default TrustedBrands;