"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { 
      name: "Services", 
      href: "/services", 
      subItems: ["Web Design & Development", "Software Development","End to End E-commerce Solution"] 
    },
    // { name: "Pricing", href: "/pricing" },
    { name: "Portfolio", href: "/portfolio" },
    // { 
    //   name: "Resource", 
    //   href: "#", 
    //   subItems: ["Blog", "Documentation", "Community"] 
    // },
    { name: "Sign in", href: "/signin" },
  ];

  return (
    // FIX: Added sticky, top-0, and z-[100] to ensure it stays above the hero section
    <nav className="sticky top-0 w-full bg-[#01050A]/80 backdrop-blur-md py-4 z-[100] border-b border-white/5">
      <div className="max-w-[1440px] mx-auto px-4 md:px-10 flex items-center justify-between">
        
        {/* Logo Section */}
        <Link href={"/"} className="flex-shrink-0 relative z-[101]">
          <Image 
            src="/wb-logo.png" 
            alt="Webbriks Logo" 
            width={140} 
            height={36} 
            className="object-contain"
          />
        </Link>

        {/* Central Nav Pill (Desktop) */}
        <div 
          style={{
            borderRadius: '12px',
            border: '1px solid #3366FF',
            background: 'rgba(15, 20, 35, 0.60)',
            boxShadow: '0 0 20px 0 rgba(51, 102, 255, 0.25), inset 0 0 20px 1px rgba(51, 102, 255, 0.50)',
            backdropFilter: 'blur(6px)',
          }}
          className="hidden lg:flex items-center px-8 py-2 relative"
        >
          <ul className="flex items-center gap-7">
            {navLinks.map((link) => (
              <li key={link.name} className="relative group">
                <Link
                  href={link.href}
                  className="flex items-center gap-1.5 text-[14px] font-bold text-white hover:text-blue-300 transition-colors"
                >
                  {link.name}
                  {link.subItems && (
                    <ChevronDown size={14} className="group-hover:rotate-180 transition-transform duration-300 opacity-70" />
                  )}
                </Link>

                {/* Dropdown Menu */}
                {link.subItems && (
                  <ul className="absolute top-[calc(100%+12px)] left-1/2 -translate-x-1/2 w-48 bg-[#0F1423] border border-[#3366FF]/30 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[110] p-2 shadow-2xl">
                    {link.subItems.map((sub) => (
                      <li key={sub}>
                        <Link href="#" className="block px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg">
                          {sub}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Right Section: Button + Mobile Toggle */}
        <div className="flex items-center gap-4 relative z-[101]">
          <button 
            style={{
              background: 'linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)'
            }}
            className="hidden sm:block px-6 py-2 rounded-[6px] text-[14px] font-semibold text-white shadow-lg hover:brightness-125 transition-all active:scale-95"
          >
            Contact Us
          </button>

          {/* Mobile Menu Toggle */}
          <button 
            className="lg:hidden p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden absolute top-full left-0 w-full bg-[#0F1423] border-b border-white/10 overflow-hidden z-[99]"
          >
            <ul className="flex flex-col p-6 gap-4">
              {navLinks.map((link) => (
                <li key={link.name}>
                  <div className="flex flex-col">
                    <Link 
                      href={link.href} 
                      className="text-lg font-semibold text-white py-2"
                      onClick={() => !link.subItems && setIsMobileMenuOpen(false)}
                    >
                      {link.name}
                    </Link>
                    {link.subItems && (
                      <div className="flex flex-col pl-4 border-l border-white/10 gap-2 mt-2">
                        {link.subItems.map(sub => (
                          <Link 
                            key={sub} 
                            href="#" 
                            className="text-white/60 py-1 text-sm"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            {sub}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
              <li className="pt-4 border-t border-white/10">
                <button 
                  style={{ background: 'linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)' }}
                  className="w-full py-3 rounded-lg font-bold text-white"
                >
                  Contact Us
                </button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;