import type { CatalogTreePackage, CatalogTreeService } from "@/types/catalog.type";

/**
 * Quotation blueprint: the defaults a catalog service / package carries so the wizard can
 * pre-fill every step. A package blueprint overrides its service's blueprint per top-level key.
 * Anything not set stays blank — nothing is invented.
 */
export type FlowType = "project" | "retainer" | "production";

export interface BlueprintInclusion {
    key: string;
    label: string;
    kind: "domain" | "hosting" | "support" | "other";
    included: boolean;
    termMonths: number | null;
    owner: "" | "client" | "agency";
    /** A renewal timer is created when the quotation becomes an order. */
    renews: boolean;
    /** Price added to the quotation when this item is switched off. */
    charge: number;
    note: string;
}

export interface Blueprint {
    designMode?: "template" | "custom" | "";
    inclusions?: BlueprintInclusion[];
    revisions?: { ui: number | null; dev: number | null; uiExtraFee: number | null; devExtraFee: number | null };
    paymentMilestones?: { label: string; percentage: number; note: string }[];
    policies?: {
        graceDays: number | null;
        suspendDays: number | null;
        cancelNoticeDays: number | null;
        extraFeatureRate: number | null;
        hourlyRate: number | null;
        validityDays: number | null;
        ownership: "" | "client" | "portfolio" | "custom";
    };
}

/** Used when neither the package nor the service defines a value (agency defaults). */
export const DEFAULT_BLUEPRINT: Required<Pick<Blueprint, "paymentMilestones" | "revisions">> = {
    paymentMilestones: [
        { label: "Advance Payment", percentage: 50, note: "Upon quotation acceptance" },
        { label: "Final Payment", percentage: 50, note: "After project handover" },
    ],
    revisions: { ui: 3, dev: 5, uiExtraFee: 0, devExtraFee: 0 },
};

/** Old records have no flowType: infer it from how the service is priced. */
export const flowOf = (s?: CatalogTreeService | null): FlowType =>
    s?.flowType ?? (s?.pricingMode === "unit" ? "production" : s?.quotationCategory === "marketing" ? "retainer" : "project");

export function resolveBlueprint(svc?: CatalogTreeService | null, pkg?: CatalogTreePackage | null): Blueprint {
    const a = (svc?.blueprint ?? {}) as Blueprint;
    const b = (pkg?.blueprint ?? {}) as Blueprint;
    const pick = <K extends keyof Blueprint>(k: K): Blueprint[K] => {
        const v = b[k];
        return (Array.isArray(v) ? v.length : v !== undefined && v !== null) ? v : a[k];
    };
    return {
        designMode: pick("designMode"),
        inclusions: pick("inclusions"),
        revisions: pick("revisions") ?? DEFAULT_BLUEPRINT.revisions,
        paymentMilestones: pick("paymentMilestones")?.length ? pick("paymentMilestones") : DEFAULT_BLUEPRINT.paymentMilestones,
        policies: pick("policies"),
    };
}
