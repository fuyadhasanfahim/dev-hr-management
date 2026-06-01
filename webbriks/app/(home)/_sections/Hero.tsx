"use client";

import React, { useEffect, useState } from "react";
import { Inter, Red_Rose } from "next/font/google";
import styles from "./hero.module.css";
import { Star, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, Variants } from "framer-motion";

const inter = Inter({ subsets: ["latin"] });
const redRose = Red_Rose({ subsets: ["latin"] });

const services = [
  "UI/UX Design & Development",
  "Software Development",
  "End to End E-commerce",
];

const Hero = () => {
  const [backgroundStars, setBackgroundStars] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    const generatedStars = [...Array(50)].map((_, i) => ({
      id: i,
      width: Math.random() * 3 + 1 + "px",
      height: Math.random() * 3 + 1 + "px",
      top: Math.random() * 100 + "%",
      left: Math.random() * 100 + "%",
      delay: Math.random() * 5 + "s",
    }));
    setBackgroundStars(generatedStars);

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % services.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const figmaStagger: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5,
        ease: "easeOut",
      },
    }),
  };

  if (!isMounted) return <section className="min-h-screen bg-[#02040a]" />;

  return (
    <section
      /* FIXED: Changed min-h to fit on mobile and center content to remove top gaps */
      className={`relative min-h-fit md:min-h-[80dvh] flex flex-col items-center justify-center py-20 md:py-0 overflow-hidden ${styles.heroContainer}`}
    >
      {/* Gem Icons */}
      <div className="hidden md:block md:absolute left-[15%] top-[20%] z-10 pointer-events-none opacity-80 animate-pulse">
        <Image src="/images/gem.svg" alt="" width={64} height={64} priority />
      </div>
      <div className="hidden md:block md:absolute right-[10%] top-[30%] z-10 pointer-events-none opacity-80 animate-pulse">
        <Image src="/images/gem.svg" alt="" width={64} height={64} priority />
      </div>
      <div className="hidden md:block md:absolute left-[20%] top-[70%] z-10 pointer-events-none opacity-80 animate-pulse">
        <Image src="/images/gem.svg" alt="" width={64} height={64} priority />
      </div>

      {/* Background Corner Accents */}
      {/* Background Corner Accents */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        {/* Left Image */}
        <div className="absolute top-0 left-0 opacity-30 md:opacity-50 w-[300px] md:w-[800px] aspect-square">
          <Image
            src="/images/left.png"
            alt=""
            fill
            className="object-contain object-left-top"
            priority
          />
        </div>

        {/* Right Image - FIXED GAP HERE */}
        <div className="absolute top-0 right-0 opacity-30 md:opacity-50 w-[300px] md:w-[800px] aspect-square">
          <Image
            src="/images/right2.png"
            alt=""
            fill
            className="object-contain object-right-top" // Forces image to hug the right and top edge
            priority
          />
        </div>
      </div>

      {/* 1. Dancing Background Stars */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {backgroundStars.map((star) => (
          <div
            key={star.id}
            className={styles.star}
            style={{
              width: star.width,
              height: star.height,
              top: star.top,
              left: star.left,
              animationDelay: star.delay,
              backgroundColor: "rgba(255, 255, 255, 0.8)",
            }}
          />
        ))}
      </div>

      {/* 2. Top Badge */}
      <motion.div
        custom={0}
        initial="hidden"
        animate="visible"
        variants={figmaStagger}
        className="z-20 mb-6 md:mt-10 md:mb-8 p-[1px] rounded-full inline-flex items-center justify-center shadow-[0_0_15px_0_rgba(123,44,250,0.25)]"
        style={{
          background:
            "linear-gradient(180deg, #3366FF 0%, #FFFFFF 50%, #3872F4 100%)",
        }}
      >
        <div className="flex items-center gap-2 px-3 md:px-4 py-1 rounded-full bg-black/90 backdrop-blur-[4px]">
          <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-[#7B22B7] border border-[#7B2CFA] flex items-center justify-center shadow-lg">
            <Star size={8} fill="#FFF" color="#FFF" />
          </div>
          <span
            className={`${inter.className} text-white text-[12px] md:text-[14px] font-bold leading-tight`}
          >
            10+ Years of Experience
          </span>
        </div>
      </motion.div>

      {/* 3. Main Titles & Content */}
      <div className="z-20 text-center px-4 max-w-[100vw]">
        <motion.h1
          custom={1}
          initial="hidden"
          animate="visible"
          variants={figmaStagger}
          className={`${redRose.className} text-[32px] sm:text-[48px] md:text-[54px] lg:text-[60px] font-bold text-white leading-[1.2] md:leading-[79.2px] tracking-tight md:tracking-[-2.16px] drop-shadow-[0_0_30px_#0F214C] mb-4`}
        >
          Precision Design{" "}
          <span className="bg-gradient-to-b from-[#4C75FF] to-[#1A4FFF] bg-clip-text text-transparent block sm:inline">
            Powerful Development
          </span>
        </motion.h1>

        {/* Looping Subtitle Box */}
        <motion.div
          custom={2}
          initial="hidden"
          animate="visible"
          variants={figmaStagger}
          className="inline-block relative px-4 sm:px-10 py-3 md:py-4 mb-6 md:mb-8 max-w-full"
        >
          <div className="absolute inset-0 bg-[#1A45A9]/23 border-2 border-[#36F] rounded-[4px] shadow-[0_0_25px_0_#2571FF]" />

          <div className="absolute -left-[4px] md:-left-[5px] top-1 -translate-y-full flex flex-col items-center">
            <div className="w-2 h-2 md:w-3 md:h-3 bg-[#36F] rounded-full shadow-[0_0_10px_#36F]" />
            <div className="w-[1px] md:w-[2px] h-2 bg-[#36F]" />
          </div>
          <div className="absolute -right-[3px] md:-right-[5px] bottom-1 translate-y-full flex flex-col items-center">
            <div className="w-[1px] md:w-[2px] h-2 bg-[#36F]" />
            <div className="w-2 h-2 md:w-3 md:h-3 bg-[#36F] rounded-full shadow-[0_0_10px_#36F]" />
          </div>

          <div className="h-[40px] sm:h-[50px] md:h-[65px] lg:h-[83px] overflow-hidden relative min-w-[280px] sm:min-w-[420px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.h2
                key={index}
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className={`${redRose.className} text-[20px] sm:text-[32px] md:text-[42px] lg:text-[55px] font-bold text-white leading-none md:leading-[83px] tracking-tight md:tracking-[-2px]`}
              >
                {services[index]}
              </motion.h2>
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.p
          custom={3}
          initial="hidden"
          animate="visible"
          variants={figmaStagger}
          className={`${redRose.className} text-[#94A3B8] text-[14px] md:text-[16px] lg:text-[18px] font-normal leading-relaxed md:leading-[27px] max-w-2xl mx-auto mb-10 md:mb-12 px-2`}
        >
          We don&apos;t just provide services; we craft digital experiences.{" "}
          <br className="hidden md:block" />
          From high-end photo retouching to innovative web solutions, your
          vision is our mission.
        </motion.p>

        {/* 4. CTA Link Pill */}
        <motion.div
          custom={4}
          initial="hidden"
          animate="visible"
          variants={figmaStagger}
          className="inline-flex flex-col sm:flex-row items-center gap-4 bg-[#10204A] border border-[#36F] rounded-[20px] sm:rounded-full p-2 pr-2 sm:pr-8 shadow-[0_0_10px_0_#386AFF] w-full sm:w-auto"
        >
          <Link href="/quotation" className="w-full sm:w-auto">
            <button className="bg-[#36F] text-white px-6 py-3 rounded-full flex items-center justify-center gap-2 font-bold shadow-[0_0_10px_0_#36F] active:scale-95 transition-transform w-full sm:w-auto">
              Get My Quotation
              <div className="bg-white rounded-full p-1">
                <ArrowRight size={14} color="#36F" />
              </div>
            </button>
          </Link>
          <span
            className={`${redRose.className} text-white text-[14px] md:text-[16px] pb-2 sm:pb-0`}
          >
            Trusted by 5k+ Global Clients
          </span>
        </motion.div>
      </div>

      {/* 5. Orbital Animation Section */}
      <div
        className={`${styles.orbitContainerWrapper} mt-12 md:mt-[90px] z-10 pointer-events-none hidden md:flex`}
      >
        <div className="scale-[0.5] sm:scale-[0.7] lg:scale-100 flex items-center justify-center">
          <div className={styles.orbitCenterAnchor}>
            <div className={styles.characterGlow}>
              <div className="flex">
                <div className={styles.eye} />
                <div className={styles.eye} />
              </div>
            </div>

            <div className={styles.orbitsGroup}>
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className={styles.ellipse}
                  style={{
                    width: 300 + i * 115 + "px",
                    height: 300 + i * 115 + "px",
                    opacity: Math.max(0.05, 1 - i * 0.08),
                  }}
                >
                  <div
                    className={styles.particleRotationWrapper}
                    style={
                      { "--duration": `${15 + i * 3}s` } as React.CSSProperties
                    }
                  >
                    <div
                      className={styles.orbitParticle}
                      style={{ left: "50%", top: "-8px" }}
                    />
                    {i % 2 === 0 && (
                      <div
                        className={styles.orbitParticle}
                        style={{ left: "0%", top: "50%" }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="block md:hidden">
        <Image
          src="/images/mobile-star.png"
          alt=""
          width={600}
          height={600}
          priority
          className="opacity-80"
        />
      </div>
    </section>
  );
};

export default Hero;
