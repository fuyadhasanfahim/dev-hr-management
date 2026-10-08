import { cn } from '@/lib/utils';
import { KB_MAX_CHARS } from '@/lib/knowledge-base';

// "412 / 1000" with a thin bar; turns amber near the limit and red over it.
export function CharCounter({ length, className }: { length: number; className?: string }) {
    const over = length > KB_MAX_CHARS;
    const near = !over && length > KB_MAX_CHARS * 0.85;
    return (
        <div className={cn('space-y-1', className)}>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                    className={cn('h-full rounded-full transition-all', over ? 'bg-destructive' : near ? 'bg-amber-500' : 'bg-primary')}
                    style={{ width: `${Math.min(100, (length / KB_MAX_CHARS) * 100)}%` }}
                />
            </div>
            <p className={cn('text-right text-xs tabular-nums', over ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                {length} / {KB_MAX_CHARS}
                {over && ` — ${length - KB_MAX_CHARS} over the limit, shorten or split it`}
            </p>
        </div>
    );
}
