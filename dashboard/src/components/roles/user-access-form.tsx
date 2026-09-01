'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader, Search, RotateCcw, Check, Minus, X, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FormActionDock } from './form-action-dock';
import { usePermissions } from '@/hooks/use-permissions';
import {
    useGetPermissionCatalogQuery,
    useGetUserAccessQuery,
    useAssignUserAccessMutation,
    useGetRolesQuery,
} from '@/redux/features/role/roleApi';

type Mode = 'inherit' | 'allow' | 'deny';

interface UserAccessFormProps {
    userId: string;
    /** Where to go after a successful save on the dedicated page. */
    callbackUrl?: string;
    /** Embedded in the staff-detail tab: no navigation on save. */
    embedded?: boolean;
}

/** Expand `*` / `resource.*` against the catalog into concrete keys. */
function expand(list: string[], all: string[]): string[] {
    const out = new Set<string>();
    for (const p of list) {
        if (p === '*') all.forEach((k) => out.add(k));
        else if (p.endsWith('.*')) {
            const prefix = `${p.slice(0, -2)}.`;
            all.filter((k) => k.startsWith(prefix)).forEach((k) => out.add(k));
        } else out.add(p);
    }
    return [...out];
}

function TriToggle({
    value,
    canAllow,
    onChange,
}: {
    value: Mode;
    canAllow: boolean;
    onChange: (m: Mode) => void;
}) {
    const seg = (
        mode: Mode,
        Icon: typeof Check,
        title: string,
        activeCls: string,
        disabled = false,
    ) => (
        <button
            type="button"
            title={title}
            disabled={disabled}
            onClick={() => onChange(mode)}
            className={cn(
                'flex h-6 w-7 items-center justify-center transition-colors',
                value === mode
                    ? activeCls
                    : 'text-muted-foreground/60 hover:bg-muted hover:text-foreground',
                disabled && 'cursor-not-allowed opacity-30 hover:bg-transparent',
            )}
        >
            <Icon className="h-3.5 w-3.5" />
        </button>
    );

    return (
        <div className="inline-flex shrink-0 divide-x overflow-hidden rounded-md border bg-background">
            {seg('inherit', Minus, 'Inherit from role', 'bg-muted text-foreground')}
            {seg(
                'allow',
                Check,
                canAllow ? 'Allow for this user' : "You don't hold this permission",
                'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                !canAllow,
            )}
            {seg('deny', X, 'Deny for this user', 'bg-destructive/15 text-destructive')}
        </div>
    );
}

export function UserAccessForm({
    userId,
    callbackUrl,
    embedded = false,
}: UserAccessFormProps) {
    const router = useRouter();
    const { can, isSuperuser } = usePermissions();

    const { data: catalog, isLoading: catalogLoading } =
        useGetPermissionCatalogQuery();
    const { data: roles } = useGetRolesQuery();
    const {
        data: access,
        isLoading: accessLoading,
        isError,
    } = useGetUserAccessQuery(userId, { skip: !userId });
    const [assignUserAccess] = useAssignUserAccessMutation();

    const [extra, setExtra] = useState<Set<string>>(new Set());
    const [denied, setDenied] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (access && catalog) {
            setExtra(new Set(expand(access.extraPermissions ?? [], catalog.all)));
            setDenied(
                new Set(expand(access.deniedPermissions ?? [], catalog.all)),
            );
        }
    }, [access, catalog]);

    const roleGrants = useMemo(() => {
        if (!roles || !access?.role || !catalog) return new Set<string>();
        const role = roles.find((r) => r.slug === access.role);
        return new Set(role ? expand(role.permissions, catalog.all) : []);
    }, [roles, access?.role, catalog]);

    const loading = catalogLoading || accessLoading;

    const modeOf = (key: string): Mode =>
        denied.has(key) ? 'deny' : extra.has(key) ? 'allow' : 'inherit';

    const setMode = (key: string, mode: Mode) => {
        setExtra((prev) => {
            const n = new Set(prev);
            if (mode === 'allow') n.add(key);
            else n.delete(key);
            return n;
        });
        setDenied((prev) => {
            const n = new Set(prev);
            if (mode === 'deny') n.add(key);
            else n.delete(key);
            return n;
        });
    };

    const setGroupMode = (keys: string[], mode: Mode) =>
        keys.forEach((k) => {
            if (mode === 'allow' && !(isSuperuser || can(k))) return;
            setMode(k, mode);
        });

    const reset = () => {
        if (!access || !catalog) return;
        setExtra(new Set(expand(access.extraPermissions ?? [], catalog.all)));
        setDenied(new Set(expand(access.deniedPermissions ?? [], catalog.all)));
    };

    const dirty = useMemo(() => {
        if (!access || !catalog) return false;
        const a = [...expand(access.extraPermissions ?? [], catalog.all)].sort();
        const d = [...expand(access.deniedPermissions ?? [], catalog.all)].sort();
        return (
            JSON.stringify(a) !== JSON.stringify([...extra].sort()) ||
            JSON.stringify(d) !== JSON.stringify([...denied].sort())
        );
    }, [access, catalog, extra, denied]);

    const submit = async () => {
        setSaving(true);
        try {
            await assignUserAccess({
                userId,
                body: {
                    extraPermissions: [...extra],
                    deniedPermissions: [...denied],
                },
            }).unwrap();
            toast.success('Permission overrides updated.');
            if (!embedded && callbackUrl) router.push(callbackUrl);
        } catch (err) {
            toast.error(
                (err as { data?: { message?: string } })?.data?.message ||
                    'Failed to update permission overrides.',
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading || !catalog) {
        return (
            <div className="flex h-40 items-center justify-center">
                <Loader className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }
    if (isError || !access) {
        return (
            <p className="text-sm text-muted-foreground">
                Could not load this user&apos;s access.
            </p>
        );
    }

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

    const total = extra.size + denied.size;

    return (
        <div className="space-y-4">
            {/* Context + summary */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-muted-foreground">Base role</span>
                <Badge variant="secondary" className="capitalize">
                    {access.role?.replace(/_/g, ' ') || 'none'}
                </Badge>
                {access.email && (
                    <span className="text-muted-foreground">{access.email}</span>
                )}
                <span className="ml-auto flex items-center gap-3 text-xs font-medium">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" />
                        {extra.size}
                    </span>
                    <span className="flex items-center gap-1 text-destructive">
                        <X className="h-3.5 w-3.5" />
                        {denied.size}
                    </span>
                </span>
            </div>

            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                Every permission is <strong>Inherit</strong> by default (follows
                the role / department / designation).{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">
                    Allow
                </strong>{' '}
                grants it to this user only;{' '}
                <strong className="text-destructive">Deny</strong> removes it even
                when a role or scope grants it. Deny wins.
            </p>

            {/* Search + reset */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Filter permissions…"
                        className="pl-8"
                    />
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={reset}
                    disabled={saving || !dirty}
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                </Button>
            </div>

            {/* 3-up card grid — one card per resource */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {groups.map((group) => {
                    const keys = group.permissions.map((p) => p.key);
                    const gAllow = keys.filter((k) => extra.has(k)).length;
                    const gDeny = keys.filter((k) => denied.has(k)).length;

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
                                    <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium">
                                        {gAllow > 0 && (
                                            <span className="text-emerald-600 dark:text-emerald-400">
                                                +{gAllow}
                                            </span>
                                        )}
                                        {gDeny > 0 && (
                                            <span className="text-destructive">
                                                −{gDeny}
                                            </span>
                                        )}
                                    </span>
                                </div>
                                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <span>Set all</span>
                                    <button
                                        type="button"
                                        className="rounded px-1 hover:bg-muted hover:text-foreground"
                                        onClick={() =>
                                            setGroupMode(keys, 'inherit')
                                        }
                                    >
                                        Inherit
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded px-1 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                                        onClick={() => setGroupMode(keys, 'allow')}
                                    >
                                        Allow
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded px-1 text-destructive hover:bg-destructive/10"
                                        onClick={() => setGroupMode(keys, 'deny')}
                                    >
                                        Deny
                                    </button>
                                </div>
                            </CardHeader>

                            <CardContent className="divide-y px-3 py-1">
                                {group.permissions.map((perm) => {
                                    const inRole = roleGrants.has(perm.key);
                                    const canAllow =
                                        isSuperuser || can(perm.key);
                                    return (
                                        <div
                                            key={perm.key}
                                            className="flex items-center justify-between gap-2 py-2"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="truncate text-[13px]">
                                                        {perm.label}
                                                    </span>
                                                    {inRole && (
                                                        <span
                                                            title="Granted by the base role"
                                                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                                                        />
                                                    )}
                                                </div>
                                                <span className="font-mono text-[10px] text-muted-foreground">
                                                    {perm.action}
                                                </span>
                                            </div>
                                            <TriToggle
                                                value={modeOf(perm.key)}
                                                canAllow={canAllow}
                                                onChange={(m) =>
                                                    setMode(perm.key, m)
                                                }
                                            />
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

            <FormActionDock
                saving={saving}
                dirty={dirty}
                onSave={submit}
                onCancel={
                    !embedded && callbackUrl
                        ? () => router.push(callbackUrl)
                        : undefined
                }
                saveLabel="Save overrides"
                status={
                    total === 0 ? (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Follows role — no overrides
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 font-medium">
                            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                                <Check className="h-3 w-3" />
                                {extra.size}
                            </span>
                            <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
                                <X className="h-3 w-3" />
                                {denied.size}
                            </span>
                        </span>
                    )
                }
            />
        </div>
    );
}
