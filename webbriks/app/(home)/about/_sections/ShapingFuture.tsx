"use client";

import { Boxes, ShieldCheck, Zap } from "lucide-react";
import Image from "next/image";

const ShapingFuture = () => {
  return (
    <section className="bg-[#01050A] py-20 px-4 flex flex-col items-center overflow-hidden">
      {/* --- HEADER SECTION --- */}
      <div className="max-w-[850px] text-center mb-16">
        <h2 className="text-white text-[32px] md:text-[42px] font-bold leading-[1.2] md:leading-[50.4px] mb-6">
          Shaping Tomorrow with bold ideas
        </h2>
        <p className="text-[#6D7792] text-[16px] md:text-[18px] font-normal leading-[27px]">
          Turning bold ideas into powerful digital experiences that inspire
          growth, build trust, and create lasting impact. We focus on
          innovation, strategy, and design to help modern brands shape the
          future with confidence and purpose.
        </p>
      </div>

      {/* --- GRID CARDS SECTION --- */}
      <div className="max-w-[1200px] w-full grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* CARD 1: INNOVATE */}
        <div
          className="relative p-8 rounded-[24px] border border-white/5 backdrop-blur-xl overflow-hidden group"
          style={{
            background:
              "linear-gradient(134deg, rgba(156, 70, 244, 0.30) 1.15%, rgba(106, 37, 224, 0.30) 17.12%, rgba(57, 12, 164, 0.30) 47.7%, rgba(40, 4, 139, 0.30) 71.73%)",
          }}
        >
          <div className="flex justify-between items-start mb-8">
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#9C46F4] via-[#6A25E0] to-[#28048B]">
              <Boxes className="text-white" size={24} />
            </div>
            <span className="text-white text-[14.8px] tracking-[-0.463px] font-normal px-4 py-1.5 rounded-full bg-gradient-to-br from-[#9C46F4] via-[#6A25E0] to-[#28048B] ">
              Innovate
            </span>
          </div>

          <h3 className="text-white text-[16.7px] tracking-[-0.463px] mb-4">
            Designed for Digital Excellence
          </h3>

          {/* Horizontal Gradient Line */}
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/55 to-transparent mb-6" />

          <p className="text-white/50 text-[14.8px] leading-6 tracking-[-0.185px] mb-8">
            Whether you&apos;re building modern brands, digital products, or
            scalable solutions, Webbriks creates launch-ready websites that
            showcase your services and communicate your vision with clarity and
            impact.
          </p>

          <div className="flex gap-3">
            <Tag text="Agency" />
            <Tag text="Digital Growth" />
          </div>
        </div>

        {/* CARD 2: TRUST */}
        <div
          className="relative p-8 rounded-[24px] border border-white/5 backdrop-blur-xl overflow-hidden group"
          style={{
            background:
              "linear-gradient(134deg, rgba(156, 70, 244, 0.30) 1.15%, rgba(106, 37, 224, 0.30) 17.12%, rgba(57, 12, 164, 0.30) 47.7%, rgba(40, 4, 139, 0.30) 71.73%)",
          }}
        >
          <div className="flex justify-between items-start mb-8">
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#9C46F4] via-[#6A25E0] to-[#28048B]">
              <ShieldCheck className="text-white" size={24} />
            </div>
            <span className="text-white text-[14.8px] tracking-[-0.463px] font-normal px-4 py-1.5 rounded-full bg-gradient-to-br from-[#9C46F4] via-[#6A25E0] to-[#28048B] ">
              Trust
            </span>
          </div>

          <h3 className="text-white text-[16.7px] tracking-[-0.463px] mb-4">
            Designed to Build Instant Trust
          </h3>

          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/55 to-transparent mb-6" />

          <p className="text-white/50 text-[14.8px] leading-6 tracking-[-0.185px] mb-8">
            Webbriks is crafted with clean typography, smooth transitions, and
            modern layouts perfect for eCommerce brands, agencies, and startups
            that want to look professional and reliable from day one.
          </p>

          <div className="flex gap-3">
            <Tag text="Trust By Design" />
            <Tag text="Modern UX" />
          </div>
        </div>
      </div>
      {/* --- FULL WIDTH BOTTOM CARD --- */}
      <div className="max-w-[1200px] w-full relative p-12 rounded-[24px] border-b border-[#6E32EA]  overflow-hidden text-center flex flex-col items-center">
        {/* 1. Background Image - Replaces the bg color and radial gradient */}
        <Image
          src="/images/scale-card-bg.png" // Replace with your actual image path
          alt="Background Ray Effect"
          fill
          priority
          className="object-cover z-0 pointer-events-none"
        />

        {/* 2. Content Wrapper - Stays z-10 to sit above the image */}
        <div className="relative z-10 flex flex-col items-center w-full">
          <div className="flex justify-between w-full items-center mb-10">
            {/* Icon with Inner Shadow */}
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#9C46F4] via-[#6A25E0] to-[#28048B] shadow-[inset_0_10px_10px_-1px_rgba(79,26,214,0.15)]">
              <Zap className="text-white" size={24} />
            </div>

            {/* Scale Tag */}
            <span className="text-white text-[14.8px] tracking-[-0.463px] font-normal px-6 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              Scale
            </span>
          </div>

          {/* Title */}
          <h3 className="text-white text-[16.7px] font-bold tracking-[-0.463px] mb-6">
            Scales With Your Vision
          </h3>

          {/* Description */}
          <p className="text-white/50 text-[14.8px] leading-6 tracking-[-0.185px] max-w-[800px] mb-12">
            From eCommerce stores to agency portfolios and business websites,
            Webbriks is flexible and scalable. As your brand grows, the design
            adapts so your website evolves without needing a complete redesign.
          </p>

          {/* BOOK APPOINTMENT BUTTON - Keeping the exact multi-stop gradient */}
          <button
            className="px-8 py-3 rounded-[10px] text-white text-[14.7px] font-medium tracking-[-0.463px] transition-transform active:scale-95 shadow-2xl hover:brightness-110"
            style={{
              background:
                "linear-gradient(180deg, #4F1AD6 0%, #5323D7 8.33%, #562AD8 16.67%, #5A30D9 25%, #5E36DB 33.33%, #623BDC 41.67%, #6640DD 50%, #6A44DE 58.33%, #6E49DF 66.67%, #734DE0 75%, #7751E1 83.33%, #7B55E2 91.67%, #8059E3 100%)",
            }}
          >
            Book an Appointment
          </button>
        </div>
      </div>
    </section>
  );
};

// Helper Tag Component
const Tag = ({ text }: { text: string }) => (
  <span className="px-5 py-2 rounded-[40px] text-white text-[14.8px] tracking-[-0.463px] bg-gradient-to-r from-[rgba(79,26,214,0.20)] to-[#220F42] border border-white/5">
    {text}
  </span>
);

export default ShapingFuture;
