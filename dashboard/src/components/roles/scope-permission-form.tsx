'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PermissionMatrix } from './permission-matrix';
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

            <div className="flex justify-end gap-2">
                <Button
                    variant="outline"
                    onClick={() => router.push(callbackUrl)}
                    disabled={saving}
                >
                    Cancel
                </Button>
                <Button onClick={submit} disabled={saving}>
                    {saving && <Loader className="h-4 w-4 animate-spin" />}
                    Save
                </Button>
            </div>
        </div>
    );
}
