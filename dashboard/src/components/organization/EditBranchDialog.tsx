'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { useUpdateBranchMutation } from '@/redux/features/branch/branchApi';
import type { IBranch } from '@/types/branch.type';

const branchSchema = z.object({
    name: z.string().min(2, 'Branch name is required'),
    code: z.string().min(2, 'Branch code is required'),
    address: z.string().optional(),
    isActive: z.boolean().default(true).optional(),
});

type BranchFormValues = z.infer<typeof branchSchema>;

interface EditBranchDialogProps {
    branch: IBranch | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function EditBranchDialog({
    branch,
    open,
    onOpenChange,
}: EditBranchDialogProps) {
    const [updateBranch, { isLoading }] = useUpdateBranchMutation();

    const form = useForm<BranchFormValues>({
        resolver: zodResolver(branchSchema),
        defaultValues: {
            name: '',
            code: '',
            address: '',
            isActive: true,
        },
    });

    const codeValue = useWatch({ control: form.control, name: 'code' });
    const isActiveValue = useWatch({ control: form.control, name: 'isActive' });

    useEffect(() => {
        if (branch) {
            form.reset({
                name: branch.name,
                code: branch.code,
                address: branch.address || '',
                isActive: branch.isActive,
            });
        }
    }, [branch, form]);

    const onSubmit = async (values: BranchFormValues) => {
        if (!branch) return;

        try {
            await updateBranch({
                id: branch._id,
                data: {
                    name: values.name.trim(),
                    code: values.code.toUpperCase().trim(),
                    address: values.address?.trim() || undefined,
                    isActive: values.isActive,
                },
            }).unwrap();

            toast.success('Branch updated successfully');
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error?.data?.message || (error as Error).message || 'Failed to update branch');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Branch</DialogTitle>
                    <DialogDescription>
                        Update branch information, location code, and active status.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="edit-branch-name">Branch Name *</Label>
                        <Input
                            id="edit-branch-name"
                            placeholder="e.g. Dhaka Head Office"
                            {...form.register('name')}
                        />
                        {form.formState.errors.name && (
                            <p className="text-xs text-destructive">
                                {form.formState.errors.name.message}
                            </p>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="edit-branch-code">Branch Code *</Label>
                        <Input
                            id="edit-branch-code"
                            placeholder="e.g. DHA"
                            value={codeValue || ''}
                            onChange={(e) =>
                                form.setValue('code', e.target.value.toUpperCase(), {
                                    shouldDirty: true,
                                })
                            }
                        />
                        {form.formState.errors.code && (
                            <p className="text-xs text-destructive">
                                {form.formState.errors.code.message}
                            </p>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="edit-branch-address">Address (Optional)</Label>
                        <Input
                            id="edit-branch-address"
                            placeholder="e.g. Dhaka, Bangladesh"
                            {...form.register('address')}
                        />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <Label>Status</Label>
                            <p className="text-xs text-muted-foreground">
                                Active branches can be selected for staff assignments
                            </p>
                        </div>
                        <Switch
                            checked={isActiveValue ?? true}
                            onCheckedChange={(val) =>
                                form.setValue('isActive', val, { shouldDirty: true })
                            }
                        />
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? <Spinner /> : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
