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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { useUpdateDepartmentMutation } from '@/redux/features/department/departmentApi';
import type { IDepartment } from '@/types/department.type';

const departmentSchema = z.object({
    name: z.string().min(2, 'Department name must be at least 2 characters'),
    code: z.string().min(2, 'Department code is required'),
    description: z.string().optional(),
    isActive: z.boolean().default(true).optional(),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;

interface EditDepartmentDialogProps {
    department: IDepartment | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function EditDepartmentDialog({
    department,
    open,
    onOpenChange,
}: EditDepartmentDialogProps) {
    const [updateDepartment, { isLoading }] = useUpdateDepartmentMutation();

    const form = useForm<DepartmentFormValues>({
        resolver: zodResolver(departmentSchema),
        defaultValues: {
            name: '',
            code: '',
            description: '',
            isActive: true,
        },
    });

    const codeValue = useWatch({ control: form.control, name: 'code' });
    const isActiveValue = useWatch({ control: form.control, name: 'isActive' });

    useEffect(() => {
        if (department) {
            form.reset({
                name: department.name,
                code: department.code,
                description: department.description || '',
                isActive: department.isActive,
            });
        }
    }, [department, form]);

    const onSubmit = async (values: DepartmentFormValues) => {
        if (!department) return;

        try {
            await updateDepartment({
                id: department._id,
                data: {
                    name: values.name.trim(),
                    code: values.code.toUpperCase().trim(),
                    description: values.description?.trim() || undefined,
                    isActive: values.isActive,
                },
            }).unwrap();

            toast.success('Department updated successfully');
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error?.data?.message || (error as Error).message || 'Failed to update department');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Department</DialogTitle>
                    <DialogDescription>
                        Update department details and active status.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="edit-dept-name">Department Name *</Label>
                        <Input
                            id="edit-dept-name"
                            placeholder="e.g. Human Resources"
                            {...form.register('name')}
                        />
                        {form.formState.errors.name && (
                            <p className="text-xs text-destructive">
                                {form.formState.errors.name.message}
                            </p>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="edit-dept-code">Department Code *</Label>
                        <Input
                            id="edit-dept-code"
                            placeholder="e.g. HR"
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
                        <Label htmlFor="edit-dept-desc">Description (Optional)</Label>
                        <Textarea
                            id="edit-dept-desc"
                            placeholder="Briefly describe this department's role..."
                            rows={3}
                            {...form.register('description')}
                        />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <Label>Status</Label>
                            <p className="text-xs text-muted-foreground">
                                Active departments can be assigned to employees
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
