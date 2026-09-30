'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FileText, Film, Headphones, Image as ImageIcon, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface PendingAttachment {
    id: string;
    file: File;
    previewUrl: string | null; // Object URL for images/videos; revoke when dropped.
}

export function toPending(files: File[]): PendingAttachment[] {
    return files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: /^(image|video)\//.test(file.type) ? URL.createObjectURL(file) : null,
    }));
}

export function releasePending(items: PendingAttachment[]) {
    items.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
}

const OPTIONS = [
    { label: 'Photos & videos', hint: 'JPG, PNG, MP4', accept: 'image/*,video/*', icon: ImageIcon, tone: 'bg-violet-500' },
    { label: 'Document', hint: 'PDF, DOCX, XLSX…', accept: '', icon: FileText, tone: 'bg-sky-500' },
    { label: 'Audio', hint: 'MP3, M4A, OGG', accept: 'audio/*', icon: Headphones, tone: 'bg-orange-500' },
] as const;

/** 📎 menu: pick what kind of file to attach, WhatsApp style. */
export function AttachMenu({ onPick }: { onPick: (files: File[]) => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);

    const choose = (accept: string) => {
        const input = inputRef.current;
        if (!input) return;
        input.accept = accept;
        input.click();
    };

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    if (files.length) onPick(files);
                }}
            />
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0" aria-label="Attach">
                        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.18 }} className="inline-flex">
                            <Paperclip className="size-4" />
                        </motion.span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" sideOffset={10} className="w-60 rounded-xl p-1.5">
                    {OPTIONS.map((o) => (
                        <DropdownMenuItem key={o.label} className="gap-3 rounded-lg px-2 py-2" onSelect={() => choose(o.accept)}>
                            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm', o.tone)}>
                                <o.icon className="size-4" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm font-medium">{o.label}</span>
                                <span className="block text-[11px] text-muted-foreground">{o.hint}</span>
                            </span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Files waiting above the composer (picked, pasted or dropped) until Send. */
export function AttachmentTray({ items, onRemove }: { items: PendingAttachment[]; onRemove: (id: string) => void }) {
    return (
        <AnimatePresence initial={false}>
            {items.length > 0 && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                >
                    <div className="flex gap-2 overflow-x-auto px-3 pt-3">
                        <AnimatePresence initial={false}>
                            {items.map((p) => {
                                const isImage = p.file.type.startsWith('image/');
                                const isVideo = p.file.type.startsWith('video/');
                                const Icon = isVideo ? Film : p.file.type.startsWith('audio/') ? Headphones : FileText;
                                return (
                                    <motion.div
                                        key={p.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                                        className="group relative shrink-0"
                                    >
                                        {isImage && p.previewUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                                            <img src={p.previewUrl} alt={p.file.name} className="size-20 rounded-xl border object-cover shadow-sm" />
                                        ) : isVideo && p.previewUrl ? (
                                            <div className="relative size-20 overflow-hidden rounded-xl border shadow-sm">
                                                <video src={p.previewUrl} muted className="size-full object-cover" />
                                                <Film className="absolute right-1.5 bottom-1.5 size-4 text-white drop-shadow" />
                                            </div>
                                        ) : (
                                            <div className="flex h-20 w-48 items-center gap-2.5 rounded-xl border bg-muted/50 px-3 shadow-sm">
                                                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                    <Icon className="size-4" />
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block truncate text-xs font-medium">{p.file.name}</span>
                                                    <span className="block text-[11px] text-muted-foreground">{formatSize(p.file.size)}</span>
                                                </span>
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => onRemove(p.id)}
                                            aria-label={`Remove ${p.file.name}`}
                                            className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow opacity-90 transition-opacity hover:opacity-100"
                                        >
                                            <X className="size-3" />
                                        </button>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
