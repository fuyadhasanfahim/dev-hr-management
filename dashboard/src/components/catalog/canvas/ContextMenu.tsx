'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { MenuItem } from './types';

/** Right-click / "⋯" menu positioned at the pointer. Closes on outside click, Escape or scroll. */
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
        const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('mousedown', close);
        window.addEventListener('keydown', esc);
        window.addEventListener('wheel', onClose, { passive: true });
        return () => {
            window.removeEventListener('mousedown', close);
            window.removeEventListener('keydown', esc);
            window.removeEventListener('wheel', onClose);
        };
    }, [onClose]);

    // Keep the menu inside the viewport.
    const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 240);
    const top = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 800) - Math.min(items.length * 34 + 16, 420));

    return (
        <div ref={ref} style={{ left, top }} className="fixed z-50 max-h-[420px] w-56 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
            {items.map((it, i) =>
                it.separator ? (
                    <div key={`s${i}`} className="my-1 h-px bg-border" />
                ) : (
                    <button
                        key={`${it.label}${i}`}
                        type="button"
                        disabled={it.disabled}
                        onClick={() => { onClose(); it.onClick?.(); }}
                        className={cn('flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50', it.danger && 'text-destructive hover:bg-destructive/10')}
                    >
                        {it.label}
                    </button>
                ),
            )}
        </div>
    );
}
