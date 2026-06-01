"use client";

import React from "react";
import Image from "next/image";
import { motion, Variants } from "framer-motion";
import { Star, Zap, Layout, LifeBuoy, TrendingUp, Search } from "lucide-react";
import SectionHeader from "@/components/SectionHeader/SectionHeader";

const comparisonData = [
  {
    other: "Experienced team delivering standard solutions.",
    webbriks: "Highly skilled specialists delivering customized solutions.",
    iconOther: Star,
    iconWeb: Zap,
  },
  {
    other: "Offers standard, template-based designs.",
    webbriks: "Offers innovative, custom website designs.",
    iconOther: Layout,
    iconWeb: Layout,
  },
  {
    other: "Limited post-launch support and updates.",
    webbriks: "Comprehensive post-launch support and updates.",
    iconOther: LifeBuoy,
    iconWeb: LifeBuoy,
  },
  {
    other: "Basic performance with average loading times.",
    webbriks: "Optimal performance with fast loading times.",
    iconOther: TrendingUp,
    iconWeb: TrendingUp,
  },
  {
    other: "Basic SEO practices implemented.",
    webbriks: "Advanced SEO tactics for enhanced online visibility.",
    iconOther: Search,
    iconWeb: Search,
  },
];

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const Choosing = () => {
  return (
    <section className="bg-[#01050A] pb-20 overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-4">
        <SectionHeader
          title="Choosing Webbriks Over Others"
          description="See why Webbriks stands out with superior service, innovation, and client satisfaction benchmarks."
        />

        <div className="rounded-[40px] bg-[radial-gradient(100%_100%_at_50%_0%,#00020F80_65.75%,#00041F80_100%)] pt-5 border border-[#0510589d] pb-10">
          {/* Top Header Row */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="flex items-center justify-between mt-16 mb-10 max-w-[1200px] mx-auto px-6 "
          >
            <div className="w-1/3 flex justify-center md:justify-start">
              <h3 className="text-white text-[24px] md:text-[30px] font-bold leading-[36px] font-redrose text-center md:text-left">
                Other Agencies
              </h3>
            </div>

            <div className="relative flex items-center justify-center w-[54px] h-[54px] rounded-full border border-[#161C44] z-10 shrink-0 mx-4 overflow-hidden">
              <div
                className="absolute inset-0 opacity-100"
                style={{
                  background:
                    "radial-gradient(356.25% 356.25% at 50% -167.5%, #003BFF 0%, rgba(0, 59, 255, 0) 75%), radial-gradient(362.5% 362.5% at 50% -171.32%, rgba(0, 59, 255, 0.3) 0%, rgba(0, 59, 255, 0) 75%)",
                }}
              />
              <span className="relative text-white text-[12px] font-bold font-redrose">
                V/S
              </span>
            </div>

            <div className="w-1/3 flex justify-center md:justify-end">
              <Image
                src="/wb-logo.png"
                alt="Webbriks Logo"
                width={160}
                height={45}
                className="object-contain"
              />
            </div>
          </motion.div>

          {/* Unified Comparison List */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="flex flex-col gap-5 max-w-[1200px] mx-auto"
          >
            {comparisonData.map((item, idx) => (
              <motion.div
                key={idx}
                variants={fadeInUp}
                className="group relative flex flex-col md:flex-row items-stretch w-full min-h-[80px] rounded-[16px] border border-white/5 bg-[#00020F] overflow-hidden"
              >
                {/* --- LEFT SIDE: GRID TEXTURE & OTHER CONTENT --- */}
                <div className="relative flex-1 flex items-center px-6 py-6 md:py-0 overflow-hidden">
                  {/* Full-width Left Texture (diagonal lines) */}
                  <div
                    className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{
                      backgroundImage: `repeating-linear-gradient(-45deg, #A7ADBE 0, #A7ADBE 1px, transparent 1px, transparent 10px)`,
                      backgroundSize: "15px 15px",
                      maskImage:
                        "linear-gradient(to right, black 70%, transparent 100%)",
                      WebkitMaskImage:
                        "linear-gradient(to right, black 70%, transparent 100%)",
                    }}
                  />
                  <div className="relative z-10 flex items-center gap-4">
                    <item.iconOther className="text-[#A7ADBE] w-5 h-5 shrink-0" />
                    <p className="text-[#A7ADBE] text-[17px] md:text-[18px] font-medium leading-[27px] font-redrose">
                      {item.other}
                    </p>
                  </div>
                </div>

                {/* --- CENTER DIVIDER (Optional for V/S alignment) --- */}
                <div className="hidden md:flex w-[70px] shrink-0 items-center justify-center relative">
                  <div className="w-[1px] h-1/2 bg-white/5" />
                </div>

                {/* --- RIGHT SIDE: WEBBRIKS CONTENT --- */}
                <div className="relative flex-1 flex items-center px-6 py-6 md:py-0 bg-[#00041F]/40 overflow-hidden">
                  {/* Webbriks Side Blue Glow */}
                  <div
                    className="absolute inset-y-0 left-0 w-full opacity-100 pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(51, 99, 255, 0.12) 0%, rgba(51, 99, 255, 0) 100%)",
                      filter: "blur(4px)",
                    }}
                  />

                  {/* Blue Indicator Bar */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-[#3362FF] rounded-[42px]" />

                  <div className="relative z-10 flex items-center gap-4">
                    <item.iconWeb className="text-[#3362FF] w-5 h-5 shrink-0" />
                    <p className="text-[#C4C8D4] text-[16px] md:text-[17px] font-semibold leading-[27px] font-redrose">
                      {item.webbriks}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Choosing;
