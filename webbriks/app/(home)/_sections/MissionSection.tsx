"use client";

import React from "react";
import Image from "next/image";
import { motion, Variants } from "framer-motion";

// Animation Variants
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.8, ease: "easeOut" } 
  },
};

const MissionSection = () => {
  return (
    <section className="bg-[#01050A] py-20 px-4 overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-4">
        {/* --- Two-Layer Border Approach --- */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeInUp}
          className="relative p-1.5 rounded-[35px] overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #3366FF 0%, #FFFFFF 50%, #3872F4 100%)",
          }}
        >
          {/* Inner Content Layer */}
          <div className="relative rounded-[34px] overflow-hidden bg-[#020515] py-24 md:py-32 px-6">
            
            {/* Background Image Layer */}
            <div className="absolute inset-0 z-0">
              <Image
                src="/images/mission-bg.png" // Replace with your actual star/nebula background path
                alt="Mission Background"
                fill
                className="object-cover opacity-60"
                priority
              />
              {/* Subtle dark overlay to ensure text readability */}
            </div>

            {/* Text Content */}
            <div className="relative z-10 max-w-[1100px] mx-auto text-center flex flex-col gap-6">
              <h2 
                className="text-white text-[32px] md:text-[58px] font-semibold leading-tight md:leading-[69.6px] font-redrose"
              >
                Our mission is to design websites that <br className="hidden md:block" />
                attract and engage customers.
              </h2>

              <p 
                className="text-[#AA68FF] text-[16px] md:text-[20px] font-medium leading-[30px] font-redrose"
              >
                However, we approach things a bit differently around here.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default MissionSection;