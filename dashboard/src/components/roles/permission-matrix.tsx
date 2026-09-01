'use client';

import { useMemo, useState } from 'react';
import { Check, Minus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PermissionCatalog } from '@/redux/features/role/roleApi';

interface PermissionMatrixProps {
    catalog: PermissionCatalog;
    /** Selected permission keys (may contain `*` or `resource.*`). */
    value: string[];
    onChange: (next: string[]) => void;
    disabled?: boolean;
}

/**
 * 3-up card grid for editing a role / department / designation permission
 * list — one card per resource, a filter, and per-card "grant all / clear".
 *
 * Wildcards from built-in roles are handled: `*` locks the whole grid
 * ("superuser"), and `resource.*` shows that group as fully granted and
 * expands to concrete keys on the first edit.
 */
export function PermissionMatrix({
    catalog,
    value,
    onChange,
    disabled,
}: PermissionMatrixProps) {
    const selected = useMemo(() => new Set(value), [value]);
    const isSuperuser = selected.has('*');
    const [query, setQuery] = useState('');

    const setKey = (key: string, on: boolean) => {
        const next = new Set(selected);
        if (on) next.add(key);
        else next.delete(key);
        onChange([...next]);
    };

    const setGroup = (
        group: PermissionCatalog['groups'][number],
        on: boolean,
    ) => {
        const next = new Set(selected);
        next.delete(`${group.resource}.*`);
        for (const p of group.permissions) {
            if (on) next.add(p.key);
            else next.delete(p.key);
        }
        onChange([...next]);
    };

    const groupState = (group: PermissionCatalog['groups'][number]) => {
        if (isSuperuser || selected.has(`${group.resource}.*`))
            return 'all' as const;
        const hits = group.permissions.filter((p) => selected.has(p.key)).length;
        if (hits === 0) return 'none' as const;
        if (hits === group.permissions.length) return 'all' as const;
        return 'some' as const;
    };

    const selectedCount = value.filter((v) => v !== '*').length;

    const q = query.trim().toLowerCase();
    const groups = catalog.groups
        .map((g) => ({
            ...g,
            permissions: q
                ? g.permissions.filter(
                      (p) =>
                          p.label.toLowerCase().includes(q) ||
                          p.key.toLowerCase().includes(q) ||
                          g.label.toLowerCase().includes(q),
                  )
                : g.permissions,
        }))
        .filter((g) => g.permissions.length > 0);

    return (
        <div className="space-y-3">
            {isSuperuser && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                    This role holds the <code>*</code> wildcard — every
                    permission is granted. Remove it to edit individual
                    permissions.
                    <button
                        type="button"
                        className="ml-2 underline"
                        disabled={disabled}
                        onClick={() => onChange(value.filter((v) => v !== '*'))}
                    >
                        Remove <code>*</code>
                    </button>
                </div>
            )}

            <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Filter permissions…"
                        className="pl-8"
                    />
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                    {isSuperuser
                        ? 'All permissions'
                        : `${selectedCount} selected`}
                </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {groups.map((group) => {
                    const state = groupState(group);
                    const groupDisabled = disabled || isSuperuser;
                    const hasWildcard = selected.has(`${group.resource}.*`);
                    const granted = group.permissions.filter(
                        (p) =>
                            isSuperuser || hasWildcard || selected.has(p.key),
                    ).length;

                    return (
                        <Card
                            key={group.resource}
                            className="gap-0 overflow-hidden py-0"
                        >
                            <CardHeader className="gap-0 space-y-0 border-b bg-muted/30 px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">
                                        {group.label}
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className="font-mono text-[10px]"
                                    >
                                        {group.resource}
                                    </Badge>
                                    <span
                                        className={cn(
                                            'ml-auto text-[11px] font-medium',
                                            granted > 0
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-muted-foreground',
                                        )}
                                    >
                                        {granted}/{group.permissions.length}
                                    </span>
                                </div>
                                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <span>Set all</span>
                                    <button
                                        type="button"
                                        disabled={groupDisabled}
                                        className="rounded px-1 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-40 dark:text-emerald-400"
                                        onClick={() => setGroup(group, true)}
                                    >
                                        Grant
                                    </button>
                                    <button
                                        type="button"
                                        disabled={groupDisabled}
                                        className="rounded px-1 hover:bg-muted hover:text-foreground disabled:opacity-40"
                                        onClick={() => setGroup(group, false)}
                                    >
                                        Clear
                                    </button>
                                    {(hasWildcard || state === 'all') &&
                                        !isSuperuser && (
                                            <Badge className="ml-auto text-[9px]">
                                                {group.resource}.*
                                            </Badge>
                                        )}
                                </div>
                            </CardHeader>

                            <CardContent className="divide-y px-3 py-1">
                                {group.permissions.map((perm) => {
                                    const checked =
                                        isSuperuser ||
                                        hasWildcard ||
                                        selected.has(perm.key);
                                    return (
                                        <div
                                            key={perm.key}
                                            className="flex items-center justify-between gap-2 py-2"
                                        >
                                            <div className="min-w-0">
                                                <span className="truncate text-[13px]">
                                                    {perm.label}
                                                </span>
                                                <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                                                    {perm.action}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={groupDisabled}
                                                aria-pressed={checked}
                                                title={
                                                    checked
                                                        ? 'Granted — click to remove'
                                                        : 'Not granted — click to grant'
                                                }
                                                onClick={() => {
                                                    // expand a group wildcard to concrete keys first
                                                    if (hasWildcard) {
                                                        const next = new Set(
                                                            selected,
                                                        );
                                                        next.delete(
                                                            `${group.resource}.*`,
                                                        );
                                                        for (const p of group.permissions)
                                                            next.add(p.key);
                                                        next.delete(perm.key);
                                                        onChange([...next]);
                                                        return;
                                                    }
                                                    setKey(perm.key, !checked);
                                                }}
                                                className={cn(
                                                    'flex h-6 w-10 shrink-0 items-center justify-center rounded-md border transition-colors',
                                                    checked
                                                        ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                        : 'text-muted-foreground/60 hover:bg-muted hover:text-foreground',
                                                    groupDisabled &&
                                                        'cursor-not-allowed opacity-40 hover:bg-transparent',
                                                )}
                                            >
                                                {checked ? (
                                                    <Check className="h-3.5 w-3.5" />
                                                ) : (
                                                    <Minus className="h-3.5 w-3.5" />
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    );
                })}

                {groups.length === 0 && (
                    <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
                        No permissions match “{query}”.
                    </p>
                )}
            </div>
        </div>
    );
}
