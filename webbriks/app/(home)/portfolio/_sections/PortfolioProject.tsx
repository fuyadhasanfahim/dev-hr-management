"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { FiArrowUpRight } from "react-icons/fi";
import { ArrowRight } from "lucide-react";

const projects = [
  {
    id: 1,
    title: "Nova Fintech",
    description:
      "A comprehensive financial dashboard with real-time analytics and seamless transaction flow.",
    tags: ["UI/UX", "Web App"],
    image: "/images/projects/project1.png",
    link: "#",
  },
  {
    id: 2,
    title: "Nova Fintech", // Replicating image content
    description:
      "A comprehensive financial dashboard with real-time analytics and seamless transaction flow.",
    tags: ["UI/UX", "Web App"],
    image: "/images/projects/project2.png",
    link: "#",
  },
  {
    id: 3,
    title: "Nexus Corp",
    description:
      "A modern corporate identity and web presence built for a leading AI infrastructure company.",
    tags: ["Corporate", "Branding"],
    image: "/images/projects/project3.png",
    link: "#",
  },
  {
    id: 4,
    title: "DataFlow AI",
    description:
      "Advanced analytics dashboard for tracking enterprise-scale data with AI-driven insights.",
    tags: ["SaaS", "Dashboard"],
    image: "/images/projects/project4.png",
    link: "#",
  },
  {
    id: 5,
    title: "Elevate Agency",
    description:
      "Dynamic portfolio website for a creative marketing agency highlighting case studies.",
    tags: ["Agency", "Web Design"],
    image: "/images/projects/project5.png",
    link: "#",
  },
  {
    id: 6,
    title: "CoinBase Pro",
    description:
      "Secure and scalable cryptocurrency exchange platform with real-time trading.",
    tags: ["Web3", "Mobile App"],
    image: "/images/projects/project6.png",
    link: "#",
  },
];

const PortfolioProject = () => {
  return (
    <section className="bg-[#01050A] py-20 px-4">
      <div className="max-w-[1440px] mx-auto">
        {/* Project Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[32px] mb-16">
          {projects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group flex flex-col rounded-[16px] border border-white/10 bg-[#030308] overflow-hidden"
            >
              {/* Image Container */}
              <div className="relative aspect-[16/11] overflow-hidden">
                <Image
                  src={project.image}
                  alt={project.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Image Overlay Gradient */}
                <div
                  className="absolute inset-0 z-10 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(0deg, #030308 0%, rgba(3, 3, 8, 0.20) 50%, rgba(3, 3, 8, 0.00) 100%)",
                  }}
                />

                {/* Floating Tags */}
                <div className="absolute bottom-4 left-4 z-20 flex gap-2">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-4 py-1.5 rounded-full text-[12px] font-normal text-white border border-white/10 bg-white/10 backdrop-blur-[6px] leading-[16px]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Content Section */}
              <div className="p-8 flex flex-col gap-4">
                <h3 className="text-white text-[24px] font-bold leading-[32px]">
                  {project.title}
                </h3>
                <p className="text-[#9CA3AF] text-[16px] font-normal leading-[26px]">
                  {project.description}
                </p>

                <Link
                  href={project.link}
                  className="inline-flex items-center gap-2 text-[#C084FC] text-[16px] font-normal leading-[24px] hover:underline w-fit"
                >
                  View Website <FiArrowUpRight />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        {/* View All Projects Button */}
        <div className="flex justify-center">
          <Link href="/projects">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className=" inline-flex items-center justify-center gap-2 px-6 sm:px-8 lg:px-10 py-3 sm:py-4 rounded-full text-white text-sm sm:text-base lg:text-[18px] font-bold leading-none transition-all shadow-[0_0_20px_0_rgba(147,51,234,0.30)] whitespace-nowrap "
              style={{
                background: "linear-gradient(180deg, #4F1AD6 0%, #8059E3 100%)",
              }}
            >
              <span>View All Projects</span>

              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            </motion.button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default PortfolioProject;
