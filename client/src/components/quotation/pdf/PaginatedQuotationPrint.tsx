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

type ServiceLineItem = {
  name: string;
  qty: number;
  rate: number;
  total: number;
};

const LOGO =
  "https://res.cloudinary.com/dny7zfbg9/image/upload/v1777996436/q83auvamwih8u8ftw5zu.png";

/** Shared wrap so tables stack with even spacing (print / paginated). */
const TABLE_SECTION =
  "mb-3 overflow-hidden rounded-lg border border-slate-100 bg-white";

const PRICING_GRADIENT: React.CSSProperties = {
  background: "linear-gradient(90deg, #A855F7, #4F46E5)",
};

function buildServiceLineItems(data: QuotationData): ServiceLineItem[] {
  const baseTitle =
    data.serviceType === "web-development"
      ? "Web Design & Development"
      : "Service";
  const phases = data.phases || [];
  const additionalServices = data.additionalServices || [];
  const pricing = data.pricing ?? { basePrice: 0, taxRate: 0, discount: 0 };
  const details = data.details ?? { title: "", date: "", validUntil: "" };

  const phaseRows: ServiceLineItem[] = phases.map((p, idx) => ({
    name: `Phase ${idx + 1}: ${p.title}${
      p.items?.length ? ` (${p.items.length} deliverables)` : ""
    }`,
    qty: 1,
    rate: 0,
    total: 0,
  }));

  const addOnRows: ServiceLineItem[] = additionalServices.map((s) => ({
    name: `${s.title} (${s.billingCycle})`,
    qty: 1,
    rate: s.price ?? 0,
    total: s.price ?? 0,
  }));

  return [
    {
      name: details.title ? `${baseTitle} — ${details.title}` : baseTitle,
      qty: 1,
      rate: pricing.basePrice ?? 0,
      total: pricing.basePrice ?? 0,
    },
    ...phaseRows,
    ...addOnRows,
  ];
}

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
    const nDeliverables = (ph.items || []).length;
    const phaseThead = (
      <thead>
        <tr className="border-b border-slate-100">
          <th className="bg-slate-50 px-3 py-2.5 text-left align-top font-normal">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="text-[13px] font-bold text-slate-900">
                Phase {pi + 1}: {ph.title}
              </span>
              <span className="text-[11.5px] font-normal text-slate-500">
                {nDeliverables} deliverables
              </span>
            </div>
          </th>
        </tr>
      </thead>
    );

    const bodyRows: React.ReactElement[] = [];
    if (ph.description?.trim()) {
      bodyRows.push(
        <tr key="desc" className="border-t border-slate-100">
          <td className="px-3 py-2.5 text-[12px] leading-relaxed text-slate-500">
            {ph.description}
          </td>
        </tr>,
      );
    }
    (ph.items || []).forEach((item, ii) => {
      bodyRows.push(
        <tr key={`b-${ii}`} className="border-t border-slate-100">
          <td className="px-3 py-2.5 text-[12px] leading-relaxed text-slate-700">
            <span className="mr-1.5 inline font-bold text-violet-600">•</span>
            {item}
          </td>
        </tr>,
      );
    });
    if (!bodyRows.length) {
      bodyRows.push(
        <tr key="empty" className="border-t border-slate-100">
          <td className="px-3 py-2.5 text-[11.5px] text-slate-400">
            No deliverables listed
          </td>
        </tr>,
      );
    }

    u.push({
      id: `unit-ph-${pi}-0`,
      groupId: `grp-phase-${pi}`,
      node: (
        <div className={TABLE_SECTION}>
          <table className="w-full border-collapse text-[12px]">
            {phaseThead}
            <tbody>{bodyRows[0]}</tbody>
          </table>
        </div>
      ),
    });

    for (let r = 1; r < bodyRows.length; r++) {
      u.push({
        id: `unit-ph-${pi}-${r}`,
        groupId: `grp-phase-${pi}`,
        node: (
          <div className={TABLE_SECTION}>
            <table className="w-full border-collapse text-[12px]">
              <tbody>{bodyRows[r]}</tbody>
            </table>
          </div>
        ),
      });
    }
  });

  const lineItems = buildServiceLineItems(data);
  const svcHead = (
    <tr className="border-b border-slate-100 bg-slate-50 text-[10.5px] font-extrabold uppercase tracking-wide text-slate-500">
      <th className="w-10 px-2 py-2.5 text-center font-extrabold">No.</th>
      <th className="px-3 py-2.5 text-left font-extrabold">Service</th>
      <th className="w-14 px-2 py-2.5 text-right font-extrabold">Qty</th>
      <th className="w-24 px-2 py-2.5 text-right font-extrabold">Rate</th>
      <th className="w-28 px-2 py-2.5 text-right font-extrabold">Total</th>
    </tr>
  );

  const svcRow = (row: ServiceLineItem, index: number) => (
    <tr className="border-t border-slate-100">
      <td className="px-2 py-2.5 text-center text-[12px] text-slate-600">
        {index + 1}
      </td>
      <td className="break-words px-3 py-2.5 text-[12px]">{row.name}</td>
      <td className="px-2 py-2.5 text-right text-[12px]">{row.qty}</td>
      <td className="px-2 py-2.5 text-right text-[12px] tabular-nums">
        {row.rate > 0 ? formatMoney(row.rate, currency) : "—"}
      </td>
      <td className="px-2 py-2.5 text-right text-[12px] font-medium tabular-nums">
        {row.total > 0 ? formatMoney(row.total, currency) : "—"}
      </td>
    </tr>
  );

  if (lineItems.length) {
    u.push({
      id: "unit-svc-0",
      groupId: "grp-services",
      node: (
        <div className={TABLE_SECTION}>
          <table className="w-full table-fixed border-collapse text-[12px]">
            <thead>{svcHead}</thead>
            <tbody>{svcRow(lineItems[0], 0)}</tbody>
          </table>
        </div>
      ),
    });
    for (let i = 1; i < lineItems.length; i++) {
      u.push({
        id: `unit-svc-${i}`,
        groupId: "grp-services",
        node: (
          <div className={TABLE_SECTION}>
            <table className="w-full table-fixed border-collapse text-[12px]">
              <tbody>{svcRow(lineItems[i], i)}</tbody>
            </table>
          </div>
        ),
      });
    }
  }

  const pricing = data.pricing ?? { taxRate: 0, discount: 0, basePrice: 0 };
  const discountAmount =
    pricing.discount && totals.subtotal
      ? (totals.subtotal * pricing.discount) / 100
      : 0;

  type SumRow = {
    key: string;
    label: React.ReactNode;
    value: string;
    valueClass?: string;
    rowClass?: string;
  };

  const pricingRows: SumRow[] = [
    {
      key: "sub",
      label: "Subtotal",
      value: formatMoney(totals.subtotal, currency),
    },
  ];

  if (pricing.taxRate != null && Number(pricing.taxRate) > 0) {
    pricingRows.push({
      key: "tax",
      label: `Tax (${pricing.taxRate}%)`,
      value: formatMoney(totals.taxAmount, currency),
    });
  }

  if (pricing.discount) {
    pricingRows.push({
      key: "disc",
      label: `Discount (${pricing.discount}%)`,
      value: `−${formatMoney(discountAmount, currency)}`,
      valueClass: "text-red-600",
      rowClass: "border-b border-slate-100",
    });
  } else {
    pricingRows.push({
      key: "disc",
      label: "Discount",
      value: formatMoney(0, currency),
      rowClass: "border-b border-slate-100",
    });
  }

  pricingRows.push({
    key: "total",
    label: "Grand Total",
    value: formatMoney(totals.grandTotal, currency),
    rowClass: "bg-slate-50/90",
  });

  const pricingThead = (
    <thead>
      <tr>
        <th
          colSpan={2}
          className="px-4 py-3 text-left text-[13px] font-extrabold tracking-wide text-white"
          style={PRICING_GRADIENT}
        >
          Pricing Breakdown
        </th>
      </tr>
    </thead>
  );

  const pricingTr = (row: SumRow) => (
    <tr
      key={row.key}
      className={`border-t border-slate-100 text-[12px] ${row.rowClass ?? ""}`}
    >
      <td
        className={`px-4 py-2.5 ${
          row.key === "total" ? "text-[16px] font-extrabold text-slate-900" : ""
        }`}
      >
        {row.label}
      </td>
      <td
        className={`px-4 py-2.5 text-right tabular-nums ${row.valueClass ?? ""} ${
          row.key === "total" ? "text-[16px] font-extrabold text-slate-900" : ""
        }`}
      >
        {row.value}
      </td>
    </tr>
  );

  u.push({
    id: "unit-price-0",
    groupId: "grp-pricing",
    node: (
      <div className={TABLE_SECTION}>
        <table className="w-full border-collapse text-[12px]">
          {pricingThead}
          <tbody>{pricingTr(pricingRows[0])}</tbody>
        </table>
      </div>
    ),
  });
  for (let p = 1; p < pricingRows.length; p++) {
    u.push({
      id: `unit-price-${p}`,
      groupId: "grp-pricing",
      node: (
        <div className={TABLE_SECTION}>
          <table className="w-full border-collapse text-[12px]">
            <tbody>{pricingTr(pricingRows[p])}</tbody>
          </table>
        </div>
      ),
    });
  }

  const milestones =
    data.paymentMilestones?.length ? data.paymentMilestones : [
        { label: "Upfront", percentage: 50 },
        { label: "Delivery", percentage: 30 },
        { label: "Final", percentage: 20 },
      ];

  const payThead = (
    <thead>
      <tr className="border-b border-slate-100">
        <th
          colSpan={3}
          className="bg-slate-50 px-3 py-2.5 text-left text-[10.5px] font-extrabold uppercase tracking-wide text-slate-500"
        >
          Payment Terms
        </th>
      </tr>
    </thead>
  );

  const payRow = (m: (typeof milestones)[0], mi: number) => {
    const amt = (totals.grandTotal * (m.percentage || 0)) / 100;
    return (
      <tr key={mi} className="border-t border-slate-100">
        <td className="w-[52px] px-3 py-2.5 align-top">
          <span className="inline-block min-w-[40px] rounded bg-violet-100 px-2 py-0.5 text-center text-[11px] font-extrabold text-violet-700">
            {m.percentage}%
          </span>
        </td>
        <td className="px-2 py-2.5 text-[12px] leading-relaxed text-slate-700">
          {m.label}
        </td>
        <td className="px-3 py-2.5 text-right text-[12px] font-bold tabular-nums text-slate-900">
          {formatMoney(amt, currency)}
        </td>
      </tr>
    );
  };

  u.push({
    id: "unit-pay-0",
    groupId: "grp-payment",
    node: (
      <div className={TABLE_SECTION}>
        <table className="w-full table-fixed border-collapse text-[12px]">
          {payThead}
          <tbody>{payRow(milestones[0], 0)}</tbody>
        </table>
      </div>
    ),
  });
  for (let mi = 1; mi < milestones.length; mi++) {
    u.push({
      id: `unit-pay-${mi}`,
      groupId: "grp-payment",
      node: (
        <div className={TABLE_SECTION}>
          <table className="w-full table-fixed border-collapse text-[12px]">
            <tbody>{payRow(milestones[mi], mi)}</tbody>
          </table>
        </div>
      ),
    });
  }

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
