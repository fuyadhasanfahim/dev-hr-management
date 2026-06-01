"use client";

import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, FreeMode } from "swiper/modules";
import { FaLinkedinIn } from "react-icons/fa6";
import SectionHeader from "@/components/SectionHeader/SectionHeader";

// Import Swiper styles
import "swiper/css";
import "swiper/css/free-mode";
import "swiper/css/autoplay";
import Image from "next/image";

const teamData = [
  {
    id: 1,
    name: "Md. Ashaduzzaman",
    role: "CEO and Founder",
    image: "/images/team/Ashaduzzaman.png",
    linkedin: "https://linkedin.com",
  },
  {
    id: 2,
    name: "Arif Rahaman",
    role: "Co-Founder",
    image: "/images/team/Arif.png",
    linkedin: "https://linkedin.com",
  },
  {
    id: 3,
    name: "Fardin Evan",
    role: "UI/UX Designer",
    image: "/images/team/Fardin.png",
    linkedin: "https://linkedin.com",
  },
  {
    id: 4,
    name: "Md Golam Sarwar",
    role: "Full Stack Developer",
    image: "/images/team/Sarwar.png",
    linkedin: "https://linkedin.com",
  },
  {
    id: 7,
    name: "Ashikur Rahman Bhuiyan",
    role: "Front-End Developer",
    image: "/images/team/Ashik.png",
    linkedin: "https://linkedin.com",
  },
  {
    id: 5,
    name: "Md Fuyad Hasan Fahim",
    role: "Full Stack Developer",
    image: "/images/team/Fuyad.png",
    linkedin: "https://linkedin.com",
  },
  {
    id: 6,
    name: "Md. Ruhul Amin",
    role: "Full Stack Developer",
    image: "/images/team/Ruhul.png",
    linkedin: "https://linkedin.com",
  },
  
  {
    id: 8,
    name: "Md. Al Imran",
    role: "UI/UX Designer",
    image: "/images/team/Imran.png",
    linkedin: "https://linkedin.com",
  },
  {
    id: 9,
    name: "Mamun Hasan",
    role: "Lead Marketer",
    image: "/images/team/Mamun.png",
    linkedin: "https://linkedin.com",
  },
  {
    id: 13,
    name: "Mamun Hasan",
    role: "Lead Marketer",
    image: "/images/team/Mamun.png",
    linkedin: "https://linkedin.com",
  },
  {
    id: 10,
    name: "Somaiya Akter",
    role: "Marketing Executive",
    image: "/images/team/Somaiya.png",
    linkedin: "https://linkedin.com",
  },
  {
    id: 11,
    name: "Nowshin Jahan Tisha",
    role: "Marketing Executive",
    image: "/images/team/Tisha.png",
    linkedin: "https://linkedin.com",
  },
  {
    id: 12,
    name: "Farhana Hossan Orpita",
    role: "Marketing Executive",
    image: "/images/team/Orpita.png",
    linkedin: "https://linkedin.com",
  },
];

const MemberCard = ({ member }: { member: (typeof teamData)[0] }) => {
  return (
    /* SECOND BORDER LAYER */
    <div className="p-[1px] overflow-hidden border border-white/10 rounded-[31px]">
      {/* MIDDLE LAYER: Card Body */}
      <div
        className="relative p-[10px] overflow-hidden h-full w-full"
        style={{
          borderRadius: "31px",
          background:
            "linear-gradient(0deg, rgba(0, 85, 254, 0.08) 0%, rgba(0, 85, 254, 0.04) 100%)",
          backdropFilter: "blur(2.5px)",
        }}
      >
        {/* FIRST BORDER LAYER: Image Container */}
        <div
          className="relative w-full aspect-[3/4] overflow-hidden"
          style={{
            borderRadius: "22px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <Image
            src={member.image}
            alt={member.name}
            fill
            className="object-cover transition-transform duration-500 hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
          />

          {/* Bottom Gradient Overlay to make text pop */}
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(0, 0, 0, 0.00) 65%, rgba(0, 0, 0, 0.80) 100%)",
            }}
          />

          {/* INFO BAR: Name (Left) and LinkedIn (Right) */}
          <div
            className="absolute bottom-3 left-3 right-3 z-30 p-3 md:p-4 flex items-center justify-between border border-white/10"
            style={{
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.02)",
              boxShadow: "0 10px 10px -1px rgba(0, 85, 255, 0.10) inset",
              backdropFilter: "blur(10px)",
            }}
          >
            {/* Left side: Identity */}
            <div className="flex flex-col text-left">
              <h3 className="text-white text-[14px] md:text-[16px] font-bold leading-tight tracking-[-0.5px]">
                {member.name}
              </h3>
              <p className="text-white/60 text-[12px] md:text-[14px] font-normal leading-tight">
                {member.role}
              </p>
            </div>

            {/* Right side: LinkedIn Link */}
            <a
              href={member.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95"
              style={{
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.00)",
                boxShadow:
                  "0 5px 25px 0 rgba(0, 85, 255, 0.25), 0 10px 10px -1px rgba(255, 255, 255, 0.08) inset",
              }}
            >
              <FaLinkedinIn size={16} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

const Team = () => {
  return (
    <section className="bg-[#01050A] py-20 overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-4 mb-16">
        <SectionHeader
          title="Meet The Team"
          description="Collaborative Minds, Singular Focus"
        />
      </div>

      {/* Swiper Slider */}
      <div className="w-full px-4 md:px-0">
        <Swiper
          modules={[Autoplay, FreeMode]}
          spaceBetween={24}
          slidesPerView={1.2}
          loop={true}
          freeMode={true}
          speed={6000}
          autoplay={{
            delay: 0,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
          }}
          breakpoints={{
            640: { slidesPerView: 2.2 },
            1024: { slidesPerView: 3.5 },
            1280: { slidesPerView: 4.5 },
          }}
          className="team-swiper"
        >
          {teamData.map((member) => (
            <SwiperSlide key={member.id}>
              <MemberCard member={member} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      <style jsx global>{`
        .team-swiper .swiper-wrapper {
          transition-timing-function: linear !important;
        }
      `}</style>
    </section>
  );
};

export default Team;
