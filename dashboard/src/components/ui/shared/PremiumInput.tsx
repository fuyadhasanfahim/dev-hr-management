"use client";

import React from "react";

export interface PremiumInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  helperText?: string;
}

export const PremiumInput = React.forwardRef<HTMLInputElement, PremiumInputProps>(
  ({ label, error, leftIcon, rightIcon, helperText, className = "", id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-2 font-sans">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[11px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400 select-none"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center group">
          {leftIcon && (
            <div className="absolute left-4 text-[#4E12D4] dark:text-[#C850FA] pointer-events-none flex items-center transition-colors">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#4E12D4]/30 focus:border-[#4E12D4] transition-all duration-200 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed ${
              leftIcon ? "pl-11" : ""
            } ${rightIcon ? "pr-11" : ""} ${
              error ? "border-red-500 focus:ring-red-500/30 focus:border-red-500 bg-red-500/5" : ""
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-4 text-slate-400 dark:text-slate-500 flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        {helperText && !error && <p className="text-xs text-slate-400">{helperText}</p>}
        {error && <p className="text-xs text-red-500 font-semibold tracking-wide">{error}</p>}
      </div>
    );
  }
);

PremiumInput.displayName = "PremiumInput";
