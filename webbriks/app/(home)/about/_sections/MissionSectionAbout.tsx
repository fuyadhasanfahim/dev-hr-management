"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { FaLinkedinIn } from "react-icons/fa6"; // React Icons
import { FiArrowUpRight } from "react-icons/fi";

const MissionSectionAbout = () => {
  return (
    <section className="bg-[#01050A] py-16 md:py-24 px-4 overflow-hidden">
      <div className="max-w-[1440px] px-4 mx-auto grid grid-cols-1 lg:grid-cols-15 gap-10 items-center">
        
        {/* LEFT SIDE: IMAGE (Col Span 4) */}
        <div className="lg:col-span-7 w-full h-full min-h-[300px] md:min-h-[500px] relative rounded-[24px] overflow-hidden">
          <Image
            src="/images/mission-team.png" // Replace with your image path
            alt="Our Team"
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* RIGHT SIDE: CONTENT (Col Span 6) */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          
          {/* Titles */}
          <div className="space-y-6">
            <h2 className="text-white text-[32px] md:text-[42px] font-bold leading-[1.2] md:leading-[50.4px]">
              Discover Who We Are and Our Mission
            </h2>
            <p className="text-[#6D7792] text-[16px] md:text-[18px] font-normal leading-[27px] ">
              Our journey began in 2014, when our Founder & Managing Director,
              Md. Ashaduzzaman, started as a passionate freelancer offering
              professional photo editing services to clients worldwide. With an
              unwavering commitment to quality and client satisfaction, he
              quickly built a reputation for delivering exceptional results.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Contact Us Button */}
            <Link
              href="/contact"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-3.5 rounded-[100px] text-white text-[18px] font-bold leading-[27px] transition-transform hover:scale-105 active:scale-95 bg-gradient-to-br from-[#9C46F4] via-[#6A25E0] via-[#390CA4] to-[#28048B]"
            >
              Contact Us <FiArrowUpRight size={20} />
            </Link>

            {/* View Projects Button */}
            <Link
              href="/projects"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-3.5 rounded-[100px] text-white text-[18px] font-medium leading-[27px] transition-all hover:bg-opacity-80 active:scale-95 border border-[#131839] bg-[radial-gradient(100%_100%_at_50%_100%,_#101636_14.38%,_#000633_100%)]"
            >
              View Projects <FiArrowUpRight size={20} />
            </Link>
          </div>

          {/* Founder Card */}
          <div className="inline-flex items-center justify-between gap-6 p-4 md:px-6 md:py-4 rounded-[16px] border border-[#131839] bg-[#00041F] w-fit min-w-[280px]">
            <div className="flex items-center gap-4">
              {/* Founder Avatar */}
              <div className="relative w-[47px] h-[47px] rounded-lg overflow-hidden shrink-0">
                <Image
                  src="/images/founder.png" // Replace with your image path
                  alt="Md. Ashaduzzaman"
                  fill
                  className="object-cover"
                />
              </div>
              
              {/* Founder Info */}
              <div className="flex flex-col">
                <h4 className="text-white text-[16px] font-bold leading-[22.4px]">
                  Md. Ashaduzzaman
                </h4>
                <p className="text-[#6D7792] uppercase text-[16px] font-normal leading-[24px]">
                  Ceo & Founder
                </p>
              </div>
            </div>

            {/* LinkedIn Icon */}
            <Link
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-[36px] h-[36px] flex items-center justify-center rounded-[10px] bg-[#000633] text-white hover:text-[#0077B5] transition-colors"
            >
              <FaLinkedinIn size={18} />
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
};

export default MissionSectionAbout;