"use client";

import { format } from "date-fns";
import React, { Fragment, useMemo } from "react";
import { formatMoney } from "@/lib/money";
import type { QuotationData } from "@/types/quotation.type";
import { LAST_PAGE_MIN_FILL } from "./pagination/constants";
import { lastPageSpacerPx } from "./pagination/packGroupedUnits";
import { MeasureShell, usePaginatedLayout } from "./pagination/usePaginatedLayout";

type UnitDef = {
  id: string;
  groupId: string;
  node: React.ReactNode;
};

const LOGO =
  "https://res.cloudinary.com/dny7zfbg9/image/upload/v1777996436/q83auvamwih8u8ftw5zu.png";

function clientPayLink(data: QuotationData): string | null {
  const base = process.env.NEXT_PUBLIC_PAYMENT_URL;
  if (!base || !data.secureToken) return null;
  return `${base.replace(/\/$/, "")}/quotation/${data.secureToken}`;
}

function buildUnitDefs(data: QuotationData): UnitDef[] {
  const u: UnitDef[] = [];
  const currency = data.currency || "BDT";
  const totals = data.totals ?? {
    subtotal: 0,
    taxAmount: 0,
    grandTotal: 0,
  };

  u.push({
    id: "unit-header",
    groupId: "grp-header",
    node: (
      <header className="flex justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex h-12 w-[148px] items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.company?.logo || LOGO}
            alt=""
            width={148}
            height={48}
            className="max-h-12 w-auto object-contain object-left"
          />
        </div>
        <div className="text-right">
          <div
            className="text-2xl font-extrabold tracking-wide"
            style={{
              background: "linear-gradient(180deg, #A855F7, #4F46E5)",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            QUOTATION
          </div>
          <div className="mt-2 text-[11.5px] text-slate-500">
            Ref:{" "}
            <span className="font-semibold text-slate-900">
              {data.quotationNumber || "TBD"}
            </span>
          </div>
          <div className="text-[11.5px] text-slate-500">
            Date:{" "}
            <span className="font-semibold text-slate-900">
              {data.details?.date
                ? format(new Date(data.details.date), "PPP")
                : "—"}
            </span>
          </div>
        </div>
      </header>
    ),
  });

  u.push({
    id: "unit-billing",
    groupId: "grp-billing",
    node: (
      <div className="grid grid-cols-2 gap-6 text-[12px] leading-relaxed text-slate-600">
        <div>
          <div className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-violet-600">
            Bill From
          </div>
          <div className="font-bold text-slate-900">
            {data.company?.name || "Company"}
          </div>
          {data.company?.address && <div>{data.company.address}</div>}
          {data.company?.email && <div>{data.company.email}</div>}
        </div>
        <div className="text-right">
          <div className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-violet-600">
            Bill To
          </div>
          <div className="font-bold text-slate-900">
            {data.client?.contactName}
          </div>
          {data.client?.companyName && <div>{data.client.companyName}</div>}
        </div>
      </div>
    ),
  });

  u.push({
    id: "unit-project",
    groupId: "grp-project",
    node: (
      <div className="rounded-lg border border-slate-100 p-4">
        <div className="text-[17px] font-extrabold text-slate-900">
          {data.details?.title || "Project"}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded border bg-slate-50 px-2 py-0.5 text-[9.5px] font-bold uppercase text-slate-500">
            {data.serviceType === "web-development" ? "WEB" : "SERVICE"}
          </span>
        </div>
      </div>
    ),
  });

  if (data.overview?.trim()) {
    const paras = data.overview.split(/\n\n+/).filter(Boolean);
    paras.forEach((para, i) => {
      u.push({
        id: `unit-ov-${i}`,
        groupId: `grp-overview-${i}`,
        node: (
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="text-[12px] leading-relaxed text-slate-700">{para}</p>
          </div>
        ),
      });
    });
  }

  (data.phases || []).forEach((ph, pi) => {
    u.push({
      id: `unit-ph-${pi}-head`,
      groupId: `grp-phase-${pi}`,
      node: (
        <div className="rounded-lg border border-slate-100 p-4">
          <div className="flex justify-between text-[13.5px] font-bold text-slate-900">
            <span>
              Phase {pi + 1}: {ph.title}
            </span>
            <span className="text-[11.5px] font-normal text-slate-500">
              {(ph.items || []).length} items
            </span>
          </div>
          {ph.description && (
            <p className="mt-2 text-[12px] text-slate-500">{ph.description}</p>
          )}
        </div>
      ),
    });
    (ph.items || []).forEach((item, ii) => {
      u.push({
        id: `unit-ph-${pi}-b-${ii}`,
        groupId: `grp-phase-${pi}`,
        node: (
          <div className="ml-4 flex gap-2 text-[12px] leading-relaxed text-slate-700">
            <span className="font-bold text-violet-600">•</span>
            <span>{item}</span>
          </div>
        ),
      });
    });
  });

  const lineItems: {
    name: string;
    qty: number;
    rate: number;
    total: number;
  }[] = [
    {
      name: data.details?.title || "Project",
      qty: 1,
      rate: data.pricing?.basePrice ?? 0,
      total: data.pricing?.basePrice ?? 0,
    },
  ];

  u.push({
    id: "unit-services-table",
    groupId: "grp-services",
    node: (
      <div className="overflow-hidden rounded-lg border border-slate-100">
        <table className="w-full table-fixed text-[12px]">
          <thead>
            <tr className="bg-slate-50 text-[10.5px] font-extrabold uppercase text-slate-500">
              <th className="px-3 py-2.5 text-left">Service</th>
              <th className="w-14 px-2 py-2.5 text-right">Qty</th>
              <th className="w-24 px-2 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((row, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="break-words px-3 py-2.5">{row.name}</td>
                <td className="px-2 py-2.5 text-right">{row.qty}</td>
                <td className="px-2 py-2.5 text-right font-medium tabular-nums">
                  {formatMoney(row.total, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  });

  u.push({
    id: "unit-pricing",
    groupId: "grp-pricing",
    node: (
      <div className="overflow-hidden rounded-lg border border-slate-100">
        <div
          className="px-4 py-3 text-[13px] font-extrabold text-white"
          style={{
            background: "linear-gradient(90deg, #A855F7, #4F46E5)",
          }}
        >
          Pricing Breakdown
        </div>
        <div className="space-y-2 p-4 text-[12px]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="tabular-nums">
              {formatMoney(totals.subtotal, currency)}
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2 text-[16px] font-extrabold">
            <span>Grand Total</span>
            <span className="tabular-nums">
              {formatMoney(totals.grandTotal, currency)}
            </span>
          </div>
        </div>
      </div>
    ),
  });

  const milestones =
    data.paymentMilestones?.length ? data.paymentMilestones : [
        { label: "Upfront", percentage: 50 },
        { label: "Delivery", percentage: 30 },
        { label: "Final", percentage: 20 },
      ];

  milestones.forEach((m, mi) => {
    const amt = (totals.grandTotal * (m.percentage || 0)) / 100;
    u.push({
      id: `unit-pay-${mi}`,
      groupId: "grp-payment",
      node: (
        <div className="flex min-h-[44px] items-start gap-3 border-b border-slate-100 px-4 py-3 text-[12px] last:border-0">
          <span className="min-w-[44px] rounded bg-violet-100 px-2 py-0.5 text-center font-extrabold text-violet-700">
            {m.percentage}%
          </span>
          <span className="flex-1 text-slate-700">{m.label}</span>
          <span className="font-bold tabular-nums text-slate-900">
            {formatMoney(amt, currency)}
          </span>
        </div>
      ),
    });
  });

  const trustCopy = [
    {
      t: "Strategic Product Thinking",
      d: "We align scope, milestones, and outcomes with your goals—so you invest in impact, not busywork.",
    },
    {
      t: "Modern Scalable Tech Stack",
      d: "Future-ready tooling and architecture that grow with you and keep maintenance predictable.",
    },
    {
      t: "Transparent & Phased Delivery",
      d: "Clear phases, visible progress, and pricing tied to accountable checkpoints you can trust.",
    },
    {
      t: "Reliable Communication & Support",
      d: "Proactive updates, responsive collaboration, and partnership that continues after go-live.",
    },
  ];

  u.push({
    id: "unit-trust-title",
    groupId: "grp-trust",
    node: (
      <div className="mt-12 border-b border-violet-200/40 pb-4">
        <h2 className="text-[16.5px] font-extrabold text-slate-900">
          Why Choose{" "}
          <span className="bg-gradient-to-r from-violet-500 to-indigo-600 bg-clip-text text-transparent">
            WebBriks
          </span>
        </h2>
      </div>
    ),
  });

  trustCopy.forEach((row, ti) => {
    u.push({
      id: `unit-trust-${ti}`,
      groupId: "grp-trust",
      node: (
        <div>
          <div className="text-[12.5px] font-bold text-slate-900">{row.t}</div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
            {row.d}
          </p>
        </div>
      ),
    });
  });

  const pay = clientPayLink(data);
  u.push({
    id: "unit-cta",
    groupId: "grp-cta",
    node: (
      <div className="rounded-xl border border-slate-100 bg-gradient-to-b from-violet-50/80 to-white p-5">
        <div className="text-[11px] font-extrabold tracking-wide text-indigo-800">
          SECURE ONLINE PAYMENT
        </div>
        <p className="mt-2 max-w-xl text-[12px] text-slate-500">
          Use the secure portal to review and accept this quotation.
        </p>
        {pay ? (
          <a
            href={pay}
            className="mt-4 inline-block rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 px-5 py-3 text-[11px] font-extrabold tracking-wide text-white shadow-md"
          >
            View full quotation
          </a>
        ) : null}
      </div>
    ),
  });

  u.push({
    id: "unit-signature",
    groupId: "grp-sig",
    node: (
      <div className="max-w-xs pt-6">
        <div className="border-b border-slate-900 pb-2 text-[13px] font-extrabold text-slate-900">
          Md. Ashaduzzaman
        </div>
        <div className="mt-1 text-[11.5px] text-slate-500">
          Founder &amp; CEO, {data.company?.name || "WebBriks"}
        </div>
      </div>
    ),
  });

  return u;
}

export interface PaginatedQuotationPrintProps {
  data: QuotationData;
  measureKey?: string;
}

/**
 * Smart pagination: hidden measure pass (getBoundingClientRect), grouped packing
 * with 80% split rule, last-page footer pinned with optional fill spacer.
 */
export function PaginatedQuotationPrint({
  data,
  measureKey = "",
}: PaginatedQuotationPrintProps) {
  const defs = useMemo(() => buildUnitDefs(data), [data]);
  const key = `${data._id ?? ""}-${data.version ?? 0}-${measureKey}`;

  const { rootRef, assignments, unitById, pageHeight, pageWidth } =
    usePaginatedLayout(key);

  const unitNodeById = useMemo(() => {
    const m = new Map<string, React.ReactNode>();
    defs.forEach((d) => m.set(d.id, d.node));
    return m;
  }, [defs]);

  const lastSpacer =
    assignments && assignments.length
      ? lastPageSpacerPx(
          assignments[assignments.length - 1],
          unitById,
          pageHeight,
          LAST_PAGE_MIN_FILL,
        )
      : 0;

  const measureTree = (
    <div className="text-slate-700 antialiased">
      {defs.map((d) => (
        <div
          key={d.id}
          data-layout-unit
          data-unit-id={d.id}
          data-group-id={d.groupId}
          className="w-full"
        >
          {d.node}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <MeasureShell pageWidth={pageWidth} rootRef={rootRef}>
        {measureTree}
      </MeasureShell>

      <div className="quotation-print-root mx-auto bg-slate-200/50 p-4">
        {assignments === null ? (
          <div className="mx-auto rounded-lg bg-white p-8 text-center text-sm text-slate-500">
            Calculating layout…
          </div>
        ) : assignments.length === 0 ? (
          <div className="mx-auto rounded-lg bg-white p-8 text-center text-sm text-red-600">
            Could not measure printable layout. Try refreshing the page.
          </div>
        ) : (
          assignments.map((page, idx) => (
            <div
              key={page.pageIndex}
              className="quotation-print-page relative mx-auto mb-4 flex flex-col bg-white shadow-sm print:mb-0 print:shadow-none"
              style={{
                width: pageWidth,
                minHeight: pageHeight,
                padding: "8px 4px 16px",
              }}
            >
              <div className="flex flex-1 flex-col gap-3">
                {page.unitIds.map((id) => (
                  <Fragment key={id}>{unitNodeById.get(id)}</Fragment>
                ))}
              </div>

              {idx === assignments.length - 1 && (
                <div className="mt-auto flex flex-col">
                  {lastSpacer > 0 ? (
                    <div
                      className="shrink-0"
                      style={{ minHeight: lastSpacer }}
                      aria-hidden
                    />
                  ) : null}
                  <footer className="border-t border-slate-300 pt-4 text-center text-[10.5px] font-semibold text-slate-600">
                    WebBriks —{" "}
                    <a
                      className="text-indigo-600"
                      href="mailto:info@webbriks.com"
                    >
                      info@webbriks.com
                    </a>{" "}
                    —{" "}
                    <a
                      className="text-indigo-600"
                      href="https://www.webbriks.com"
                    >
                      www.webbriks.com
                    </a>
                  </footer>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  .quotation-print-root { background: white !important; padding: 0 !important; }
  .quotation-print-page {
    page-break-after: always;
    break-after: page;
    box-shadow: none !important;
    margin: 0 auto !important;
  }
  .quotation-print-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
}
@page { size: A4; margin: 12mm 10mm 14mm; }
`,
        }}
      />
    </>
  );
}
