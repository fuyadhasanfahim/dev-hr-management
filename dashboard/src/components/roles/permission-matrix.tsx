'use client';

import { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
 * Phase 5 — grouped checkbox grid for editing a role's permissions.
 *
 * Wildcards from built-in roles are handled read-only-ish: `*` locks the
 * whole matrix ("superuser"), and `resource.*` shows that group as fully
 * granted. Toggling within a wildcard group converts it to concrete keys.
 */
export function PermissionMatrix({
    catalog,
    value,
    onChange,
    disabled,
}: PermissionMatrixProps) {
    const selected = useMemo(() => new Set(value), [value]);
    const isSuperuser = selected.has('*');

    const setKey = (key: string, on: boolean) => {
        const next = new Set(selected);
        if (on) next.add(key);
        else next.delete(key);
        onChange([...next]);
    };

    const toggleGroup = (group: PermissionCatalog['groups'][number], on: boolean) => {
        const next = new Set(selected);
        next.delete(`${group.resource}.*`);
        for (const p of group.permissions) {
            if (on) next.add(p.key);
            else next.delete(p.key);
        }
        onChange([...next]);
    };

    const groupState = (group: PermissionCatalog['groups'][number]) => {
        if (isSuperuser || selected.has(`${group.resource}.*`)) return 'all' as const;
        const hits = group.permissions.filter((p) => selected.has(p.key)).length;
        if (hits === 0) return 'none' as const;
        if (hits === group.permissions.length) return 'all' as const;
        return 'some' as const;
    };

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
                        onClick={() =>
                            onChange(value.filter((v) => v !== '*'))
                        }
                    >
                        Remove <code>*</code>
                    </button>
                </div>
            )}

            <ScrollArea className="h-[420px] rounded-md border">
                <div className="divide-y">
                    {catalog.groups.map((group) => {
                        const state = groupState(group);
                        const groupDisabled = disabled || isSuperuser;
                        return (
                            <div key={group.resource} className="p-3">
                                <label className="flex items-center gap-2 font-medium">
                                    <Checkbox
                                        checked={
                                            state === 'all'
                                                ? true
                                                : state === 'some'
                                                  ? 'indeterminate'
                                                  : false
                                        }
                                        disabled={groupDisabled}
                                        onCheckedChange={(c) =>
                                            toggleGroup(group, c === true)
                                        }
                                    />
                                    <span>{group.label}</span>
                                    <Badge
                                        variant="outline"
                                        className="ml-1 font-mono text-[10px]"
                                    >
                                        {group.resource}
                                    </Badge>
                                    {selected.has(`${group.resource}.*`) && (
                                        <Badge className="text-[10px]">
                                            {group.resource}.*
                                        </Badge>
                                    )}
                                </label>

                                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 pl-6 sm:grid-cols-3">
                                    {group.permissions.map((perm) => {
                                        const checked =
                                            isSuperuser ||
                                            selected.has(`${group.resource}.*`) ||
                                            selected.has(perm.key);
                                        return (
                                            <label
                                                key={perm.key}
                                                className={cn(
                                                    'flex items-center gap-2 text-sm',
                                                    groupDisabled &&
                                                        'text-muted-foreground',
                                                )}
                                            >
                                                <Checkbox
                                                    checked={checked}
                                                    disabled={groupDisabled}
                                                    onCheckedChange={(c) => {
                                                        // expand a group wildcard to concrete keys first
                                                        if (
                                                            selected.has(
                                                                `${group.resource}.*`,
                                                            )
                                                        ) {
                                                            const next = new Set(
                                                                selected,
                                                            );
                                                            next.delete(
                                                                `${group.resource}.*`,
                                                            );
                                                            for (const p of group.permissions)
                                                                next.add(p.key);
                                                            if (c !== true)
                                                                next.delete(
                                                                    perm.key,
                                                                );
                                                            onChange([...next]);
                                                            return;
                                                        }
                                                        setKey(
                                                            perm.key,
                                                            c === true,
                                                        );
                                                    }}
                                                />
                                                <span>{perm.label}</span>
                                                <span className="font-mono text-[10px] text-muted-foreground">
                                                    {perm.action}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>

            <p className="text-xs text-muted-foreground">
                {isSuperuser
                    ? 'All permissions'
                    : `${value.filter((v) => v !== '*').length} permission${
                          value.length === 1 ? '' : 's'
                      } selected`}
            </p>
        </div>
    );
}
