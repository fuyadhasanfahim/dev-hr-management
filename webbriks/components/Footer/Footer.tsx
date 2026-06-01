"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { FaLinkedinIn, FaInstagram } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { HiArrowRight } from "react-icons/hi";

const Footer = () => {
  return (
    <footer className="relative bg-[#00041F] py-20 px-4 md:px-10 font-['Red_Rose'] overflow-hidden">
      {/* --- Top Left Background Decoration --- */}
  

      <div className="relative z-10 max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          
          {/* Column 1: Branding & CTA */}
          <div className="flex flex-col gap-6">
            <Image 
              src="/wb-logo.png" 
              alt="Webbriks Logo" 
              width={180} 
              height={50} 
              className="object-contain"
            />
            
            <div className="flex flex-col gap-3">
              <h3 className="text-white text-[20px] font-semibold leading-[30px]">
                Book a Call For Free Consultation
              </h3>
              <p className="text-[#A7ADBE] text-[18px] font-normal leading-[27px] max-w-[300px]">
                Experienced team delivering exceptional digital solutions tailored to your brand.
              </p>
            </div>

            <button 
              className="w-fit flex items-center gap-2 px-8 py-3 rounded-full text-white text-[18px] font-medium leading-[27px] transition-transform hover:scale-105 active:scale-95"
              style={{
                background: "linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)"
              }}
            >
              Contact Us <HiArrowRight className="text-xl" />
            </button>

            <div className="flex flex-col gap-4 mt-4">
              <span className="text-[#A7ADBE] text-[18px] font-medium leading-[27px]">
                Our Social Handels
              </span>
              <div className="flex gap-3">
                {[
                  { icon: <FaLinkedinIn />, href: "#" },
                  { icon: <FaXTwitter />, href: "#" },
                  { icon: <FaInstagram />, href: "#" }
                ].map((social, idx) => (
                  <Link 
                    key={idx} 
                    href={social.href}
                    className="w-10 h-10 bg-[#161C44] rounded-[10px] flex items-center justify-center text-white transition-all hover:bg-[#1A4FFF] hover:-translate-y-1"
                  >
                    {social.icon}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="flex flex-col gap-8 lg:pl-10">
            <h4 className="text-[#F0F1F4] text-[20px] font-medium leading-[30px]">
              Quick Links
            </h4>
            <ul className="flex flex-col gap-5">
              {[
                "Terms and Conditions",
                "Privacy Policy",
                "Refund Policy",
                "Disclaimer Policy",
                "Career"
              ].map((link) => (
                <li key={link}>
                  <Link 
                    href="#" 
                    className="text-[#A7ADBE] text-[20px] font-medium leading-[30px] hover:text-white transition-colors"
                  >
                    {link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Our Service */}
          <div className="flex flex-col gap-8">
            <h4 className="text-[#F0F1F4] text-[20px] font-medium leading-[30px]">
              Our Service
            </h4>
            <ul className="flex flex-col gap-5">
              {[
                "Web Design & Development",
                "Software Development",
                "End to End E-commerce Solution",
                "Waitlist",
                "Privacy policy"
              ].map((service) => (
                <li key={service}>
                  <Link 
                    href="#" 
                    className="text-[#A7ADBE] text-[18px] font-medium leading-[27px] hover:text-white transition-colors"
                  >
                    {service}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Contact & Offices */}
          <div className="flex flex-col gap-8">
            <h4 className="text-white text-[20px] font-medium leading-[30px]">
              Contact
            </h4>
            
            <div className="flex flex-col gap-8">
              {/* USA Office */}
              <div className="flex flex-col gap-2">
                <span className="text-[rgba(26,79,255,0.99)] text-[18px] font-medium leading-[27px]">
                  USA Office
                </span>
                <p className="text-[#A7ADBE] text-[16px] leading-relaxed">
                  Web briks . 1209 Mountain Road PL NE, STE A, Albuquerque, NM 87110, US
                </p>
              </div>

              {/* Dhaka Office */}
              <div className="flex flex-col gap-2">
                <span className="text-[rgba(26,79,255,0.99)] text-[18px] font-medium leading-[27px]">
                  Dhaka Office
                </span>
                <p className="text-[#A7ADBE] text-[16px] leading-relaxed">
                  115 Senpara Parbata (3rd floor of Sheltech Rubynur), Begum Rokeya Avenue, Mirpur, Dhaka 1216, Bangladesh.
                </p>
              </div>

              {/* Gaibandha Office */}
              <div className="flex flex-col gap-2">
                <span className="text-[rgba(26,79,255,0.99)] text-[18px] font-medium leading-[27px]">
                  Gaibandha Office
                </span>
                <p className="text-[#A7ADBE] text-[16px] leading-relaxed">
                  House: 106, 17/1 ZigZag Road, Gaibandha 5700
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[#A7ADBE] text-[14px]">
          <p>@2026, All Rights Reserved</p>
          <p>Made by Webbriks</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;