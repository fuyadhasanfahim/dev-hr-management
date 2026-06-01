"use client";

import { motion } from "framer-motion";

const AboutHero = () => {
  return (
    <section className="relative w-full bg-[#01050A] pt-20 pb-10 md:pt-10 md:pb-20 px-4 overflow-hidden flex flex-col items-center">
      {/* --- GLOWING BACKGROUND EFFECTS --- */}
      {/* Left Glow */}
      <div
        className="absolute w-[1000px] h-[1000px] rounded-full pointer-events-none z-0"
        style={{
          left: "-500px", // Adjusted for better screen fitting than -722px
          top: "-400px",
          background:
            "linear-gradient(180deg, rgba(76, 117, 255, 0.05) 0%, rgba(26, 79, 255, 0.05) 100%)",
          filter: "blur(60px)",
        }}
      />
      {/* Right Glow */}
      <div
        className="absolute w-[800px] h-[800px] rounded-full pointer-events-none z-0"
        style={{
          right: "-117px",
          top: "-300px",
          background:
            "linear-gradient(180deg, rgba(76, 117, 255, 0.05) 0%, rgba(26, 79, 255, 0.05) 100%)",
          filter: "blur(60px)",
        }}
      />

      <div className="relative z-10 w-full max-w-[1200px] flex flex-col items-center text-center">
        {/* --- 1. BADGE SECTION --- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          // Layer 1: The "Border" - Uses the 3-stop linear gradient
          className="p-[1px] rounded-[40px] mb-8 bg-gradient-to-b from-[#3666FF] via-[#FFFFFF] to-[#3872F4]"
        >
          <div
            className="flex items-center gap-3 px-4 py-1.5 rounded-[40px] backdrop-blur-sm bg-[#191132]"
            
          >
            {/* Year Badge */}
            <div className="px-2 py-1 rounded-[26px] flex items-center justify-center bg-gradient-to-b from-[#4F1AD6] via-[#6943DE] to-[#8059E3]">
              <span className="text-[12px] font-bold text-white leading-[10px] tracking-[-0.5px]">
                {new Date().getFullYear()}
              </span>
            </div>

            {/* Badge Text */}
            <span className="text-[14px] md:text-[16px] font-bold text-white tracking-[-0.5px]">
              Explore Our Journey
            </span>
          </div>
        </motion.div>

        {/* --- 2. TITLES --- */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-[32px] md:text-[42px] font-bold text-white leading-[1.2] md:leading-[50.4px] mb-6 max-w-4xl"
        >
          Discover the Inspiring Journey Behind Our Success and Growth
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-[16px] md:text-[18px] font-normal text-white/60 leading-[26px] tracking-[-0.2px] max-w-3xl mb-12"
        >
          Follow our journey of creativity, innovation, and continuous growth as
          we transform ideas into meaningful digital experiences, build lasting
          connections, and create solutions that inspire success and deliver
          real value.
        </motion.p>

        {/* --- 3. VIDEO SECTION --- */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="relative w-full rounded-[20px] md:rounded-[30px] border-[4px] md:border-[8px] border-[#010733] shadow-[0_-20px_100px_0_rgba(26,79,255,0.60)] overflow-hidden aspect-video bg-black"
        >
          {/* Autoplay Video */}
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          >
            <source src="/videos/journey.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>

        </motion.div>
      </div>
    </section>
  );
};

export default AboutHero;
