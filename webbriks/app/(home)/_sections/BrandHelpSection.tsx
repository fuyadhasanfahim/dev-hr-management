"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, Variants } from "framer-motion";
import { Play, Layout, Zap, Search } from "lucide-react";

// Animation Variants
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
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
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const BrandHelpSection = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  const features = [
    {
      title: "Custom Designs",
      desc: "Tailored websites meticulously crafted to reflect your brand.",
      icon: <Layout className="text-white w-5 h-5" />,
    },
    {
      title: "Fast Performance",
      desc: "Optimized for lightning-fast speed to enhance user experience.",
      icon: <Zap className="text-white w-5 h-5" />,
    },
    {
      title: "SEO Friendly",
      desc: "Designed to improve SEO and increase visibility effortlessly.",
      icon: <Search className="text-white w-5 h-5" />,
    },
  ];

  return (
    <section className="w-full bg-[#01050A] py-20 px-4 overflow-hidden">
      <div className="max-w-[1440px] mx-auto">
        
        {/* Section Header with Lines - Animated */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={fadeInUp}
          className="flex items-center justify-center gap-4 mb-12"
        >
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#4C75FF] to-[#1A4FFF]" />
          <h2 className="text-[#C4C8D4] text-[18px] font-medium leading-[27px] whitespace-nowrap font-redrose">
            See How We Can Help Your Brand
          </h2>
          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[#4C75FF] to-[#1A4FFF]" />
        </motion.div>

        {/* Video Section - Animated */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="relative p-[6px] rounded-[30px] mb-10 overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, #36F 0%, #FFF 50%, #3872F4 100%)",
          }}
        >
          <div className="relative bg-[#040816] rounded-[28px] overflow-hidden aspect-video group">
            {!isPlaying ? (
              <>
                {/* Thumbnail */}
                <Image
                  src="/images/thumbnail-info-video.png"
                  alt="Brand Video Thumbnail"
                  fill
                  className="object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
                />

                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsPlaying(true)}
                    className="flex items-center gap-3 px-8 py-3 rounded-full text-white shadow-lg"
                    style={{
                      background:
                        "linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)",
                    }}
                  >
                    <Play fill="white" size={20} />
                    <span className="text-[18px] font-medium">Play Video</span>
                  </motion.button>
                </div>
              </>
            ) : (
              <iframe
                className="w-full h-full"
                src="https://www.youtube.com/embed/your-video-id?autoplay=1"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            )}
          </div>
        </motion.div>

        {/* Feature Cards Grid - Staggered Animation */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              variants={fadeInUp}
              className="relative p-8 rounded-[20px] border border-[#36F] overflow-hidden group hover:border-white/30 transition-colors duration-500"
              style={{
                background: `radial-gradient(130.51% 127.19% at 50% -20%, rgba(153, 41, 219, 0.35) 0%, rgba(153, 41, 219, 0.00) 50.48%), radial-gradient(103.6% 100.96% at 50% 10%, rgba(153, 41, 219, 0.21) 0%, rgba(4, 8, 22, 0.70) 60%)`,
              }}
            >
              {/* Grid Lines Pattern */}
              <div
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, #B5D3FD1A 1px, transparent 1px), 
                    linear-gradient(to bottom, #B5D3FD1A 1px, transparent 1px)
                  `,
                  backgroundSize: "24px 24px",
                }}
              />

              {/* Icon Container with subtle animation */}
              <motion.div
                whileHover={{ rotate: 5, scale: 1.1 }}
                className="relative z-10 mb-6 w-12 h-12 rounded-[12px] flex items-center justify-center shadow-lg"
                style={{
                  background:
                    "linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)",
                }}
              >
                {feature.icon}
              </motion.div>

              {/* Text Content */}
              <div className="relative z-10">
                <h3 className="text-white text-[18px] font-semibold leading-[27px] mb-2 font-redrose">
                  {feature.title}
                </h3>
                <p className="text-[#A7ADBE] text-[18px] font-normal leading-[27px] font-redrose">
                  {feature.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default BrandHelpSection;