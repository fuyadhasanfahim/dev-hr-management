import { QuotationData, QuotationCategory, BillingCycle, IQuotationLineItem } from "@/types/quotation.type";

export const QUOTATION_TEMPLATES: Record<string, Partial<QuotationData>> = {};

/** Display labels for each billing cycle. */
export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  "one-time": "One-time",
  monthly: "Monthly",
  yearly: "Yearly",
  "per-image": "Per image",
  "per-video": "Per video",
  "per-second": "Per second",
  "per-10s": "Per 10 seconds",
};

/**
 * The set of form sections a category can expose. These keys are the single
 * source of truth that both TemplateBuilder and QuotationBuilder read from to
 * decide which sections to render.
 */
export type TemplateSection =
  | "overview"
  | "phases"
  | "services"
  | "techStack"
  | "pricing"
  | "milestones"
  | "workflow";

export interface CategoryDefinition {
  /** Human-readable label shown in dropdowns / headings. */
  label: string;
  /** Sections visible for this category. */
  sections: TemplateSection[];
  /** Whether project phases are enabled (web-development only). */
  phasesEnabled: boolean;
  /** Allowed billing cycles for line items in this category. */
  billingOptions: BillingCycle[];
  /** Whether line items are priced as unitPrice × quantity. */
  unitBased: boolean;
  /** Noun for a single unit when unitBased (e.g. "image", "video"). */
  unitLabel?: string;
}

/**
 * CATEGORY_CONFIG — the single config source for category-aware forms AND
 * business logic (phases on/off, allowed billing cycles, unit pricing).
 * Add a new category here (plus to the QuotationCategory union) and both
 * builders + totals logic pick it up automatically.
 */
export const CATEGORY_CONFIG: Record<QuotationCategory, CategoryDefinition> = {
  "web-development": {
    label: "Web Design & Development",
    sections: ["overview", "phases", "techStack", "pricing", "milestones", "workflow"],
    phasesEnabled: true,
    billingOptions: ["one-time", "monthly", "yearly"],
    unitBased: false,
  },
  "photo-editing": {
    label: "Photo Editing",
    sections: ["overview", "services", "pricing"],
    phasesEnabled: false,
    billingOptions: ["per-image"],
    unitBased: true,
    unitLabel: "image",
  },
  marketing: {
    label: "Marketing",
    sections: ["overview", "services", "workflow", "pricing"],
    phasesEnabled: false,
    billingOptions: ["monthly", "one-time"],
    unitBased: false,
  },
  "video-editing": {
    label: "Video Editing",
    sections: ["overview", "services", "pricing"],
    phasesEnabled: false,
    billingOptions: ["per-video", "per-second", "per-10s"],
    unitBased: true,
    unitLabel: "video",
  },
};

/** Typed list of categories derived from CATEGORY_CONFIG (for dropdowns). */
export const CATEGORY_OPTIONS: { value: QuotationCategory; label: string }[] = (
  Object.keys(CATEGORY_CONFIG) as QuotationCategory[]
).map((value) => ({ value, label: CATEGORY_CONFIG[value].label }));

/**
 * Resolve a category's full config, falling back to web-development for any
 * unknown/legacy/absent category. Single accessor that all behavior derives from.
 */
export function getCategoryConfig(
  category: QuotationCategory | undefined,
): CategoryDefinition {
  return (
    CATEGORY_CONFIG[category as QuotationCategory] ??
    CATEGORY_CONFIG["web-development"]
  );
}

/** Resolve the visible sections for a category (legacy/back-compat accessor). */
export function getCategorySections(
  category: QuotationCategory | undefined,
): TemplateSection[] {
  return getCategoryConfig(category).sections;
}

export function isPhasesEnabled(category: QuotationCategory | undefined): boolean {
  return getCategoryConfig(category).phasesEnabled;
}

export function getBillingOptions(
  category: QuotationCategory | undefined,
): BillingCycle[] {
  return getCategoryConfig(category).billingOptions;
}

export function isUnitBased(category: QuotationCategory | undefined): boolean {
  return getCategoryConfig(category).unitBased;
}

export function getUnitLabel(
  category: QuotationCategory | undefined,
): string | undefined {
  return getCategoryConfig(category).unitLabel;
}

/** Default billing cycle for a new line item in this category. */
export function getDefaultBillingCycle(
  category: QuotationCategory | undefined,
): BillingCycle {
  return getCategoryConfig(category).billingOptions[0] ?? "one-time";
}

/**
 * Suggested (prefillable) add-on line items per category — mostly the mixed
 * one-time/recurring charges (hosting, domain, ad retainers) that agencies
 * commonly forget to price separately. Purely a UI convenience: "Add Suggested"
 * copies one of these into the service's lineItems instead of starting blank.
 */
export const SUGGESTED_LINE_ITEMS: Record<QuotationCategory, IQuotationLineItem[]> = {
  "web-development": [
    { title: "Web Hosting (Cloud VPS)", price: 0, billingCycle: "yearly", description: "Hosting/server cost, billed separately from the project fee." },
    { title: "Domain Renewal", price: 0, billingCycle: "yearly", description: "Annual domain registration renewal." },
    { title: "Maintenance & Support Retainer", price: 0, billingCycle: "monthly", description: "Ongoing bug-fixing and minor update support." },
  ],
  marketing: [
    { title: "SEO Retainer", price: 0, billingCycle: "monthly", description: "Ongoing on-page/off-page SEO work." },
    { title: "Ad Campaign Management", price: 0, billingCycle: "monthly", description: "Facebook/Google Ads management fee (excludes ad spend)." },
    { title: "Campaign Setup", price: 0, billingCycle: "one-time", description: "One-time tracking, pixel, and campaign structure setup." },
  ],
  "photo-editing": [
    { title: "Photo Retouching (per image)", price: 0, billingCycle: "per-image", quantity: 1, description: "Background removal, color correction, retouching." },
  ],
  "video-editing": [
    { title: "Video Editing (per video)", price: 0, billingCycle: "per-video", quantity: 1, description: "Cutting, color grading, captions, and export." },
  ],
};

/**
 * Canonical per-line amount used by ALL totals computations:
 *   amount = price × (quantity ?? 1)
 * For non-unit categories quantity is absent ⇒ ×1, so web-development is
 * byte-identical to the previous `price`-only behavior.
 */
export function lineItemAmount(item: {
  price?: number;
  quantity?: number;
}): number {
  return (item.price || 0) * (item.quantity ?? 1);
}
