/** One measurable row/block inside a logical group (e.g. list item). */
export interface LayoutUnit {
  id: string;
  groupId: string;
  height: number;
}

export interface PageAssignment {
  pageIndex: number;
  unitIds: string[];
}
