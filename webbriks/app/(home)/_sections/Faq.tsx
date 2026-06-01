"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Plus, Minus, HelpCircle } from "lucide-react";
import SectionHeader from "@/components/SectionHeader/SectionHeader";

const faqData = [
  {
    question: "What services does webbriks offer?",
    answer: "Webbriks provides comprehensive digital solutions including custom UI/UX design, full-stack web development (React, Next.js, Node.js), multi-tenant SaaS architectures, and specialized e-commerce platforms like TrenzoBD.",
  },
  {
    question: "Do you provide hosting services?",
    answer: "Yes, we manage infrastructure and DevOps tasks, including VPS management, Nginx reverse proxy configurations, SSL management, and automated database backups to ensure your platform remains secure and performant.",
  },
  {
    question: "How long does a typical project take?",
    answer: "Project timelines vary based on complexity. A standard corporate website typically takes 4-6 weeks, while complex SaaS platforms or e-commerce systems can take 8-12 weeks from design to deployment.",
  },
  {
    question: "How do you handle revisions during the process?",
    answer: "We follow an iterative design process. We provide dedicated feedback rounds during the Figma design phase and the development stage to ensure the final product aligns perfectly with your brand vision.",
  },
  {
    question: "Do you offer ongoing support after the website launch?",
    answer: "Absolutely. We provide post-launch maintenance, security updates, and performance monitoring. We also help with future feature scaling as your business grows.",
  },
  {
    question: "Can you help with content creation for my website?",
    answer: "Yes, we offer professional copywriting and editorial-style layout design to ensure your content is as engaging as your platform's user interface.",
  },
  {
    question: "Can I see examples of your previous work?",
    answer: "You can explore our portfolio section which features projects like Catalyst Advisory, TrenzoBD, and EduDesk, showcasing our 'pixel-perfect' Figma-to-code implementations.",
  },
  {
    question: "Is SEO included in your web design packages?",
    answer: "Every site we build is SEO-optimized by default, utilizing Next.js for server-side rendering, meta tag management, and clean semantic code to boost your search rankings.",
  },
  {
    question: "What is your pricing structure like?",
    answer: "Our pricing is project-based and reflects the complexity and scope of the work. We offer tiered packages for startups, growing agencies, and enterprise-level SaaS solutions.",
  },
  {
    question: "What makes webbriks different from other agencies?",
    answer: "We focus on pixel-perfect precision and high-performance infrastructure. Our background in both design and engineering allows us to build products that look beautiful and function flawlessly at scale.",
  },
];

// Animation Variants
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.6, ease: "easeOut" } 
  },
};

const Faq = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // Split data into two columns for independent expansion
  const midpoint = Math.ceil(faqData.length / 2);
  const leftColumn = faqData.slice(0, midpoint);
  const rightColumn = faqData.slice(midpoint);

  return (
    <section className="bg-[#01050A] py-20 px-4 font-redrose">
      <div className="max-w-[1440px] mx-auto">
        <SectionHeader 
          title="Frequently Asked Questions" 
          description="Answers to common questions about our services, processes, and what sets us apart."
        />

        {/* FAQ Grid - Split into two independent columns */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Left Column */}
          <div className="flex flex-col gap-6">
            {leftColumn.map((item, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="rounded-[16px] bg-[#00041F] overflow-hidden border border-white/5 h-fit"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between p-6 text-left group"
                >
                  <span className="text-[#FFF] text-[18px] font-bold leading-[27px] font-redrose">
                    {item.question}
                  </span>
                  <div className="ml-4 flex-shrink-0 w-10 h-10 rounded-full bg-[#0E122E] flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                    {openIndex === index ? (
                      <Minus className="text-white w-5 h-5" />
                    ) : (
                      <Plus className="text-white w-5 h-5" />
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {openIndex === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="px-6 pb-6 text-[#A7ADBE] text-[16px] leading-[24px] font-normal font-redrose border-t border-white/5 pt-4">
                        {item.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-6">
            {rightColumn.map((item, index) => {
              const actualIndex = index + midpoint;
              return (
                <motion.div
                  key={actualIndex}
                  variants={fadeInUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="rounded-[16px] bg-[#00041F] overflow-hidden border border-white/5 h-fit"
                >
                  <button
                    onClick={() => toggleFaq(actualIndex)}
                    className="w-full flex items-center justify-between p-6 text-left group"
                  >
                    <span className="text-[#FFF] text-[18px] font-bold leading-[27px] font-redrose">
                      {item.question}
                    </span>
                    <div className="ml-4 flex-shrink-0 w-10 h-10 rounded-full bg-[#0E122E] flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                      {openIndex === actualIndex ? (
                        <Minus className="text-white w-5 h-5" />
                      ) : (
                        <Plus className="text-white w-5 h-5" />
                      )}
                    </div>
                  </button>

                  <AnimatePresence>
                    {openIndex === actualIndex && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                      >
                        <div className="px-6 pb-6 text-[#A7ADBE] text-[16px] leading-[24px] font-normal font-redrose border-t border-white/5 pt-4">
                          {item.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Footer CTA with Two-Layer Border Approach */}
        <div className="mt-16 flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="p-[1px] rounded-[100px] w-full max-w-[500px]"
            style={{
              background: "linear-gradient(180deg, #3366FF 0%, #FFFFFF 50%, #3872F4 100%)",
            }}
          >
            <div className="bg-[#00041F] rounded-[99px] flex items-center justify-between p-2 pl-6">
              <div className="flex items-center gap-3">
                <HelpCircle className="text-white w-6 h-6" />
                <span className="text-[#FFF] text-[18px] font-medium leading-[27px] font-redrose">
                  Still Have a Question
                </span>
              </div>
              
              <button
                className="px-8 py-3 rounded-[100px] text-white text-[18px] font-bold leading-[27px] font-redrose shadow-lg transition-transform hover:scale-105"
                style={{
                  background: "linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)",
                }}
              >
                Ask Question
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Faq;