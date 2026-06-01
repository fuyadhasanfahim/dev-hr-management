"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const BookCallMarquee = () => {
  // Repeating the item multiple times to ensure a seamless infinite loop
  const marqueeItems = Array(10).fill("Book a Call");

  return (
    <section className="bg-[#01050A] py-10 border-y border-white/5 overflow-hidden flex whitespace-nowrap">
      <motion.div
        initial={{ x: 0 }}
        animate={{ x: "-50%" }}
        transition={{
          duration: 20,
          ease: "linear",
          repeat: Infinity,
        }}
        className="flex items-center gap-12 pr-12"
      >
        {marqueeItems.map((text, idx) => (
          <Link
            key={idx}
            href="/contact" // Update with your actual booking link
            className="flex items-center gap-6 group transition-opacity hover:opacity-80"
          >
            <span className="text-white text-[40px] font-bold leading-[19.5px] font-redrose">
              {text}
            </span>
            
            {/* Arrow Icon with specific gradient and shadow */}
            <div
              className="w-12 h-12 rounded-full border border-white/70 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
              style={{
                background: "linear-gradient(178deg, #9C46F4 1.65%, #6A25E0 17.46%, #390CA4 47.72%, #28048B 71.5%)",
                boxShadow: "0 0 20px 0 rgba(26, 79, 255, 0.40)",
              }}
            >
              <ArrowUpRight size={24} className="text-white" />
            </div>
          </Link>
        ))}
        
        {/* Duplicating the set for the infinite loop logic */}
        {marqueeItems.map((text, idx) => (
          <Link
            key={`dup-${idx}`}
            href="/contact"
            className="flex items-center gap-6 group transition-opacity hover:opacity-80"
          >
            <span className="text-white text-[40px] font-bold leading-[19.5px] font-redrose">
              {text}
            </span>
            <div
              className="w-12 h-12 rounded-full border border-white/70 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
              style={{
                background: "linear-gradient(178deg, #9C46F4 1.65%, #6A25E0 17.46%, #390CA4 47.72%, #28048B 71.5%)",
                boxShadow: "0 0 20px 0 rgba(26, 79, 255, 0.40)",
              }}
            >
              <ArrowUpRight size={24} className="text-white" />
            </div>
          </Link>
        ))}
      </motion.div>
    </section>
  );
};

export default BookCallMarquee;