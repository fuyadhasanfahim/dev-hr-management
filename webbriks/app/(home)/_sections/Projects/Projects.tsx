"use client";

import React from "react";
import Image from "next/image";
import { motion, Variants } from "framer-motion";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import ProjectHeader from "./ProjectHeader";

// 1. Data Array
const projects = [
  {
    id: 1,
    title: "Catalyst Advisory",
    description: "Corporate consulting firm website",
    image: "/images/projects/p1.png",
    isLarge: true,
  },
  {
    id: 2,
    title: "Trenzobd.com",
    description: "A modern wallet & leather goods platform",
    image: "/images/projects/p2.png",
    isLarge: true,
  },
  {
    id: 3,
    title: "Aesthetic Pixel studio",
    description: "Corporate consulting firm",
    image: "/images/projects/p3.png",
    isLarge: false,
  },
  {
    id: 4,
    title: "Wildbd.com",
    description: "Corporate consulting firm",
    image: "/images/projects/p4.png",
    isLarge: false,
  },
  {
    id: 5,
    title: "Stylezon BD",
    description: "Corporate E-commerce Solution",
    image: "/images/projects/p5.png",
    isLarge: false,
  },
];

// Animation Variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

// 2. Project Card Component
const ProjectCard = ({ project }: { project: typeof projects[0] }) => {
  return (
    <motion.div 
      variants={cardVariants}
      className="group relative flex flex-col rounded-[24px] border border-white/10 bg-[#020515] p-5 transition-all hover:border-white/20 overflow-hidden h-full"
    >
      {/* Image Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[16px]">
        <Image
          src={project.image}
          alt={project.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* Dynamic Figma Image Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none" 
          style={{
            background: project.isLarge 
              ? "linear-gradient(180deg, rgba(0, 3, 25, 0.00) 65%, #000319 88%, #000319 100%)" 
              : "linear-gradient(180deg, rgba(0, 3, 25, 0.00) 64.78%, #000319 100%)"
          }}
        />
      </div>

      {/* Content Area */}
      <div className="mt-6 flex flex-col gap-4 flex-grow">
        <div className={`flex ${project.isLarge ? "flex-row items-center justify-between" : "flex-col items-start"} gap-4`}>
          <div>
            <h3 className="font-redrose text-[18px] font-bold leading-[25.2px] text-white">
              {project.title}
            </h3>
            <p className="font-rethink text-[18px] font-normal leading-[25.2px] text-white/70">
              {project.description}
            </p>
          </div>

          {/* View Button */}
          <button 
            className={`flex items-center justify-center gap-2 px-6 py-2 shadow-[0_2px_5px_0_rgba(0,2,15,0.20)] transition-all active:scale-95 hover:opacity-90
              ${project.isLarge ? "rounded-full w-auto" : "rounded-[12px] w-full"}
              bg-gradient-to-br from-[#9C46F4] via-[#6A25E0] via-[#390CA4] to-[#28048B] text-white`}
          >
            <span className="font-redrose text-[18px] font-normal leading-[25.2px]">View</span>
            <ArrowUpRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// 3. Main Projects Page
const Projects = () => {
  return (
    <div className="bg-[#01050A] pb-20 font-sans overflow-hidden">
      <ProjectHeader />

      <section className="mx-auto mt-10 max-w-[1440px] px-4 md:px-6">
        {/* Animated Grid Container */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={containerVariants}
          className="grid grid-cols-1 gap-6 lg:grid-cols-6"
        >
          {projects.map((project) => (
            <div 
              key={project.id} 
              className={`${project.isLarge ? "lg:col-span-3" : "lg:col-span-2"} col-span-1`}
            >
              <ProjectCard project={project} />
            </div>
          ))}
        </motion.div>

        {/* View All Button with Entrance Animation */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-16 flex justify-center"
        >
          <button 
            className="flex items-center gap-2 rounded-full border border-[#2673CC]/[0.18] bg-gradient-to-br from-[#9C46F4] via-[#6A25E0] via-[#390CA4] to-[#28048B] px-8 py-3 text-white shadow-[0_2px_5px_0_rgba(0,2,15,0.20)] transition-all hover:brightness-110 active:scale-95"
          >
            <span className="font-redrose text-[18px] font-bold">View All Projects</span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </motion.div>
      </section>
    </div>
  );
};

export default Projects;