import { DEFAULT_SPLIT_RATIO } from "./constants";
import type { LayoutUnit, PageAssignment } from "./types";

const sumH = (us: LayoutUnit[]) => us.reduce((s, u) => s + u.height, 0);

/**
 * Greedy pagination with grouped units and the 80% split rule.
 * Same `groupId` = one logical component; lists are pre-exploded into one unit per item.
 */
export function packGroupedUnits(
  units: LayoutUnit[],
  pageHeight: number,
  splitRatio: number = DEFAULT_SPLIT_RATIO
): PageAssignment[] {
  if (!units.length || pageHeight <= 0) return [];

  const pages: { unitIds: string[] }[] = [];
  let cur: string[] = [];
  let used = 0;

  const flush = () => {
    if (cur.length) {
      pages.push({ unitIds: [...cur] });
      cur = [];
      used = 0;
    }
  };

  let i = 0;
  while (i < units.length) {
    const gid = units[i].groupId;
    const group: LayoutUnit[] = [];
    while (i < units.length && units[i].groupId === gid) {
      group.push(units[i]);
      i++;
    }

    let offset = 0;
    while (offset < group.length) {
      const tail = group.slice(offset);
      const tailH = sumH(tail);

      if (tailH <= pageHeight + 0.5 && used + tailH <= pageHeight + 0.5) {
        for (const u of tail) {
          cur.push(u.id);
        }
        used += tailH;
        offset = group.length;
        break;
      }

      const room = pageHeight - used;
      if (room <= 0.5) {
        flush();
        continue;
      }

      // Group (or tail) taller than a single page: stream units
      if (tailH > pageHeight + 0.5) {
        const u = group[offset];
        if (used + u.height > pageHeight + 0.5 && cur.length) {
          flush();
        }
        cur.push(u.id);
        used += u.height;
        offset++;
        if (used >= pageHeight - 0.5 && offset < group.length) {
          flush();
        }
        continue;
      }

      // Tail fits on one page but not in `room`
      if (room >= splitRatio * tailH - 1e-6) {
        while (offset < group.length) {
          const u = group[offset];
          if (used + u.height <= pageHeight + 0.5) {
            cur.push(u.id);
            used += u.height;
            offset++;
          } else {
            flush();
            break;
          }
        }
        continue;
      }

      // Move entire tail to next page
      if (cur.length) flush();
      if (tailH <= pageHeight + 0.5) {
        for (const u of tail) {
          cur.push(u.id);
        }
        used = tailH;
        offset = group.length;
      } else {
        const u = group[offset];
        cur.push(u.id);
        used = u.height;
        offset++;
        if (used >= pageHeight - 0.5 && offset < group.length) {
          flush();
        }
      }
    }
  }

  flush();

  return pages.map((p, pageIndex) => ({
    pageIndex,
    unitIds: p.unitIds,
  }));
}

export function lastPageSpacerPx(
  lastAssignment: PageAssignment | undefined,
  unitById: Map<string, LayoutUnit>,
  pageHeight: number,
  minFill: number
): number {
  if (!lastAssignment) return 0;
  const used = lastAssignment.unitIds.reduce(
    (s, id) => s + (unitById.get(id)?.height ?? 0),
    0
  );
  const target = pageHeight * minFill;
  return Math.max(0, Math.round(target - used));
}
