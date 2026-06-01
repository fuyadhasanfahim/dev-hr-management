import Footer from "@/components/Footer/Footer";
import MouseMoving from "@/components/MouseMoving/MouseMoving";
import Navbar from "@/components/Navbar/Navbar";
import SmoothScroll from "@/components/SmoothScroll/SmoothScroll";
import { FloatingAIChat } from "@/components/ai-chat/FloatingAIChat";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Webbriks | Global Creative Agency",
  description:
    "Webbriks is a global creative agency that specializes in crafting innovative and impactful solutions for brands worldwide. With a team of talented designers, strategists, and storytellers, we bring ideas to life through compelling visuals, engaging content, and strategic campaigns. Our mission is to help brands connect with their audiences in meaningful ways and create memorable experiences that drive results.",
};

export default function HomeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Navbar />
      <MouseMoving/>

      <SmoothScroll>
        {children}
      </SmoothScroll>
      <Footer/>
      <FloatingAIChat />
    </>
  );
}
