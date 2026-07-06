"use client";

import React from "react";

export interface PremiumTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const PremiumTextarea = React.forwardRef<
  HTMLTextAreaElement,
  PremiumTextareaProps
>(({ label, error, helperText, className = "", id, ...props }, ref) => {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="w-full space-y-2 font-sans">
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-[11px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400 select-none"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        ref={ref}
        className={`w-full rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 px-4 py-3.5 text-sm font-sans font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#4E12D4]/30 focus:border-[#4E12D4] transition-all duration-200 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed resize-y leading-relaxed ${
          error ? "border-red-500 focus:ring-red-500/30 focus:border-red-500 bg-red-500/5" : ""
        } ${className}`}
        {...props}
      />
      {helperText && !error && <p className="text-xs text-slate-400">{helperText}</p>}
      {error && <p className="text-xs text-red-500 font-semibold tracking-wide">{error}</p>}
    </div>
  );
});

PremiumTextarea.displayName = "PremiumTextarea";
