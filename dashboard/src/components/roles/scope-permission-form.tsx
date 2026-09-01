'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { PermissionMatrix } from './permission-matrix';
import { FormActionDock } from './form-action-dock';
import { useGetPermissionCatalogQuery } from '@/redux/features/role/roleApi';

interface ScopePermissionFormProps {
    /** Current permission list for the scope. */
    value: string[];
    /** Persist a new list. Should throw on failure. */
    onSave: (permissions: string[]) => Promise<unknown>;
    callbackUrl: string;
    savedLabel: string;
}

export function ScopePermissionForm({
    value,
    onSave,
    callbackUrl,
    savedLabel,
}: ScopePermissionFormProps) {
    const router = useRouter();
    const { data: catalog, isLoading } = useGetPermissionCatalogQuery();
    const [draft, setDraft] = useState<string[]>(value);
    const [saving, setSaving] = useState(false);

    const dirty = useMemo(
        () =>
            JSON.stringify([...value].sort()) !==
            JSON.stringify([...draft].sort()),
        [value, draft],
    );
    const selectedCount = draft.filter((p) => p !== '*').length;

    const submit = async () => {
        setSaving(true);
        try {
            await onSave(draft);
            toast.success(`Permissions updated for ${savedLabel}.`);
            router.push(callbackUrl);
        } catch (err) {
            toast.error(
                (err as { data?: { message?: string } })?.data?.message ||
                    'Failed to update permissions.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label>Permissions</Label>
                {isLoading || !catalog ? (
                    <div className="flex h-32 items-center justify-center">
                        <Loader className="h-5 w-5 animate-spin text-primary" />
                    </div>
                ) : (
                    <PermissionMatrix
                        catalog={catalog}
                        value={draft}
                        onChange={setDraft}
                        disabled={saving}
                    />
                )}
            </div>

            <FormActionDock
                saving={saving}
                dirty={dirty}
                onSave={submit}
                onCancel={() => router.push(callbackUrl)}
                status={
                    <span className="text-muted-foreground">
                        {draft.includes('*')
                            ? 'All permissions'
                            : `${selectedCount} permission${selectedCount === 1 ? '' : 's'}`}
                    </span>
                }
            />
        </div>
    );
}
