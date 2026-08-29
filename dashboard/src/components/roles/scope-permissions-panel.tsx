'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader, Pencil } from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { PermissionMatrix } from './permission-matrix';
import { useGetPermissionCatalogQuery } from '@/redux/features/role/roleApi';

export interface ScopeItem {
    _id: string;
    name: string;
    code?: string;
    permissions?: string[];
}

interface ScopePermissionsPanelProps {
    description: string;
    items: ScopeItem[];
    isLoading?: boolean;
    canManage: boolean;
    /** Persist a new permission list for one item. Should throw on failure. */
    onSave: (id: string, permissions: string[]) => Promise<unknown>;
}

/**
 * Phase 6 — list departments / designations and edit the extra permissions
 * granted to everyone in that scope.
 */
export function ScopePermissionsPanel({
    description,
    items,
    isLoading,
    canManage,
    onSave,
}: ScopePermissionsPanelProps) {
    const { data: catalog } = useGetPermissionCatalogQuery();
    const [editing, setEditing] = useState<ScopeItem | null>(null);
    const [draft, setDraft] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (editing) setDraft(editing.permissions ?? []);
    }, [editing]);

    const handleSave = async () => {
        if (!editing) return;
        setSaving(true);
        try {
            await onSave(editing._id, draft);
            toast.success(`Permissions updated for "${editing.name}".`);
            setEditing(null);
        } catch (err) {
            const msg =
                (err as { data?: { message?: string } })?.data?.message ||
                'Failed to update permissions.';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-32 items-center justify-center">
                <Loader className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{description}</p>

            {items.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing here yet.</p>
            )}

            {items.map((item) => (
                <Card key={item._id}>
                    <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <CardTitle className="text-base">{item.name}</CardTitle>
                                {item.code && (
                                    <CardDescription className="font-mono text-xs">
                                        {item.code}
                                    </CardDescription>
                                )}
                            </div>
                            {canManage && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditing(item)}
                                    aria-label="Edit permissions"
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-1">
                            {(item.permissions ?? []).length === 0 && (
                                <span className="text-xs text-muted-foreground">
                                    No extra permissions
                                </span>
                            )}
                            {(item.permissions ?? []).slice(0, 12).map((p) => (
                                <Badge
                                    key={p}
                                    variant="outline"
                                    className="font-mono text-[10px]"
                                >
                                    {p}
                                </Badge>
                            ))}
                            {(item.permissions ?? []).length > 12 && (
                                <Badge variant="secondary" className="text-[10px]">
                                    +{(item.permissions ?? []).length - 12} more
                                </Badge>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}

            <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Permissions — {editing?.name}</DialogTitle>
                        <DialogDescription>
                            Granted to every staff member in this scope, on top
                            of their role.
                        </DialogDescription>
                    </DialogHeader>

                    {catalog ? (
                        <PermissionMatrix
                            catalog={catalog}
                            value={draft}
                            onChange={setDraft}
                            disabled={saving}
                        />
                    ) : (
                        <div className="flex h-24 items-center justify-center">
                            <Loader className="h-5 w-5 animate-spin text-primary" />
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setEditing(null)}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader className="h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
