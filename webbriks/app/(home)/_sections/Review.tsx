"use client";

import React, { useState } from "react";
import { Play } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, FreeMode } from "swiper/modules";
import SectionHeader from "@/components/SectionHeader/SectionHeader";

// Import Swiper styles
import "swiper/css";
import "swiper/css/free-mode";
import "swiper/css/autoplay";

const reviewData = [
  {
    id: 1,
    name: "Ashikur Rahman Bhuiyan",
    role: "CEO, ThouhgtHub",
    thumbnail: "/images/ashikh.png", 
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: 2,
    name: "Ariful Islam",
    role: "Founder, TechNext",
    thumbnail: "/images/ashikh.png",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: 3,
    name: "Nahid Hasan",
    role: "Director, WebSolve",
    thumbnail: "/images/ashikh.png",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: 4,
    name: "Sabbir Ahmed",
    role: "Manager, CreativeIt",
    thumbnail: "/images/ashikh.png",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: 5,
    name: "Sabbir Ahmed",
    role: "Manager, CreativeIt",
    thumbnail: "/images/ashikh.png",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: 6,
    name: "Sabbir Ahmed",
    role: "Manager, CreativeIt",
    thumbnail: "/images/ashikh.png",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: 7,
    name: "Sabbir Ahmed",
    role: "Manager, CreativeIt",
    thumbnail: "/images/ashikh.png",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: 8,
    name: "Sabbir Ahmed",
    role: "Manager, CreativeIt",
    thumbnail: "/images/ashikh.png",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
];

const VideoCard = ({ review }: { review: typeof reviewData[0] }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    /* SECOND BORDER LAYER: Gradient Border Implementation */
    <div 
      className="p-[1px] overflow-hidden border border-white/10 rounded-[31px]" 
      
    >
      {/* MIDDLE LAYER: Card Body + 10px Gap (p-2.5) */}
      <div
        className="relative p-[10px] overflow-hidden group h-full w-full"
        style={{
          borderRadius: "31px",
          background: "linear-gradient(0deg, rgba(0, 85, 254, 0.08) 0%, rgba(0, 85, 254, 0.04) 100%)",
          backdropFilter: "blur(2.5px)",
        }}
      >
        {/* FIRST BORDER LAYER: Immediate Border around image/video */}
        <div 
          className="relative w-full aspect-[3/4] overflow-hidden"
          style={{
            borderRadius: "22px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          {!isPlaying ? (
            <>
              {/* Thumbnail */}
              <img
                src={review.thumbnail}
                alt={review.name}
                className="w-full h-full object-cover"
              />

              {/* Top Linear Gradient Overlay */}
              <div
                className="absolute inset-0 z-10 pointer-events-none"
                style={{
                  background: "linear-gradient(180deg, rgba(0, 0, 0, 0.00) 59%, rgba(0, 0, 0, 0.70) 77%, #000 100%)",
                }}
              />

              {/* Play Button */}
              <button
                onClick={() => setIsPlaying(true)}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
                style={{
                  borderRadius: "24px",
                  border: "1px solid #829FFF",
                  background: "rgba(255, 0, 0, 0.01)",
                }}
              >
                <Play className="text-[#829FFF] fill-[#829FFF] w-5 h-5 ml-1" />
              </button>
            </>
          ) : (
            <video
              src={review.videoUrl}
              autoPlay
              controls
              className="w-full h-full object-cover rounded-[21px]" // Slightly less than 22px to sit inside border
            />
          )}

          {/* Name and Title Container */}
          <div
            className="absolute bottom-4 left-4 right-4 z-30 p-4 flex flex-col items-center justify-center border border-white/10"
            style={{
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.02)",
              boxShadow: "0 10px 10px -1px rgba(0, 85, 255, 0.10) inset",
              backdropFilter: "blur(10px)",
            }}
          >
            <h3 className="text-white text-[16px] font-semibold leading-[26px] tracking-[-0.5px] font-redrose text-center">
              {review.name}
            </h3>
            <p className="text-white/60 text-[16px] font-normal leading-[26px] tracking-[-0.2px] font-redrose text-center">
              {review.role}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Review = () => {
  return (
    <section className="bg-[#01050A] py-20 overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-4 mb-16">
        <SectionHeader
          title="Client Success Stories"
          description="Discover what our clients say about their experiences and success working with us."
        />
      </div>

      {/* Swiper Slider Container */}
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
          className="review-swiper"
        >
          {reviewData.map((review) => (
            <SwiperSlide key={review.id}>
              <VideoCard review={review} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      <style jsx global>{`
        .review-swiper .swiper-wrapper {
          transition-timing-function: linear !important;
        }
      `}</style>
    </section>
  );
};

export default Review;