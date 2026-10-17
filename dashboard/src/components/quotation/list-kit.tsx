"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { IconClipboardText, IconCopy, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";

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

