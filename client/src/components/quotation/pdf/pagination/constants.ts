/** CSS px at 96dpi from mm (matches browser print / Chromium PDF). */
export const MM_TO_PX = 96 / 25.4;

export const A4_MM = { width: 210, height: 297 } as const;

/** Margins aligned with Puppeteer quotation PDF (approx). */
export const PRINT_MARGIN_MM = {
  top: 12,
  right: 10,
  bottom: 14,
  left: 10,
} as const;

export function contentWidthPx(): number {
  const inner =
    A4_MM.width - PRINT_MARGIN_MM.left - PRINT_MARGIN_MM.right;
  return Math.round(inner * MM_TO_PX);
}

export function contentHeightPx(): number {
  const inner =
    A4_MM.height - PRINT_MARGIN_MM.top - PRINT_MARGIN_MM.bottom;
  return Math.round(inner * MM_TO_PX);
}

/** Target minimum fill for last page (0.75–0.85). */
export const LAST_PAGE_MIN_FILL = 0.78;

/** Split when remaining room ≥ this × chunk height (smart-fit). */
export const DEFAULT_SPLIT_RATIO = 0.8;
