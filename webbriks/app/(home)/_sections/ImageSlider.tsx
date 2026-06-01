"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

interface SliderImage {
  id: number | string;
  src: string;
  alt: string;
}

interface ImageSliderProps {
  images: SliderImage[];
}

// Optimized Star Background: Uses only 3 divs with CSS background patterns
// instead of 80 separate motion divs.
const StarBackground = () => {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-40">
      <div className="stars-container" />
      <style jsx>{`
        .stars-container {
          position: absolute;
          width: 200%;
          height: 200%;
          background-image: radial-gradient(2px 2px at 20px 30px, #eee, rgba(0,0,0,0)),
                            radial-gradient(2px 2px at 40px 70px, #fff, rgba(0,0,0,0)),
                            radial-gradient(2px 2px at 50px 160px, #ddd, rgba(0,0,0,0));
          background-repeat: repeat;
          background-size: 200px 200px;
          animation: starPulse 4s ease-in-out infinite alternate;
        }
        @keyframes starPulse {
          from { opacity: 0.3; transform: scale(1); }
          to { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
};

const ImageSlider = ({ images }: ImageSliderProps) => {
  if (!images || images.length === 0) return null;

  // We double the images to create a seamless loop
  const displayImages = [...images, ...images, ...images];

  return (
    <section className="relative w-full bg-[#090F21] overflow-hidden">
      <StarBackground />

      {/* Side Gradients for fading effect */}
      <div className="absolute top-0 left-0 h-full w-[100px] md:w-[350px] z-20 pointer-events-none bg-gradient-to-r from-black to-transparent" />
      <div className="absolute top-0 right-0 h-full w-[100px] md:w-[350px] z-20 pointer-events-none bg-gradient-to-l from-black to-transparent" />

      <div className="relative z-10 flex overflow-hidden">
        <div className="flex animate-marquee hover:pause-animation">
          {displayImages.map((image, index) => (
            <div
              key={`${image.id}-${index}`}
              className="relative flex-shrink-0 w-[260px] h-[170px] mx-3 md:w-[550px] md:h-[400px] md:mx-5 rounded-2xl overflow-hidden group"
              style={{ willChange: "transform" }}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                className="object-cover transition-transform duration-700 "
                sizes="(max-width: 768px) 260px, 550px"
                priority={index < 4}
              />
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .animate-marquee {
          display: flex;
          width: fit-content;
          animation: marquee 60s linear infinite;
        }
        
        .pause-animation:hover {
          animation-play-state: paused;
        }

        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }

        /* Optimization for mobile: Reduce animation complexity */
        @media (max-width: 768px) {
          .animate-marquee {
            animation-duration: 40s;
          }
        }
      `}</style>
    </section>
  );
};

export default ImageSlider;