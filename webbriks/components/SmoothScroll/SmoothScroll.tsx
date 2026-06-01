"use client";

import { useEffect, useRef, ReactNode } from "react";
import { usePathname } from "next/navigation"; // Import this
import Lenis from "lenis";

export default function SmoothScroll({ children }: { children: ReactNode }) {
  const pathname = usePathname(); // Track route changes
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // 1. Initialize Lenis
    const lenis = new Lenis({
      duration: 1.2,
      lerp: 0.08,
      wheelMultiplier: 1,
      infinite: false,
      gestureOrientation: "vertical",
      smoothWheel: true,
    });

    lenisRef.current = lenis;

    // 2. Synchronization loop
    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    // 3. Cleanup on unmount
    return () => {
      lenis.destroy();
      cancelAnimationFrame(rafId);
    };
  }, []);

  // 4. THE FIX: Reset scroll to top and refresh Lenis on page change
  useEffect(() => {
    if (lenisRef.current) {
      // Immediately stop any ongoing scroll
      lenisRef.current.stop();
      
      // Scroll to top instantly
      window.scrollTo(0, 0);
      lenisRef.current.scrollTo(0, { immediate: true });
      
      // Re-calculate the new page height
      lenisRef.current.start();
    }
  }, [pathname]); // This runs every time the page changes

  return <>{children}</>;
}