'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { useCreateDepartmentMutation } from '@/redux/features/department/departmentApi';

const departmentSchema = z.object({
    name: z.string().min(2, 'Department name must be at least 2 characters'),
    code: z.string().min(2, 'Department code is required'),
    description: z.string().optional(),
    isActive: z.boolean().default(true).optional(),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;

export default function CreateDepartmentDialog() {
    const [open, setOpen] = useState(false);
    const [createDepartment, { isLoading }] = useCreateDepartmentMutation();

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

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value;
        form.setValue('name', name);
        // Auto-generate code if code is empty or untouched
        if (!form.formState.dirtyFields.code) {
            const generatedCode = name
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '_')
                .slice(0, 8);
            form.setValue('code', generatedCode);
        }
    };

    const onSubmit = async (values: DepartmentFormValues) => {
        try {
            await createDepartment({
                name: values.name.trim(),
                code: values.code.toUpperCase().trim(),
                description: values.description?.trim() || undefined,
                isActive: values.isActive,
            }).unwrap();

            toast.success('Department created successfully');
            form.reset({
                name: '',
                code: '',
                description: '',
                isActive: true,
            });
            setOpen(false);
        } catch (error: any) {
            toast.error(error?.data?.message || (error as Error).message || 'Failed to create department');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="size-4" />
                    New Department
                </Button>
            </DialogTrigger>

            <DialogContent className="w-full max-w-md">
                <DialogHeader>
                    <DialogTitle>Create Department</DialogTitle>
                    <DialogDescription>
                        Add a new department for your company organization structure.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="dept-name">Department Name *</Label>
                        <Input
                            id="dept-name"
                            placeholder="e.g. Human Resources, Marketing"
                            {...form.register('name')}
                            onChange={handleNameChange}
                        />
                        {form.formState.errors.name && (
                            <p className="text-xs text-destructive">
                                {form.formState.errors.name.message}
                            </p>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="dept-code">Department Code *</Label>
                        <Input
                            id="dept-code"
                            placeholder="e.g. HR, MKT, PROD"
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
                        <Label htmlFor="dept-desc">Description (Optional)</Label>
                        <Textarea
                            id="dept-desc"
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
                            {isLoading ? <Spinner /> : 'Create Department'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
