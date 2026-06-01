"use client";

import React, { useState } from "react";
import Image from "next/image";
import { CheckCircle2, Phone, Send } from "lucide-react";
import { motion } from "framer-motion";

type FormState = {
  fullName: string;
  email: string;
  company: string;
  country: string;
  phone: string;
  service: string;
  message: string;
};

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const ContactSection = () => {
  const [formData, setFormData] = useState<FormState>({
    fullName: "",
    email: "",
    company: "",
    country: "",
    phone: "",
    service: "",
    message: "",
  });

  const [submittedData, setSubmittedData] = useState<FormState | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isComplete = Object.values(formData).every((val) => val.trim() !== "");
    if (isComplete) {
      setSubmittedData(formData);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      alert("Please fill in all required fields.");
    }
  };

  const inputClasses = "w-full rounded-xl border border-white/10 bg-transparent px-4 py-3 text-[13.5px] text-white shadow-[inset_0_2px_4px_1px_rgba(0,0,0,0.05)] outline-none transition-all focus:border-[#9C46F4]/50 placeholder:text-[#4B5563]";
  const labelClasses = "mb-2 block font-['Red_Rose'] text-[13px] font-semibold tracking-[0.325px] text-[#D1D5DB]";
  const asteriskClasses = "text-[#577EFF]";

  return (
    <section className="min-h-screen bg-[#01050A] px-4 py-20 font-['Red_Rose'] text-white md:px-10">
      <motion.div 
        className="mx-auto max-w-[1280px]"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* TOP PRINT VALUES AREA */}
        {submittedData && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-10 rounded-2xl border border-[#1A4FFF]/30 bg-[#1A4FFF]/10 p-6 shadow-lg"
          >
            <h3 className="mb-4 font-bold text-[#1A4FFF]">Last Submitted Query:</h3>
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
              {Object.entries(submittedData).map(([key, value]) => (
                <div key={key}>
                  <span className="capitalize text-gray-400">{key}: </span>
                  <span className="font-medium text-white">{value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <div className="flex flex-col items-start gap-16 lg:flex-row">
          
          {/* LEFT SIDE CONTENT */}
          <motion.div variants={itemVariants} className="lg:w-[40%]">
            <h1 className="mb-6 text-[54.6px] font-bold leading-[56px]">
              <span className="block text-white">Let&apos;s start the</span>
              <span className="text-[#1A4FFF]">dialogue now!</span>
            </h1>

            <div className="mb-12 space-y-6">
              {[
                "Expect a response from us within 24 hours.",
                "We're happy to sign an NDA upon request.",
                "Get access to a team of dedicated product specialists."
              ].map((text, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <CheckCircle2 size={24} className="shrink-0 text-[#1A4FFF]" />
                  <p className="text-[14.5px] font-normal leading-[26px] text-[#D1D5DB]">
                    {text}
                  </p>
                </div>
              ))}
            </div>

            {/* FOUNDER CARD */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="flex flex-row items-start gap-6 rounded-[24px] border border-[#9C46F4] bg-white/[0.02] p-6 shadow-[0_10px_40px_0_rgba(0,0,0,0.30)] backdrop-blur-[6px] md:flex-row"
            >
              <div className="relative h-44 w-40 shrink-0 overflow-hidden rounded-xl">
                <Image 
                  src="/images/founder.png" 
                  alt="Md. Ashaduzzaman" 
                  fill 
                  className="object-cover"
                />
              </div>
              <div className="flex-1">
                <h3 className="mb-1 text-[17.3px] font-bold tracking-[0.45px] text-white leading-[27px]">
                  Md. Ashaduzzaman
                </h3>
                <p className="mb-6 text-[13.1px] font-normal leading-[19.25px] text-[#9CA3AF]">
                  Founder and CEO <br /> WebBriks
                </p>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#9C46F4] via-[#6A25E0] via-[#390CA4] to-[#28048B] px-6 py-3 font-bold text-[12px] md:text-[14px] shadow-[0_0_15px_0_rgba(26,79,255,0.15)]"
                >
                  <Phone size={18} />
                  <span>Make a call</span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>

          {/* RIGHT SIDE FORM */}
          <motion.div 
            variants={itemVariants}
            className="rounded-[32px] border border-[#9C46F4] bg-gradient-to-b from-white/[0.04] to-transparent p-8 shadow-[0_20px_50px_0_rgba(0,0,0,0.50)] backdrop-blur-[12px] lg:w-[60%] md:p-12"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div>
                <label className={labelClasses}>
                  Full Name <span className={asteriskClasses}>*</span>
                </label>
                <input 
                  required
                  placeholder="Fardin Evan"
                  className={inputClasses}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className={labelClasses}>
                    Email <span className={asteriskClasses}>*</span>
                  </label>
                  <input 
                    required
                    type="email"
                    placeholder="fardinevan.uix@email.com"
                    className={inputClasses}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className={labelClasses}>
                    Company <span className={asteriskClasses}>*</span>
                  </label>
                  <input 
                    required
                    placeholder="WebBriks"
                    className={inputClasses}
                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className={labelClasses}>
                    Country <span className={asteriskClasses}>*</span>
                  </label>
                  <input 
                    required
                    placeholder="Country"
                    className={inputClasses}
                    onChange={(e) => setFormData({...formData, country: e.target.value})}
                  />
                </div>
                <div>
                  <label className={labelClasses}>
                    Phone <span className={asteriskClasses}>*</span>
                  </label>
                  <input 
                    required
                    placeholder="+123 456 7890"
                    className={inputClasses}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>

              {/* Service Selection - 2 Col Grid Restructured */}
              <div>
                <label className={labelClasses}>
                  Select a service <span className={asteriskClasses}>*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    "Web Design & Development", 
                    "Software Development", 
                    "End to end E-commerce Solution"
                  ].map((s, idx) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData({...formData, service: s})}
                      className={`px-4 py-3 rounded-xl border text-[13.5px] transition-all flex items-center justify-center text-center
                        ${idx === 2 ? "col-span-2 w-full" : "col-span-1"}
                        ${formData.service === s 
                          ? "border-[#9C46F4] bg-[#9C46F4]/10 text-white" 
                          : "border-white/10 text-[#4B5563] hover:text-white"
                        }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClasses}>
                  Message <span className={asteriskClasses}>*</span>
                </label>
                <textarea 
                  required
                  rows={4}
                  placeholder="Tell us about your project..."
                  className={`${inputClasses} resize-none`}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                />
              </div>

              <motion.button 
                type="submit"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#9C46F4] via-[#6A25E0] via-[#390CA4] to-[#28048B] py-4 text-[15.8px] font-bold tracking-[0.4px] text-white shadow-[0_0_20px_0_rgba(26,79,255,0.30)] transition-all"
              >
                Send my query <Send size={18} />
              </motion.button>
            </form>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default ContactSection;