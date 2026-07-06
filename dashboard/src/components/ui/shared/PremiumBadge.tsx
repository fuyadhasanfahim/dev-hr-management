"use client";

import React from "react";

export interface PremiumBadgeProps {
  children: React.ReactNode;
  variant?: "purple" | "violet" | "magenta" | "red" | "amber" | "outline" | "editorial";
  size?: "sm" | "md";
  className?: string;
  icon?: React.ReactNode;
}

export const PremiumBadge: React.FC<PremiumBadgeProps> = ({
  children,
  variant = "purple",
  size = "md",
  className = "",
  icon,
}) => {
  const sizeStyles = {
    sm: "text-[10px] px-2.5 py-0.5 gap-1 tracking-wider uppercase font-extrabold",
    md: "text-xs px-3 py-1 gap-1.5 font-bold tracking-wide",
  };

  const variantStyles = {
    purple: "bg-[#4E12D4]/10 text-[#4E12D4] dark:text-purple-300 border border-[#4E12D4]/25 shadow-2xs",
    violet: "bg-[#1E0078]/10 text-[#1E0078] dark:text-indigo-300 border border-[#1E0078]/25 shadow-2xs",
    magenta: "bg-[#C850FA]/10 text-[#C850FA] dark:text-pink-300 border border-[#C850FA]/25 shadow-2xs",
    red: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 shadow-2xs",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-2xs",
    outline: "bg-white/60 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-slate-700/80 backdrop-blur-sm",
    editorial: "bg-[#1E0078] text-white dark:bg-white dark:text-[#1E0078] font-mono tracking-widest uppercase text-[10px] px-2.5 py-0.5 shadow-sm",
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full transition-all select-none font-sans ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
