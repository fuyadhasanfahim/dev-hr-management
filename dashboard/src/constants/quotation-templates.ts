import { QuotationData, QuotationCategory } from "@/types/quotation.type";

export const QUOTATION_TEMPLATES: Record<string, Partial<QuotationData>> = {};

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
}

/**
 * CATEGORY_CONFIG — the single config source for category-aware forms.
 * Add a new category here (plus to the QuotationCategory union) and both
 * builders pick it up automatically.
 */
export const CATEGORY_CONFIG: Record<QuotationCategory, CategoryDefinition> = {
  "web-development": {
    label: "Web Design & Development",
    sections: ["overview", "phases", "techStack", "pricing", "milestones", "workflow"],
  },
  "photo-editing": {
    label: "Photo Editing",
    sections: ["overview", "services", "pricing"],
  },
  marketing: {
    label: "Marketing",
    sections: ["overview", "services", "workflow", "pricing"],
  },
  "video-editing": {
    label: "Video Editing",
    sections: ["overview", "services", "pricing"],
  },
};

/** Typed list of categories derived from CATEGORY_CONFIG (for dropdowns). */
export const CATEGORY_OPTIONS: { value: QuotationCategory; label: string }[] = (
  Object.keys(CATEGORY_CONFIG) as QuotationCategory[]
).map((value) => ({ value, label: CATEGORY_CONFIG[value].label }));

/**
 * Resolve the visible sections for a category, falling back to web-development
 * if an unknown/legacy category is encountered.
 */
export function getCategorySections(
  category: QuotationCategory | undefined,
): TemplateSection[] {
  return (
    CATEGORY_CONFIG[category as QuotationCategory]?.sections ??
    CATEGORY_CONFIG["web-development"].sections
  );
}
