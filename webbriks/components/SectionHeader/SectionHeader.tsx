"use client";

import Image from "next/image";
import { motion, Variants } from "framer-motion";

// Variants for the text content
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

// Variants for the background glow/image
const imageEffect: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 1.2, ease: "easeOut" },
  },
};

const SectionHeader = ({ title, description }: { title: string; description: string }) => {
  return (
    <section className="relative w-full flex items-center justify-center overflow-hidden py-10">
      {/* Constrained Background Image - Animated */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={imageEffect}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 w-full max-w-[557px] h-full"
      >
        <Image
          src="/images/projects/header.png"
          alt="Projects Header Background"
          fill
          priority
          className="object-contain object-center"
        />
      </motion.div>

      {/* Content Overlay - Staggered Entrance */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.5 }}
        transition={{ staggerChildren: 0.2 }}
        className="relative z-10 w-full max-w-[1440px] mx-auto px-4 text-center"
      >
        <motion.h2
          variants={fadeInUp}
          className="text-white text-3xl md:text-[42px] font-bold leading-tight md:leading-[50.4px] mb-4 font-rethink"
        >
          {title}
        </motion.h2>

        <motion.p
          variants={fadeInUp}
          className="text-[#A7ADBE] text-base md:text-[18px] font-medium leading-relaxed md:leading-[27px] max-w-[700px] mx-auto font-rethink"
        >
          {description}
        </motion.p>
      </motion.div>
    </section>
  );
};

export default SectionHeader;