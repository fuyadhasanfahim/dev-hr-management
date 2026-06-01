"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import SectionHeader from "@/components/SectionHeader/SectionHeader";

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

const ExploreRecentProject = () => {
  // Split projects for variety in rows, or use the same for both
  const firstRow = [...myProjects.slice(0, 5), ...myProjects.slice(0, 5)];
  const secondRow = [...myProjects.slice(5, 10), ...myProjects.slice(5, 10)];

  return (
    <section className="bg-[#050505] py-20 overflow-hidden">
      <div className="mb-16">
        <SectionHeader
          title="Explore Our Recent Projects"
          description="Browse through our portfolio showcasing diverse, innovative web design projects and client successes."
        />
      </div>

      <div className="flex flex-col gap-8">
        {/* --- FIRST ROW: Right to Left --- */}
        <div className="flex overflow-hidden">
          <motion.div
            className="flex gap-6 flex-nowrap"
            animate={{
              x: [0, -1920], // Adjust based on your total row width
            }}
            transition={{
              duration: 30,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            {firstRow.map((project, index) => (
              <ProjectCard key={`row1-${index}`} src={project.src} alt={project.alt} />
            ))}
          </motion.div>
        </div>

        {/* --- SECOND ROW: Left to Right --- */}
        <div className="flex overflow-hidden">
          <motion.div
            className="flex gap-6 flex-nowrap"
            initial={{ x: -1920 }}
            animate={{
              x: [-1920, 0],
            }}
            transition={{
              duration: 35, // Slightly different speed for a dynamic feel
              repeat: Infinity,
              ease: "linear",
            }}
          >
            {secondRow.map((project, index) => (
              <ProjectCard key={`row2-${index}`} src={project.src} alt={project.alt} />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// Reusable Project Card to match the Mockup Style in your image
const ProjectCard = ({ src, alt }: { src: string; alt: string }) => {
  return (
    <div className="relative flex-shrink-0 w-[350px] md:w-[500px] aspect-[16/12] group">
      <div className="w-full h-full rounded-[15px] md:rounded-[24px]   overflow-hidden shadow-2xl">
        <Image
          src={src}
          alt={alt}
          fill
          className="cover   transition-transform duration-700"
        />
      </div>
      {/* Subtle overlay to match the dark aesthetic */}
      <div className="absolute inset-0 bg-black/10 rounded-[24px] pointer-events-none" />
    </div>
  );
};

export default ExploreRecentProject;