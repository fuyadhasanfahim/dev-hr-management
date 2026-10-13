'use client';

import { useRef, useState } from 'react';
import { IconGripVertical, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { unitLabel } from './section-meta';

export interface ListItem {
    key: string;
    title: string;
    description?: string;
    duration?: { value: number; unit: 'day' | 'week' | 'month' } | null;
    badge?: string;
}

export interface DragPayload {
    listId: string;
    key: string;
    [extra: string]: unknown;
}

interface Props {
    listId: string;
    /** Items may only be dropped from lists using the same MIME type (sections ↔ sections, features ↔ features). */
    mime: string;
    items: ListItem[];
    readOnly?: boolean;
    withDuration?: boolean;
    /** Inline add/edit (sections). Feature lists edit through a dialog instead. */
    inlineEdit?: boolean;
    placeholder: string;
    payloadExtra?: Record<string, unknown>;
    onChange?: (items: ListItem[], label: string) => void;
    onDropExternal?: (payload: DragPayload, index: number) => void;
    /** Non-inline lists: reorder / remove / edit are reported by key. */
    onReorder?: (keys: string[]) => void;
    onRemove?: (key: string) => void;
    onEditItem?: (key: string) => void;
    onAddClick?: () => void;
    onItemMenu?: (e: React.MouseEvent, item: ListItem, index: number) => void;
    emptyText?: string;
}

const UNITS = ['day', 'week', 'month'] as const;
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k${Date.now()}${Math.random()}`);

/**
 * Editable, drag-sortable list used inside canvas nodes. Uses native HTML5 drag-and-drop
 * on purpose: it keeps working under React Flow's zoom/pan transform and lets items be
 * dragged from one node's list into another's.
 */
export function ItemList({
    listId, mime, items, readOnly, withDuration, inlineEdit = true, placeholder, payloadExtra,
    onChange, onDropExternal, onReorder, onRemove, onEditItem, onAddClick, onItemMenu, emptyText = 'Nothing here yet',
}: Props) {
    const box = useRef<HTMLDivElement>(null);
    const [dropAt, setDropAt] = useState<number | null>(null);
    const [editing, setEditing] = useState<string | null>(null);
    const [draft, setDraft] = useState<ListItem | null>(null);
    const [add, setAdd] = useState<{ title: string; value: string; unit: 'day' | 'week' | 'month' }>({ title: '', value: '', unit: 'week' });

    const indexFromPointer = (clientY: number) => {
        const els = box.current?.querySelectorAll<HTMLElement>('[data-item]') ?? [];
        for (let i = 0; i < els.length; i++) {
            const r = els[i]!.getBoundingClientRect();
            if (clientY < r.top + r.height / 2) return i;
        }
        return els.length;
    };

    const accepts = (e: React.DragEvent) => !readOnly && e.dataTransfer.types.includes(mime);

    const onDrop = (e: React.DragEvent) => {
        if (!accepts(e)) return;
        e.preventDefault();
        e.stopPropagation();
        const at = dropAt ?? items.length;
        setDropAt(null);
        let payload: DragPayload;
        try { payload = JSON.parse(e.dataTransfer.getData(mime)); } catch { return; }
        if (payload.listId !== listId) return onDropExternal?.(payload, at);

        // Same list → reorder.
        const from = items.findIndex((i) => i.key === payload.key);
        if (from < 0) return;
        const next = items.slice();
        const [moved] = next.splice(from, 1);
        next.splice(at > from ? at - 1 : at, 0, moved!);
        if (next.every((n, i) => n.key === items[i]!.key)) return;
        if (onReorder) onReorder(next.map((n) => n.key));
        else onChange?.(next, 'Reorder');
    };

    const commitAdd = () => {
        const title = add.title.trim();
        if (!title) return;
        const duration = withDuration && add.value !== '' ? { value: Number(add.value), unit: add.unit } : null;
        onChange?.([...items, { key: newKey(), title, duration }], `Add "${title}"`);
        setAdd({ title: '', value: '', unit: add.unit });
    };

    const commitEdit = () => {
        if (!draft) return;
        const title = draft.title.trim();
        if (title) onChange?.(items.map((i) => (i.key === draft.key ? { ...draft, title } : i)), `Edit "${title}"`);
        setEditing(null);
        setDraft(null);
    };

    const field = 'h-7 rounded border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary';

    return (
        <div
            ref={box}
            className="nodrag nowheel nopan space-y-1"
            onDragOver={(e) => { if (accepts(e)) { e.preventDefault(); setDropAt(indexFromPointer(e.clientY)); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropAt(null); }}
            onDrop={onDrop}
        >
            <div className="max-h-64 space-y-1 overflow-y-auto pr-0.5">
                {items.length === 0 && <p className="px-1 py-2 text-center text-[11px] text-muted-foreground">{emptyText}</p>}
                {items.map((it, i) => (
                    <div key={it.key}>
                        {dropAt === i && <div className="-mb-0.5 h-0.5 rounded bg-primary" />}
                        {editing === it.key && draft ? (
                            <div className="space-y-1 rounded-md border bg-muted/40 p-1.5">
                                <input autoFocus className={cn(field, 'w-full')} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                                    onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditing(null); setDraft(null); } }} />
                                {withDuration && (
                                    <div className="flex gap-1">
                                        <input type="number" min={0} className={cn(field, 'w-16')} value={draft.duration?.value ?? ''} placeholder="3"
                                            onChange={(e) => setDraft({ ...draft, duration: e.target.value === '' ? null : { value: Number(e.target.value), unit: draft.duration?.unit ?? 'week' } })} />
                                        <select className={cn(field, 'flex-1')} value={draft.duration?.unit ?? 'week'}
                                            onChange={(e) => setDraft({ ...draft, duration: { value: draft.duration?.value ?? 1, unit: e.target.value as 'day' } })}>
                                            {UNITS.map((u) => <option key={u} value={u}>{u}s</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="flex justify-end gap-1">
                                    <button type="button" className="rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted" onClick={() => { setEditing(null); setDraft(null); }}>Cancel</button>
                                    <button type="button" className="rounded bg-primary px-2 py-0.5 text-[11px] text-primary-foreground" onClick={commitEdit}>Save</button>
                                </div>
                            </div>
                        ) : (
                            <div
                                data-item
                                draggable={!readOnly}
                                onDragStart={(e) => {
                                    e.stopPropagation();
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData(mime, JSON.stringify({ listId, key: it.key, ...payloadExtra }));
                                }}
                                onDragEnd={() => setDropAt(null)}
                                onContextMenu={(e) => onItemMenu?.(e, it, i)}
                                onDoubleClick={() => !readOnly && (inlineEdit ? (setEditing(it.key), setDraft(it)) : onEditItem?.(it.key))}
                                className="group flex items-start gap-1.5 rounded-md border border-transparent bg-muted/30 px-1.5 py-1 text-xs hover:border-border hover:bg-muted/60"
                            >
                                {!readOnly && <IconGripVertical className="mt-0.5 size-3.5 shrink-0 cursor-grab text-muted-foreground/60" />}
                                <div className="min-w-0 flex-1">
                                    <p className="break-words leading-snug">{it.title}</p>
                                    {it.description && <p className="text-[11px] text-muted-foreground">{it.description}</p>}
                                </div>
                                {it.badge && <span className="shrink-0 rounded bg-background px-1 text-[10px] text-muted-foreground">{it.badge}</span>}
                                {it.duration && <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{unitLabel(it.duration)}</span>}
                                {!readOnly && (
                                    <span className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
                                        <button type="button" aria-label="Edit" className="text-muted-foreground hover:text-primary"
                                            onClick={() => (inlineEdit ? (setEditing(it.key), setDraft(it)) : onEditItem?.(it.key))}><IconPencil className="size-3.5" /></button>
                                        <button type="button" aria-label="Remove" className="text-muted-foreground hover:text-destructive"
                                            onClick={() => (inlineEdit ? onChange?.(items.filter((x) => x.key !== it.key), `Delete "${it.title}"`) : onRemove?.(it.key))}><IconTrash className="size-3.5" /></button>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                {dropAt === items.length && items.length > 0 && <div className="h-0.5 rounded bg-primary" />}
            </div>

            {!readOnly && inlineEdit && (
                <div className="flex gap-1 pt-1">
                    <input className={cn(field, 'min-w-0 flex-1')} placeholder={placeholder} value={add.title}
                        onChange={(e) => setAdd({ ...add, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && commitAdd()} />
                    {withDuration && (
                        <>
                            <input type="number" min={0} className={cn(field, 'w-12')} placeholder="3" value={add.value} onChange={(e) => setAdd({ ...add, value: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && commitAdd()} />
                            <select className={cn(field, 'w-[4.5rem]')} value={add.unit} onChange={(e) => setAdd({ ...add, unit: e.target.value as 'day' })}>
                                {UNITS.map((u) => <option key={u} value={u}>{u}s</option>)}
                            </select>
                        </>
                    )}
                    <button type="button" aria-label="Add" className="flex size-7 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground" onClick={commitAdd}><IconPlus className="size-3.5" /></button>
                </div>
            )}
            {!readOnly && !inlineEdit && onAddClick && (
                <button type="button" className="flex w-full items-center justify-center gap-1 rounded border border-dashed py-1 text-[11px] text-primary hover:bg-primary/5" onClick={onAddClick}>
                    <IconPlus className="size-3.5" /> {placeholder}
                </button>
            )}
        </div>
    );
}
