"use client";

import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";

interface PremiumCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  accent?: "purple" | "violet" | "magenta" | "neutral";
}

export const PremiumCard: React.FC<PremiumCardProps> = ({
  children,
  className = "",
  footer,
  accent = "neutral",
  ...props
}) => {
  const accentThemes = {
    purple: {
      border: "border-[#4E12D4]/20 dark:border-[#4E12D4]/30",
      topGlow: "from-[#4E12D4]/15 via-[#4E12D4]/5 to-transparent",
    },
    violet: {
      border: "border-[#1E0078]/20 dark:border-[#1E0078]/30",
      topGlow: "from-[#1E0078]/15 via-[#1E0078]/5 to-transparent",
    },
    magenta: {
      border: "border-[#C850FA]/20 dark:border-[#C850FA]/30",
      topGlow: "from-[#C850FA]/15 via-[#C850FA]/5 to-transparent",
    },
    neutral: {
      border: "border-slate-200/80 dark:border-slate-800/80",
      topGlow: "from-slate-500/5 via-transparent to-transparent",
    },
  };

  const theme = accentThemes[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`relative rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border ${theme.border} shadow-sm transition-all duration-300 overflow-hidden ${className}`}
      {...props}
    >
      {/* Subtle top ambient glow - no boxy header bars! */}
      <div
        className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b ${theme.topGlow} pointer-events-none opacity-50`}
      />

      <div className="relative z-10 p-7 sm:p-8">{children}</div>

      {footer && (
        <div className="relative z-10 px-8 py-4 border-t border-slate-200/50 dark:border-slate-800/50 bg-slate-50/40 dark:bg-slate-900/40 flex items-center justify-end gap-3">
          {footer}
        </div>
      )}
    </motion.div>
  );
};
