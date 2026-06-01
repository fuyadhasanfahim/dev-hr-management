"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";

const videoCards = [
  { id: 1, src: "/videos/project1.mp4", delay: 0 },
  { id: 2, src: "/videos/project2.mp4", delay: 0.2 },
  { id: 3, src: "/videos/project3.mp4", delay: 0.4 },
  { id: 4, src: "/videos/project4.mp4", delay: 0.1 },
  { id: 5, src: "/videos/project5.mp4", delay: 0.3 },
  { id: 6, src: "/videos/project6.mp4", delay: 0.5 }, // Added 6th for the 3-col grid
];

const PortfolioHero = () => {
  const currentYear = new Date().getFullYear();

  return (
    <section className="relative w-full  min-h-screen flex items-center pt-10 pb-10 overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-4 w-full grid grid-cols-1 xl:grid-cols-[1fr_1.5fr] gap-12 lg:gap-16 items-center">
        
        {/* --- LEFT CONTENT --- */}
        <div className="flex flex-col items-start z-10">
          {/* Badge */}
          <div className="flex items-center gap-2 mb-8 p-1 pr-4 rounded-[5px] border border-[#3366FF] bg-black/20 backdrop-blur-sm">
            <div className="bg-[#4F1AD6] px-2 py-1 rounded-[3px] flex items-center justify-center">
              <span className="text-[12px] font-bold text-white leading-none tracking-[-0.5px]">
                {currentYear}
              </span>
            </div>
            <span className="text-[16px] font-bold text-white leading-[26px] tracking-[-0.5px]">
              Browse Our Work
            </span>
          </div>

          {/* Main Title */}
          <h1 className="text-white text-[42px] md:text-[60px] font-bold leading-[1.1] md:leading-[68px] tracking-[-0.8px] mb-6">
            Explore Our Most <br /> Remarkable Projects.
          </h1>

          {/* Description */}
          <p className="text-white/60 text-[20px] md:text-[24px] font-normal leading-[1.2] md:leading-[26px] tracking-[-0.2px] max-w-[580px] mb-10">
            We craft customized solutions that empower both startups and
            established brands, driving success and delivering real impact.
          </p>

          {/* CTA Button */}
          <Link href="/contact">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3.5 rounded-[10px] text-white text-[16px] font-bold leading-[26px] tracking-[-0.5px] shadow-lg transition-all"
              style={{
                background: "linear-gradient(180deg, #4F1AD6 0%, #8059E3 100%)",
              }}
            >
              Build Your Product
            </motion.button>
          </Link>
        </div>

        {/* --- RIGHT CARDS GRID (3-Column Layout) --- */}
        <div className="relative h-fit py-10 flex items-center justify-center">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-6 w-full max-w-[850px]">
            
            {/* Column 1: Stays high */}
            <div className="flex flex-col gap-4 md:gap-6 lg:mt-[-20px]">
              <FloatingCard src={videoCards[0].src} delay={0} />
              <FloatingCard src={videoCards[3].src} delay={0.15} />
            </div>

            {/* Column 2: Shifted down for staggered look */}
            <div className="flex flex-col gap-4 md:gap-6 lg:mt-[40px]">
              <FloatingCard src={videoCards[1].src} delay={0.3} />
              <FloatingCard src={videoCards[4].src} delay={0.45} />
            </div>

            {/* Column 3: Stays middle (Hidden on mobile grid-cols-2) */}
            <div className="hidden sm:flex flex-col gap-4 md:gap-6 lg:mt-[-10px]">
              <FloatingCard src={videoCards[2].src} delay={0.6} />
              <FloatingCard src={videoCards[5].src} delay={0.75} />
            </div>
          </div>

          {/* Background Ambient Glow */}
          <div className="absolute inset-0 bg-[#3366FF]/10 blur-[150px] rounded-full z-0 pointer-events-none" />
        </div>
      </div>
    </section>
  );
};

/* --- SUB-COMPONENT: FLOATING CARD --- */
const FloatingCard = ({ 
  src, 
  delay, 
  className = "" 
}: { 
  src: string; 
  delay: number; 
  className?: string 
}) => {
  return (
    <motion.div
      initial={{ y: 0 }}
      transition={{
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut",
        delay: delay,
      }}
      className={`relative w-full aspect-[4/5] rounded-[24px] border border-[#3366FF] bg-[#111827] overflow-hidden shadow-[0_0_15px_0_#7E69CE] z-10 ${className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover opacity-90 transition-opacity"
      >
        <source src={src} type="video/mp4" />
      </video>
      
      {/* Subtle overlay to match the screenshot color depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
    </motion.div>
  );
};

export default PortfolioHero;