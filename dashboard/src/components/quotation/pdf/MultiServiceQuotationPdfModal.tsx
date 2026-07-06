"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Printer, ShieldCheck } from "lucide-react";
import { PremiumButton } from "@/components/ui/shared/PremiumButton";
import { toast } from "sonner";
import { IPaymentMilestone } from "@/types/quotation.type";
import { publicApiUrl } from "@/lib/public-api";

export interface ServiceCategoryScope {
  id: string;
  label: string;
  badgeText: string;
  items: string[];
}

export interface MultiServiceQuotationPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotationNo: string;
  issueDate: string;
  validUntil: string;
  clientName: string;
  clientEmail: string;
  proposalTitle: string;
  finalAmount: number;
  activeScopes: ServiceCategoryScope[];
  notIncludedItems: string[];
  clientRequirements: string[];
  paymentMilestones?: IPaymentMilestone[];
  overview?: string;
  quotationId?: string;
  logoUrl?: string;
  signatureUrl?: string;
}

const DEFAULT_LOGO = "https://res.cloudinary.com/dny7zfbg9/image/upload/v1777996436/q83auvamwih8u8ftw5zu.png";
const DEFAULT_SIGNATURE = "https://res.cloudinary.com/dny7zfbg9/image/upload/v1776961131/ouvycul8e7xskhrioca4.png";

export const MultiServiceQuotationPdfModal: React.FC<MultiServiceQuotationPdfModalProps> = ({
  isOpen,
  onClose,
  quotationNo,
  issueDate,
  validUntil,
  clientName,
  clientEmail,
  proposalTitle,
  finalAmount,
  activeScopes,
  notIncludedItems,
  clientRequirements,
  paymentMilestones,
  overview,
  quotationId,
  logoUrl = DEFAULT_LOGO,
  signatureUrl = DEFAULT_SIGNATURE,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 20 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-4xl rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8 font-sans"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-7 py-5 bg-[#1E0078] text-white border-b border-[#4E12D4]/30">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-md bg-gradient-to-r from-[#4E12D4] to-[#C850FA] text-[10px] font-extrabold uppercase tracking-widest text-white">
                Puppeteer PDF Preview
              </span>
              <h3 className="font-bold text-base tracking-tight">
                File: Quotation-{quotationNo}-{clientName.replace(/\s+/g, "")}.pdf
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-purple-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* PDF Layout Simulation */}
          <div className="p-10 max-h-[75vh] min-h-[750px] overflow-y-auto bg-white text-slate-800 font-sans flex flex-col justify-between">
            <div className="space-y-8">
              {/* Top Invoice Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-200 pb-7">
                <div className="flex items-center">
                  <img
                    src={logoUrl}
                    alt="WebBriks"
                    className="h-12 w-auto object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>

              <div className="text-left sm:text-right">
                <div className="inline-block px-3 py-1 rounded-lg bg-[#4E12D4]/10 text-[#4E12D4] text-xs font-extrabold uppercase tracking-widest mb-1.5 border border-[#4E12D4]/20">
                  OFFICIAL QUOTATION
                </div>
                <p className="text-lg font-black text-[#1E0078] font-mono-numbers">
                  #{quotationNo}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Issue Date: <span className="font-semibold text-slate-800">{issueDate}</span>
                </p>
                <p className="text-xs text-slate-500">
                  Valid Until: <span className="font-semibold text-[#C850FA]">{validUntil}</span>
                </p>
              </div>
            </div>

            {/* Proposal Title & Client Metadata Block */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-slate-50 p-6 rounded-2xl border border-slate-200/80">
              <div className="md:col-span-7">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">
                  Proposal Package Title
                </span>
                <h1 className="text-2xl font-serif font-extrabold tracking-tight text-[#1E0078]">
                  {proposalTitle || "Multi-Service Agency Proposal"}
                </h1>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {activeScopes.map((scope) => (
                    <span
                      key={scope.id}
                      className="px-2.5 py-0.5 rounded-full bg-[#1E0078] text-white text-[10px] font-bold uppercase tracking-wider"
                    >
                      {scope.badgeText}
                    </span>
                  ))}
                </div>
              </div>

              <div className="md:col-span-5 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#4E12D4] block mb-1">
                  Prepared For
                </span>
                <p className="text-base font-extrabold text-slate-900">{clientName}</p>
                <p className="text-xs text-slate-500 font-medium">{clientEmail}</p>
                <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold text-[#1E0078]">
                  <span>Grand Total Investment:</span>
                  <span className="text-lg font-mono text-[#1E0078]">
                    Tk {finalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {overview && (
              <div className="space-y-3">
                <h2 className="text-sm font-extrabold uppercase tracking-widest text-[#1E0078] flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-[#4E12D4] to-[#C850FA]" />
                  Executive Overview
                </h2>
                <div className="p-5 rounded-2xl bg-white border border-[#4E12D4]/20 text-xs text-slate-700 leading-relaxed shadow-xs">
                  {overview.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < overview.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Section 1: Multi-Service Partitioned Deliverables Scopes */}
            <div className="space-y-6">
              <h2 className="text-sm font-extrabold uppercase tracking-widest text-[#1E0078] flex items-center gap-2 border-b border-slate-200 pb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1E0078]" />
                1. Services & Deliverables Scope ({activeScopes.length} Modules)
              </h2>

              {activeScopes.map((scope, idx) => (
                <div key={scope.id} className="border border-[#4E12D4]/20 rounded-2xl overflow-hidden shadow-xs">
                  <div className="px-5 py-3 bg-gradient-to-r from-[#4E12D4]/10 via-[#C850FA]/5 to-transparent border-b border-[#4E12D4]/15 flex items-center justify-between">
                    <span className="font-extrabold text-xs uppercase tracking-wider text-[#1E0078]">
                      {String.fromCharCode(65 + idx)}. {scope.label}
                    </span>
                    <span className="text-[10px] font-extrabold text-[#4E12D4] bg-white px-2.5 py-0.5 rounded-full border border-[#4E12D4]/25 shadow-2xs">
                      {scope.items.length} Deliverables
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 bg-white">
                    {scope.items.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        className="flex items-center gap-3.5 px-5 py-3 bg-white hover:bg-slate-50/50"
                      >
                        <span className="w-6 h-6 rounded-md bg-gradient-to-br from-[#4E12D4] to-[#1E0078] text-white font-bold text-[11px] flex items-center justify-center shrink-0 font-mono shadow-xs">
                          {String(itemIdx + 1).padStart(2, "0")}
                        </span>
                        <span className="text-xs text-slate-800 font-semibold leading-relaxed">
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Three Columns: Exclusions, Requirements & Milestones */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="p-6 rounded-2xl bg-[#C850FA]/[0.04] border border-[#C850FA]/20">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#C850FA] mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#C850FA]" />
                  2. Not Included in Price
                </h3>
                <ul className="space-y-2.5">
                  {notIncludedItems.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-xs text-slate-700 font-semibold leading-relaxed"
                    >
                      <span className="text-[#C850FA] font-bold shrink-0 mt-0.5">✕</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 rounded-2xl bg-[#1E0078]/[0.04] border border-[#1E0078]/20">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#1E0078] mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#1E0078]" />
                  3. Client Needs to Provide
                </h3>
                <ul className="space-y-2.5">
                  {clientRequirements.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-xs text-slate-700 font-semibold leading-relaxed"
                    >
                      <span className="text-[#1E0078] font-bold shrink-0 mt-0.5">●</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 rounded-2xl bg-[#4E12D4]/[0.04] border border-[#4E12D4]/20">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#4E12D4] mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#4E12D4]" />
                  4. Payment Milestones
                </h3>
                <ul className="space-y-2.5">
                  {(paymentMilestones && paymentMilestones.length > 0
                    ? paymentMilestones
                    : [
                        { label: '30% Upfront Payment', percentage: 30 },
                        { label: '40% Midway Progress Milestone', percentage: 40 },
                        { label: '30% Final Delivery & Handover', percentage: 30 },
                      ]
                  ).map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start justify-between gap-2.5 text-xs text-slate-700 font-semibold leading-relaxed"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-[#4E12D4] font-bold shrink-0 mt-0.5">✔</span>
                        <span>{item.label}</span>
                      </div>
                      {item.percentage > 0 && (
                        <span className="font-mono text-[#4E12D4] font-extrabold shrink-0">{item.percentage}%</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom Signature Block */}
            <div className="pt-10 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-8 items-end">
              <div>
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                  <ShieldCheck className="w-4 h-4 text-[#4E12D4] stroke-[2.5]" />
                  Authorization Status
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  This quotation is valid for 14 days from the date of issue. Upon acceptance, a formal contract or project milestone invoice will be issued.
                </p>
              </div>

              <div className="text-left sm:text-right flex flex-col sm:items-end">
                <div className="h-14 mb-2">
                  <img
                    src={signatureUrl}
                    alt="Authorized Signature"
                    className="h-14 w-auto object-contain sm:ml-auto"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
                <div className="w-48 border-t border-slate-800 pt-2">
                  <p className="text-xs font-extrabold text-[#1E0078] uppercase tracking-wider">
                    Authorized Signature
                  </p>
                  <p className="text-[11px] text-slate-500">Founder &amp; CEO, WebBriks</p>
                </div>
              </div>
            </div>
            </div>

            {/* PDF Footer Meta */}
            <div className="pt-6 border-t border-slate-100 flex justify-center items-center gap-2 text-[11px] text-slate-400 font-semibold mt-auto">
              <span>
                &copy; {new Date().getFullYear()}{" "}
                <a
                  href="https://webbriks.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#4E12D4] hover:underline font-bold"
                >
                  WebBriks
                </a>
                . All rights reserved.
              </span>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-7 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Ready to attach to official client quotations.
            </span>
            <div className="flex items-center gap-3">
              <PremiumButton variant="outline" size="md" onClick={onClose}>
                Close Preview
              </PremiumButton>
              <PremiumButton
                variant="purple"
                size="md"
                onClick={async () => {
                  if (quotationId) {
                    const pdfApiUrl = publicApiUrl(`/api/quotations/${quotationId}/pdf/puppeteer`);
                    toast.loading(`Downloading Quotation-${quotationNo}.pdf...`, { id: "pdf-dl" });
                    try {
                      const res = await fetch(pdfApiUrl, { credentials: "include", mode: "cors" });
                      if (!res.ok) throw new Error("Download failed");
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `Quotation-${quotationNo}-${clientName.replace(/\s+/g, "")}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      toast.success(`Downloaded Quotation-${quotationNo}.pdf!`, { id: "pdf-dl" });
                      onClose();
                    } catch (e) {
                      toast.error("Failed to download PDF", { id: "pdf-dl" });
                    }
                  } else {
                    window.print();
                  }
                }}
                leftIcon={<Printer className="w-4 h-4 stroke-[2.5]" />}
              >
                Print / Download PDF
              </PremiumButton>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
