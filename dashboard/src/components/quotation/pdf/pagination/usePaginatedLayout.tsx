"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { contentHeightPx, contentWidthPx } from "./constants";
import { packGroupedUnits } from "./packGroupedUnits";
import type { LayoutUnit, PageAssignment } from "./types";

/**
 * Reads heights from `data-layout-unit` elements inside the measure root.
 * Each node should have `data-unit-id` and `data-group-id`.
 */
export function usePaginatedLayout(measureKey: string) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [units, setUnits] = useState<LayoutUnit[] | null>(null);
  const [assignments, setAssignments] = useState<PageAssignment[] | null>(null);

  const pageHeight = useMemo(() => contentHeightPx(), []);
  const pageWidth = useMemo(() => contentWidthPx(), []);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const nodes = root.querySelectorAll<HTMLElement>("[data-layout-unit]");
    const next: LayoutUnit[] = [];
    nodes.forEach((el) => {
      const id = el.dataset.unitId;
      const groupId = el.dataset.groupId;
      if (!id || !groupId) return;
      const r = el.getBoundingClientRect();
      const h = r.height || el.offsetHeight;
      if (h <= 0) return;
      next.push({ id, groupId, height: h });
    });

    setUnits(next);
    if (next.length) {
      setAssignments(packGroupedUnits(next, pageHeight));
    } else {
      setAssignments([]);
    }
  }, [pageHeight]);

  useLayoutEffect(() => {
    measure();
  }, [measureKey, measure]);

  const unitById = useMemo(() => {
    const m = new Map<string, LayoutUnit>();
    (units ?? []).forEach((u) => m.set(u.id, u));
    return m;
  }, [units]);

  return {
    rootRef,
    units,
    assignments,
    unitById,
    pageHeight,
    pageWidth,
    remeasure: measure,
  };
}

export function MeasureShell({
  pageWidth,
  children,
  rootRef,
  className = "",
}: {
  pageWidth: number;
  children: ReactNode;
  rootRef: RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        position: "absolute",
        left: -9999,
        top: 0,
        width: pageWidth,
        visibility: "hidden",
        pointerEvents: "none",
      }}
      aria-hidden
    >
      {children}
    </div>
  );
}
