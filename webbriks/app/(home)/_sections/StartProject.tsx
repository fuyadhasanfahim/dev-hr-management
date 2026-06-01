"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import { Check } from "lucide-react";

// Animation Variants
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.6, ease: "easeOut" } 
  },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const features = [
  "Customized design",
  "Ongoing support",
  "Fast delivery"
];

const StartProject = () => {
  return (
    <section className="bg-[#01050A] py-20 px-4">
      <div className="max-w-[1440px] mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeInUp}
          className="relative rounded-[24px] border border-[#131839] bg-[#020515] py-16 md:py-24 px-6 md:px-12 overflow-hidden"
        >
          {/* Background subtle glow */}
          <div 
            className="absolute inset-0 z-0 pointer-events-none opacity-20"
            style={{
              background: "radial-gradient(circle at 50% 50%, #3362FF 0%, transparent 70%)"
            }}
          />

          <div className="relative z-10 flex flex-col items-center text-center max-w-[800px] mx-auto">
            {/* Heading */}
            <h2 className="text-white text-[32px] md:text-[42px] font-bold leading-tight md:leading-[50.4px] font-redrose mb-6">
              Start Your Project
            </h2>

            {/* Description */}
            <p className="text-[#6D7792] text-[16px] md:text-[18px] font-medium leading-relaxed md:leading-[27px] font-redrose mb-10 max-w-[650px]">
              Contact us today to start crafting your exceptional and customized website solution.
            </p>

            {/* Features List */}
            <motion.div 
              variants={staggerContainer}
              className="flex flex-wrap justify-center gap-4 md:gap-6 mb-12"
            >
              {features.map((feature, idx) => (
                <motion.div 
                  key={idx}
                  variants={fadeInUp}
                  className="flex items-center gap-3 px-5 py-2.5 rounded-full border border-white/5 bg-white/[0.02]"
                >
                  <div 
                    className="flex items-center justify-center w-5 h-5 rounded-full"
                    style={{
                      background: "linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)"
                    }}
                  >
                    <Check size={12} className="text-white" strokeWidth={3} />
                  </div>
                  <span className="text-[#C4C8D4] text-[14px] md:text-[16px] font-medium leading-none font-redrose">
                    {feature}
                  </span>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-10 py-4 rounded-full text-white text-[18px] font-bold leading-[27px] font-redrose shadow-lg"
              style={{
                background: "linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)"
              }}
            >
              Start a Project
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default StartProject;