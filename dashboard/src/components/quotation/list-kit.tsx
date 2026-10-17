"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { IconClipboardText, IconCopy, IconGripVertical, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Shared building blocks for editable lists: tooltip icon buttons, inline "Add" with Cancel / Add,
 * title-only rows (edit / delete) and the bulk-paste dialog. Used by the quotation wizard and the catalog.
 */

/** shadcn tooltip around any icon-only control. */
export function Tip({ label, children }: { label: string; children: React.ReactElement }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

export function IconBtn({ label, onClick, disabled, className, children }: { label: string; onClick: () => void; disabled?: boolean; className?: string; children: React.ReactNode }) {
    return (
        <Tip label={label}>
            <button
                type="button"
                aria-label={label}
                disabled={disabled}
                onClick={onClick}
                className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30", className)}
            >
                {children}
            </button>
        </Tip>
    );
}


/** Collapsed "Add …" button that opens an inline input with Cancel / Add. */
export function AddInline({ label, placeholder, onAdd, secondPlaceholder }: { label: string; placeholder: string; onAdd: (text: string, second: string) => void; secondPlaceholder?: string }) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");
    const [second, setSecond] = useState("");
    const close = () => {
        setOpen(false);
        setText("");
        setSecond("");
    };
    const submit = () => {
        const t = text.trim();
        if (!t) return;
        onAdd(t, second.trim());
        close();
    };
    if (!open) {
        return (
            <Button type="button" variant="outline" size="sm" className="w-full border-dashed bg-primary/5 text-primary" onClick={() => setOpen(true)}>
                <IconPlus className="size-4" /> {label}
            </Button>
        );
    }
    const onKey = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            submit();
        }
        if (e.key === "Escape") close();
    };
    return (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
            <div className="flex gap-2">
                <Input autoFocus className="h-9 min-w-0 flex-1 bg-background" value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} />
                {secondPlaceholder && <Input className="h-9 w-24 shrink-0 bg-background text-center" value={second} placeholder={secondPlaceholder} onChange={(e) => setSecond(e.target.value)} onKeyDown={onKey} />}
            </div>
            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={close}>Cancel</Button>
                <Button type="button" size="sm" disabled={!text.trim()} onClick={submit}>Add</Button>
            </div>
        </div>
    );
}


export const norm = (t: string) => t.trim().toLowerCase();
/** Keeps only the incoming strings that are not already in `existing` (case-insensitive) and not repeated. */
export const freshOnly = (existing: string[], incoming: string[]) => {
    const have = new Set(existing.map(norm));
    return incoming.filter((t) => {
        const k = norm(t);
        if (!k || have.has(k)) return false;
        have.add(k);
        return true;
    });
};

/** JSON array of strings / {name|title|text} objects, or plain text with one item per line. */
export function parseLines(text: string): string[] {
    const raw = text.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
    if (!raw) return [];
    if (raw.startsWith("[") || raw.startsWith("{")) {
        try {
            const parsed = JSON.parse(raw);
            const arr: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [parsed];
            const out = arr
                .map((x) => {
                    if (typeof x === "string") return x;
                    const o = (x ?? {}) as Record<string, unknown>;
                    return [o.name, o.title, o.text, o.label].find((v) => typeof v === "string") ?? "";
                })
                .map((x) => String(x).trim())
                .filter(Boolean);
            if (out.length) return out;
        } catch {
            /* fall through to one-item-per-line */
        }
    }
    return raw
        .split("\n")
        .map((l) => l.trim().replace(/^([-*•◦▪+]|\d+[.)])\s*/, "").trim())
        .filter(Boolean);
}

export type Milestone2 = { title: string; duration: string };

/** JSON [{title, duration}] / strings, or lines like "Design - 1 week". */
export function parseMilestones(text: string): Milestone2[] {
    const raw = text.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
    if (!raw) return [];
    if (raw.startsWith("[") || raw.startsWith("{")) {
        try {
            const parsed = JSON.parse(raw);
            const arr: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
            const out = arr
                .map((x): Milestone2 => {
                    if (typeof x === "string") return { title: x.trim(), duration: "" };
                    const o = (x ?? {}) as Record<string, unknown>;
                    const t = [o.title, o.name, o.label].find((v) => typeof v === "string");
                    return { title: String(t ?? "").trim(), duration: typeof o.duration === "string" ? o.duration.trim() : "" };
                })
                .filter((m) => m.title);
            if (out.length) return out;
        } catch {
            /* fall through to lines */
        }
    }
    return parseLines(raw).map((l) => {
        const m = l.match(/^(.*?)\s*(?:[-–—|:]\s*)(\d+(?:\.\d+)?\s*(?:day|week|month)s?)$/i);
        return m ? { title: m[1].trim(), duration: m[2].trim() } : { title: l, duration: "" };
    });
}

export type AddonDraft = { name: string; price: number };

/** JSON [{name, price}] / strings, or lines like "SEO setup - 5000". */
export function parseAddons(text: string): AddonDraft[] {
    const raw = text.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
    if (!raw) return [];
    const num = (v: unknown) => Number(String(v ?? "").replace(/[^0-9.]/g, "")) || 0;
    if (raw.startsWith("[") || raw.startsWith("{")) {
        try {
            const parsed = JSON.parse(raw);
            const arr: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
            const out = arr
                .map((x): AddonDraft => {
                    if (typeof x === "string") return { name: x.trim(), price: 0 };
                    const o = (x ?? {}) as Record<string, unknown>;
                    const n = [o.name, o.title, o.label].find((v) => typeof v === "string");
                    return { name: String(n ?? "").trim(), price: num(o.price) };
                })
                .filter((a) => a.name);
            if (out.length) return out;
        } catch {
            /* fall through to lines */
        }
    }
    return parseLines(raw).map((l) => {
        const m = l.match(/^(.*?)\s*(?:[-–—|:]\s*)[৳$]?\s*([\d,]+(?:\.\d+)?)$/);
        return m ? { name: m[1].trim(), price: num(m[2]) } : { name: l, price: 0 };
    });
}

export const addonPrompt = `You are helping me fill the "optional add-ons" list of a client quotation.
Return ONLY a valid JSON array - no explanation and no markdown fence - in exactly this shape:

[
  { "name": "SEO setup", "price": 5000 },
  { "name": "Extra landing page", "price": 3000 }
]

Rules:
1. "name" is a short add-on name; "price" is a plain number with no currency symbol (use 0 if unknown).
2. No other keys, no duplicates.

The service to suggest add-ons for:
<describe the service here>`;

export const listPrompt = (noun: string) => `You are helping me fill the "${noun}" list of a client quotation.
Return ONLY a valid JSON array of short strings - no explanation and no markdown fence - for example:

["First item", "Second item", "Third item"]

Rules:
1. One short, clear phrase or sentence per item (under 100 characters).
2. No numbering, no bullets, no nested items, no duplicates.

The context to base the list on:
<describe the service / project here>`;

export const milestonePrompt = `You are helping me fill the "project milestones" list of a client quotation.
Return ONLY a valid JSON array - no explanation and no markdown fence - in exactly this shape:

[
  { "title": "Discovery & wireframes", "duration": "1 week" },
  { "title": "Design", "duration": "2 weeks" }
]

Rules:
1. "title" is a short milestone name; "duration" is a short span such as "3 days", "1 week" or "1 month".
2. Keep the milestones in the order the work happens. No other keys, no duplicates.

The project to plan:
<describe the project here>`;

export function BulkDialog<T>({
    open,
    onOpenChange,
    title,
    description,
    prompt,
    placeholder,
    parse,
    onImport,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    title: string;
    description: string;
    prompt: string;
    placeholder: string;
    parse: (text: string) => T[];
    onImport: (items: T[]) => void;
}) {
    const [text, setText] = useState("");
    const parsed = useMemo(() => parse(text), [text, parse]);
    const close = (v: boolean) => {
        onOpenChange(v);
        if (!v) setText("");
    };
    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(prompt).then(() => toast.success("AI prompt copied - paste it into ChatGPT / Claude, then paste the JSON it returns here"), () => toast.error("Could not copy the prompt"))}
                    >
                        <IconCopy className="size-4" /> Copy prompt
                    </Button>
                    <Textarea rows={12} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
                    <p className="text-xs text-muted-foreground">{text.trim() ? (parsed.length ? `${parsed.length} item${parsed.length === 1 ? "" : "s"} found` : "Nothing readable found - check the pasted text") : "Nothing pasted yet"}</p>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
                    <Button
                        type="button"
                        disabled={!parsed.length}
                        onClick={() => {
                            onImport(parsed);
                            close(false);
                        }}
                    >
                        Import {parsed.length || ""}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Icon button + dialog: paste many items at once into a simple list. */
export function BulkButton<T>({ noun, prompt, placeholder, parse, onImport }: { noun: string; prompt: string; placeholder: string; parse: (text: string) => T[]; onImport: (items: T[]) => void }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <IconBtn label={`Bulk paste ${noun}`} className="size-9 border" onClick={() => setOpen(true)}>
                <IconClipboardText className="size-[18px]" />
            </IconBtn>
            <BulkDialog
                open={open}
                onOpenChange={setOpen}
                title={`Bulk paste ${noun}`}
                description={`Paste JSON (or one item per line). Items already in the list are skipped.`}
                prompt={prompt}
                placeholder={placeholder}
                parse={parse}
                onImport={(items) => {
                    onImport(items);
                    toast.success(`${items.length} item${items.length === 1 ? "" : "s"} added`);
                }}
            />
        </>
    );
}

export function EditableText({ value, editing, onChange, onDone, off, className }: { value: string; editing: boolean; onChange: (v: string) => void; onDone: () => void; off?: boolean; className?: string }) {
    return editing ? (
        <Input autoFocus className="h-8 min-w-0 flex-1" value={value} onChange={(e) => onChange(e.target.value)} onBlur={onDone} onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && onDone()} />
    ) : (
        <span className={cn("min-w-0 flex-1 break-words text-sm", off && "text-muted-foreground line-through", className)}>{value}</span>
    );
}

export function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
    return (
        <div className="flex shrink-0 items-center">
            <IconBtn label="Edit" onClick={onEdit} className="hover:text-primary"><IconPencil className="size-4" /></IconBtn>
            <IconBtn label="Delete" onClick={onDelete} className="text-destructive/80 hover:text-destructive"><IconTrash className="size-4" /></IconBtn>
        </div>
    );
}


export const FEATURE_PROMPT = `You are helping me fill the "Included Features" list of a client quotation.
Break the service I describe at the bottom into main features, sub-features and sub-sub-features (maximum 3 levels).
Return ONLY valid JSON - no explanation and no markdown fence - in exactly this shape:

[
  {
    "name": "Store Design and Setup",
    "children": [
      { "name": "Homepage design", "children": [ { "name": "Hero banner" } ] },
      { "name": "Product page" }
    ]
  }
]

Rules:
1. "name" is a short, human-readable feature name (string, required).
2. "children" is optional - add it only when the feature has sub-features. Maximum depth is 3 levels.
3. Do NOT include prices, routes, descriptions or any other keys.
4. Keep every name under 80 characters and do not repeat the same feature twice.

The service to break down:
<describe the service here>`;

export const depthOf = (it: { depth?: number }) => it.depth ?? 0;
/** End (exclusive) of the block made of item `i` and all of its descendants. */
export const blockEnd = (items: { depth?: number }[], i: number) => {
    let j = i + 1;
    while (j < items.length && depthOf(items[j]) > depthOf(items[i])) j++;
    return j;
};

/** Pasted JSON ({name, children}) or indented plain text → flat list with depth. */
export function parseFeatureTree(text: string): OutlineItem[] {
    const raw = text.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
    if (!raw) return [];
    const out: OutlineItem[] = [];
    const walk = (node: unknown, depth: number) => {
        if (typeof node === "string") {
            if (node.trim()) out.push({ text: node.trim(), on: true, depth: Math.min(depth, 2) });
            return;
        }
        if (!node || typeof node !== "object") return;
        const o = node as Record<string, unknown>;
        const name = [o.name, o.title, o.label, o.feature].find((v) => typeof v === "string" && v.trim()) as string | undefined;
        if (name) out.push({ text: name.trim(), on: true, depth: Math.min(depth, 2) });
        const kids = [o.children, o.subFeatures, o.sub, o.items].find(Array.isArray) as unknown[] | undefined;
        kids?.forEach((k) => walk(k, name ? depth + 1 : depth));
    };
    if (raw.startsWith("[") || raw.startsWith("{")) {
        try {
            const parsed = JSON.parse(raw);
            (Array.isArray(parsed) ? parsed : [parsed]).forEach((n) => walk(n, 0));
            if (out.length) return out;
        } catch {
            /* fall through to the indented-text parser */
        }
    }
    const stack: number[] = [];
    raw.split("\n").forEach((line) => {
        if (!line.trim()) return;
        const width = (line.match(/^\s*/)?.[0] ?? "").replace(/\t/g, "    ").length;
        while (stack.length && stack[stack.length - 1] >= width) stack.pop();
        const depth = Math.min(stack.length, 2);
        stack.push(width);
        const t = line.trim().replace(/^[-*•◦▪+]\s*/, "").trim();
        if (t) out.push({ text: t, on: true, depth });
    });
    return out;
}


export type OutlineItem = { text: string; on: boolean; depth?: number };

type Deep = { depth?: number };

/** First item is always main level; no item sits more than one level below the one before it; max 3 levels. */
export function fixDepths<T extends Deep>(items: T[]): T[] {
    let prev = -1;
    return items.map((x) => {
        const d = Math.max(0, Math.min(depthOf(x), prev + 1, 2));
        prev = d;
        return d === depthOf(x) ? x : { ...x, depth: d };
    });
}

/** Index of the previous item on the same level inside the same parent, or -1. */
export function siblingBefore<T extends Deep>(items: T[], i: number): number {
    const d = depthOf(items[i]!);
    for (let k = i - 1; k >= 0; k--) {
        if (depthOf(items[k]!) < d) return -1;
        if (depthOf(items[k]!) === d) return k;
    }
    return -1;
}

export function hasSiblingAfter<T extends Deep>(items: T[], i: number): boolean {
    const j = blockEnd(items, i);
    return j < items.length && depthOf(items[j]!) === depthOf(items[i]!);
}

/** Swaps an item (with its sub-items) with the neighbouring item of the same level. */
export function moveBlock<T extends Deep>(items: T[], i: number, dir: -1 | 1): T[] {
    const j = blockEnd(items, i);
    if (dir === -1) {
        const p = siblingBefore(items, i);
        return p < 0 ? items : [...items.slice(0, p), ...items.slice(i, j), ...items.slice(p, i), ...items.slice(j)];
    }
    if (!hasSiblingAfter(items, i)) return items;
    const k = blockEnd(items, j);
    return [...items.slice(0, i), ...items.slice(j, k), ...items.slice(i, j), ...items.slice(k)];
}

export function shiftBlock<T extends Deep>(items: T[], i: number, by: 1 | -1): T[] {
    const j = blockEnd(items, i);
    return items.map((x, k) => (k >= i && k < j ? { ...x, depth: depthOf(x) + by } : x));
}

export function canIndent<T extends Deep>(items: T[], i: number): boolean {
    if (i === 0) return false;
    const j = blockEnd(items, i);
    return depthOf(items[i - 1]!) >= depthOf(items[i]!) && Math.max(...items.slice(i, j).map(depthOf)) < 2;
}

/** Removes one item; its sub-items move up a level instead of disappearing. */
export function removeKeepChildren<T extends Deep>(items: T[], i: number): T[] {
    const j = blockEnd(items, i);
    return [...items.slice(0, i), ...items.slice(i + 1, j).map((x) => ({ ...x, depth: Math.max(0, depthOf(x) - 1) })), ...items.slice(j)];
}


/** Moves one item to insertion index `to` (0..length, in the original list). */
export function moveTo<T>(items: T[], from: number, to: number): T[] {
    if (to === from || to === from + 1) return items;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to > from ? to - 1 : to, 0, it!);
    return next;
}

/** Moves an outline item together with its sub-items to insertion index `to`; levels are re-fixed by the caller. */
export function moveBlockTo<T extends { depth?: number }>(items: T[], from: number, to: number): T[] {
    const end = blockEnd(items, from);
    if (to >= from && to <= end) return items;
    const block = items.slice(from, end);
    const rest = [...items.slice(0, from), ...items.slice(end)];
    const at = to > end ? to - block.length : to;
    return [...rest.slice(0, at), ...block, ...rest.slice(at)];
}

/**
 * Native drag-and-drop reordering. Spread `handle(i)` on the grip (only the grip starts a drag, so text fields
 * stay selectable) and `row(i)` on the row; `rowClass(i)` draws the drop line. `onMove(from, to)` gets an insertion index.
 */
export function useDragReorder(onMove: (from: number, to: number) => void) {
    const [drag, setDrag] = useState<number | null>(null);
    const [over, setOver] = useState<{ i: number; after: boolean } | null>(null);
    const reset = () => {
        setDrag(null);
        setOver(null);
    };
    return {
        handle: (i: number) => ({
            draggable: true,
            onDragStart: (e: React.DragEvent) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
                const row = (e.currentTarget as HTMLElement).closest("[data-drag-row]");
                if (row) e.dataTransfer.setDragImage(row, 16, 16);
                setDrag(i);
            },
            onDragEnd: reset,
        }),
        row: (i: number) => ({
            "data-drag-row": true,
            onDragOver: (e: React.DragEvent) => {
                if (drag === null) return;
                e.preventDefault();
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const after = e.clientY > r.top + r.height / 2;
                setOver((o) => (o && o.i === i && o.after === after ? o : { i, after }));
            },
            onDrop: (e: React.DragEvent) => {
                if (drag === null || !over) return;
                e.preventDefault();
                const from = drag;
                const to = over.i + (over.after ? 1 : 0);
                reset();
                onMove(from, to);
            },
        }),
        rowClass: (i: number) =>
            cn(
                "relative",
                drag === i && "opacity-40",
                drag !== null && over?.i === i && "before:pointer-events-none before:absolute before:inset-x-0 before:z-10 before:h-0.5 before:rounded before:bg-primary",
                drag !== null && over?.i === i && (over.after ? "before:bottom-0" : "before:top-0"),
            ),
    };
}

/** The grip a row is dragged by. */
export function DragGrip(props: React.HTMLAttributes<HTMLSpanElement>) {
    return (
        <Tip label="Drag to reorder">
            <span {...props} className="flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/70 hover:bg-muted hover:text-foreground active:cursor-grabbing">
                <IconGripVertical className="size-4" />
            </span>
        </Tip>
    );
}
