"use client";

import React from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

const images = [
  "/images/services/service1.png",
  "/images/services/service2.png",
  "/images/services/service3.png",
  "/images/services/service4.png",
  "/images/services/service5.png",
  "/images/services/service6.png",
  "/images/services/service7.png",
];

const ServiceHero = () => {
  const currentYear = 2026;

  return (
    <section className="relative w-full overflow-hidden flex items-center justify-center py-10 md:py-20 px-6">
      <div className="max-w-[1440px] mx-auto px-4 w-full grid grid-cols-1 lg:grid-cols-2 md:gap-16 items-center">
        <div className="absolute right-[-50px] top-[-2px] h-[360px] w-[576px] rounded-full bg-gradient-to-b from-[rgba(76,117,255,0.10)] to-[rgba(26,79,255,0.10)] blur-[60px]" />
        {/* --- LEFT SIDE CONTENT --- */}
        <div className="flex flex-col z-10 lg:order-1">
          {/* Badge */}
          <div className="w-fit flex items-center gap-2 mb-6 md:mb-8 p-1 pr-4 rounded-[5px] border border-[#3366FF] bg-black/20 backdrop-blur-sm">
            <div className="bg-[#4F1AD6] px-2 py-1 rounded-[3px] flex items-center justify-center">
              <span className="text-[12px] font-bold text-white leading-none tracking-[-0.5px]">
                {currentYear}
              </span>
            </div>
            <span className="text-[14px] md:text-[16px] font-bold text-white leading-[26px] tracking-[-0.5px]">
              Our Services
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-white text-[38px] sm:text-[48px] md:text-[60px] font-bold leading-[1.1] md:leading-[72px] tracking-[-1.8px] mb-6">
            Our Core Services
          </h1>

          {/* Description */}
          <p className="text-white/60 text-[18px] md:text-[24px] font-normal leading-[1.3] md:leading-[26px] tracking-[-0.2px]  mb-10">
            We create strategic digital solutions with modern design, seamless
            functionality, and impactful user experiences that help brands grow
            faster and stand out in a competitive market.
          </p>

          {/* Button */}
          <button className="group relative w-full sm:w-fit flex items-center justify-center gap-3 px-8 py-4 rounded-full text-white text-[20px] font-bold leading-[24px] bg-[linear-gradient(134deg,#9C46F4_1.15%,#6A25E0_17.12%,#390CA4_47.7%,#28048B_71.73%)] transition-transform hover:scale-105 active:scale-95">
            Start a Project
            <ArrowUpRight className="w-6 h-6 text-white group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </button>
        </div>

        {/* --- RIGHT SIDE VISUAL --- */}
        <div className="relative flex items-center justify-center lg:justify-end lg:order-2 h-[450px] md:h-[550px]">
          
          {/* Scaling wrapper for mobile responsiveness */}
          <div className="relative scale-[0.7] sm:scale-[0.85] md:scale-100 transition-transform duration-500">
            
            {/* Background Rotated Card */}
            <div
              className="absolute w-[326px] h-[375px] border border-white/10 bg-white/[0.05] backdrop-blur-[12px] rounded-[24px] -translate-x-8"
              style={{ transform: "rotate(-10.84deg)" }}
            />

            {/* Main Slider Container (Fixed Border/Glass) */}
            <div className="relative z-10 w-[337px] h-[378px] rounded-[24px] border border-white/20 shadow-[0_0_4px_0_#7E69CE] backdrop-blur-[12px] overflow-hidden bg-[#1a1a1a]">
              
              {/* Moving Images (NO OPACITY CHANGE) */}
              {images.map((img, index) => (
                <motion.div
                  key={index}
                  initial={{ x: "100%" }}
                  animate={{
                    x: ["100%", "0%", "-100%"],
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    delay: index * 3,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-0 w-full h-full"
                >
                  <Image
                    src={img}
                    alt={`Service slide ${index + 1}`}
                    fill
                    sizes="337px"
                    className="object-cover"
                    priority={index === 0}
                  />
                </motion.div>
              ))}
            </div>

            {/* Floating Pen Icon (Positioned per screenshot - Left Edge) */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -left-10 bottom-[25%] z-30 p-4 rounded-full border border-yellow-500/50 bg-yellow-500/10 backdrop-blur-[8px] flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.2)]"
            >
              <Image
                src="/images/services/icon1.svg"
                alt="Pen Icon"
                width={28}
                height={28}
                className="drop-shadow-lg"
              />
            </motion.div>

            {/* Floating Chart Icon (Positioned per screenshot - Right Edge) */}
            <motion.div
              animate={{ y: [0, 15, 0] }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
              className="absolute -right-8 top-[15%] z-30 p-4 rounded-xl border border-[#3366FF] bg-white/10 backdrop-blur-[8px] flex items-center justify-center shadow-lg"
            >
              <Image
                src="/images/services/icon2.svg"
                alt="Chart Icon"
                width={28}
                height={28}
              />
            </motion.div>

            {/* Decorative Glow Background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#4F1AD6]/20 blur-[120px] -z-10 rounded-full" />
          </div>
        </div>

      </div>
    </section>
  );
};

export default ServiceHero;