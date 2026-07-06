"use client";

import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";

export interface PremiumButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: "primary" | "purple" | "outline" | "ghost" | "danger" | "magenta";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

export const PremiumButton: React.FC<PremiumButtonProps> = ({
  variant = "purple",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles =
    "relative inline-flex items-center justify-center font-semibold tracking-wide rounded-2xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none select-none font-sans overflow-hidden whitespace-nowrap";

  const sizeStyles = {
    sm: "text-xs px-4 py-2 gap-1.5",
    md: "text-sm px-5 py-2.5 gap-2",
    lg: "text-base px-7 py-3 gap-2.5",
  };

  const variantStyles = {
    primary:
      "bg-[#1E0078] hover:bg-[#1E0078]/90 text-white shadow-sm border border-[#1E0078] focus:ring-[#1E0078]",
    purple:
      "bg-gradient-to-r from-[#4E12D4] to-[#1E0078] hover:from-[#4E12D4]/90 hover:to-[#1E0078]/90 text-white shadow-sm shadow-[#4E12D4]/25 border border-[#4E12D4]/30 focus:ring-[#4E12D4]",
    magenta:
      "bg-gradient-to-r from-[#C850FA] to-[#4E12D4] hover:from-[#C850FA]/90 hover:to-[#4E12D4]/90 text-white shadow-sm shadow-[#C850FA]/25 border border-[#C850FA]/30 focus:ring-[#C850FA]",
    outline:
      "bg-white/60 dark:bg-slate-900/60 hover:bg-[#4E12D4]/5 text-slate-800 dark:text-slate-100 hover:text-[#4E12D4] dark:hover:text-[#C850FA] border border-slate-300/80 dark:border-slate-700/80 hover:border-[#4E12D4]/40 focus:ring-[#4E12D4] backdrop-blur-sm",
    ghost:
      "bg-transparent hover:bg-[#4E12D4]/10 text-slate-600 dark:text-slate-400 hover:text-[#4E12D4] dark:hover:text-[#C850FA] focus:ring-[#4E12D4]",
    danger:
      "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-sm shadow-red-500/20 border border-red-500/30 focus:ring-red-500",
  };

  return (
    <motion.button
      whileHover={{ scale: disabled || isLoading ? 1 : 1.015 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {/* Sheen effect for gradient buttons */}
      {["purple", "magenta", "danger"].includes(variant) && (
        <span className="absolute inset-0 w-1/2 h-full bg-white/15 skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-out pointer-events-none" />
      )}

      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <motion.svg
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
            className="h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </motion.svg>
          <span className="tracking-wider text-xs uppercase font-bold">Processing...</span>
        </span>
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </motion.button>
  );
};
