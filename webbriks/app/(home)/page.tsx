"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

import BookCallMarquee from "./_sections/BookCallMarquee";
import BrandHelpSection from "./_sections/BrandHelpSection";
import Choosing from "./_sections/Choosing";
import ContactSection from "./_sections/ContactSection";
import DesignProcess from "./_sections/DesignProcess";
import Explore from "./_sections/Explore";
import Faq from "./_sections/Faq";
import Hero from "./_sections/Hero";
import ImageSlider from "./_sections/ImageSlider";
import MissionSection from "./_sections/MissionSection";
import Projects from "./_sections/Projects/Projects";
import StartProject from "./_sections/StartProject";
import StatsSection from "./_sections/StatsSection";
import TrustedBrands from "./_sections/TrustedBrands";
import WhyUs from "./_sections/WhyUs";
import Review from "./_sections/Review";

const myProjects = [
  { id: 1, src: "/images/projects/project1.png", alt: "Project 1" },
  { id: 2, src: "/images/projects/project2.png", alt: "Project 2" },
  { id: 3, src: "/images/projects/project3.png", alt: "Project 3" },
  { id: 4, src: "/images/projects/project4.png", alt: "Project 4" },
  { id: 5, src: "/images/projects/project5.png", alt: "Project 5" },
  { id: 6, src: "/images/projects/project6.png", alt: "Project 6" },
  { id: 7, src: "/images/projects/project7.png", alt: "Project 7" },
  { id: 8, src: "/images/projects/project8.png", alt: "Project 8" },
  { id: 9, src: "/images/projects/project9.png", alt: "Project 9" },
  { id: 10, src: "/images/projects/project10.png", alt: "Project 10" },
];

// Star Overlay Component
const StarOverlay = () => {
  const [stars, setStars] = useState<
    { id: number; x: number; y: number; size: number; duration: number; delay: number }[]
  >([]);

  useEffect(() => {
    // We generate stars inside useEffect so it only runs on the client.
    // This prevents hydration errors caused by random numbers during server-side rendering.
    const generateStars = Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // Random X position (0 to 100vw)
      y: Math.random() * 100, // Random Y position (0 to 100vh)
      size: Math.random() * 4 + 2, // Random size between 1px and 3px
      duration: Math.random() * 3 + 2, // Animation duration between 2s and 5s
      delay: Math.random() * 5, // Random animation start delay
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStars(generateStars);
  }, []);

  return (
    <div className="fixed inset-0 z-100 pointer-events-none overflow-hidden">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute bg-white rounded-full"
          style={{
            left: `${star.x}vw`,
            top: `${star.y}vh`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            boxShadow: "0 0 6px 1px rgba(255, 255, 255, 0.2)", // Subtle glow
          }}
          animate={{
            opacity: [0, 0.5, 0], // Fades in and out
            scale: [0.8, 1.2, 0.8], // Pulses slightly
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            delay: star.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

export default function Home() {
  return (
    <div className="relative w-full bg-[#01050A]">
      {/* Animated Stars floating over the entire page */}
      <StarOverlay />

      <Hero />
      <ImageSlider images={myProjects} />
      <Explore />
      <Projects />
      <BrandHelpSection />
      <WhyUs />
      <DesignProcess />
      <Choosing />
      <StatsSection />
      <TrustedBrands />
      <MissionSection />
      <Review/>
      <Faq />
      <StartProject />
      <ContactSection />
      <BookCallMarquee />
    </div>
  );
}