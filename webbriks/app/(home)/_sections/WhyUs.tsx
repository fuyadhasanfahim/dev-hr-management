"use client";

import React from "react";
import Image from "next/image";
import { motion, Variants } from "framer-motion";
import { 
  Star, 
  Users, 
  Award, 
  Hourglass, 
  LayoutGrid, 
  Radio 
} from "lucide-react";

const whyUsData = [
  {
    title: "Expert Team",
    desc: "Dedicated professionals with expertise in cutting-edge web design + development.",
    icon: <Star className="w-5 h-5 text-white" fill="white" />,
  },
  {
    title: "Client-Centric Approach",
    desc: "Tailoring solutions to meet your unique business needs and exceed expectations.",
    icon: <Users className="w-5 h-5 text-white" />,
  },
  {
    title: "Proven Experience",
    desc: "Years of successfully delivering impactful web solutions across diverse industries.",
    icon: <Award className="w-5 h-5 text-white" />,
  },
  {
    title: "Timely Delivery",
    desc: "Meeting deadlines consistently without compromising on quality or precision.",
    icon: <Hourglass className="w-5 h-5 text-white" />,
  },
  {
    title: "Responsive Solutions",
    desc: "Ensuring seamless performance across all devices for optimal user experience.",
    icon: <LayoutGrid className="w-5 h-5 text-white" />,
  },
  {
    title: "Transparent Communication",
    desc: "Clear, open lines of communication throughout every stage of your project.",
    icon: <Radio className="w-5 h-5 text-white" />,
  },
];

// Animation Variants
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.6, ease: "easeOut" } 
  }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const WhyUs = () => {
  return (
    <div className="bg-[#01050A] pb-10 overflow-x-hidden">
      {/* Header Section */}
      <section className="relative w-full flex items-center justify-center overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/explore/explore-bg.svg"
            alt="Explore Background"
            fill
            priority
            className="object-cover object-center"
          />
        </div>

        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeInUp}
          className="relative z-10 w-full max-w-[1440px] mx-auto px-4 text-center"
        >
          <h2 className="text-white text-3xl md:text-[42px] font-bold leading-tight md:leading-[50.4px] mb-4 font-rethink">
            Why Webbriks Stands Out
          </h2>
          <p className="text-[#A7ADBE] text-base md:text-[18px] font-medium leading-relaxed md:leading-[27px] max-w-[600px] mx-auto font-rethink">
            Discover why Webbriks excels in delivering innovative, client-focused web design solutions.
          </p>
        </motion.div>
      </section>

      {/* Why Us Cards Grid */}
      <div className="max-w-[1440px] mx-auto px-4 md:px-6">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-12 gap-x-8 md:gap-x-10"
        >
          {whyUsData.map((item, index) => (
            <motion.div 
              key={index} 
              variants={fadeInUp}
              className="relative mt-6"
            >
              {/* Two-Layer Border Layer */}
              <div 
                className="p-[1px] rounded-[16px] relative"
                style={{
                  background: "linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)"
                }}
              >
                {/* Icon Container positioned OUTSIDE the overflow-hidden div */}
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="absolute -top-5 left-6 p-2 rounded-lg z-20 shadow-lg"
                  style={{
                    background: "linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)"
                  }}
                >
                  {item.icon}
                </motion.div>

                {/* Inner Content Layer */}
                <div 
                  className="rounded-[15px] p-8 md:p-10 min-h-[220px] overflow-hidden group hover:brightness-110 transition-all duration-500"
                  style={{
                    background: "linear-gradient(257deg, rgba(153, 41, 219, 0.20) 6.55%, rgba(82, 22, 117, 0.00) 33.56%), #00020F"
                  }}
                >
                  <div className="mt-4">
                    <h3 className="text-white text-[20px] font-semibold leading-[30px] mb-4 font-redrose">
                      {item.title}
                    </h3>
                    <p className="text-white text-[18px] font-medium leading-[27px] font-redrose opacity-90">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default WhyUs;