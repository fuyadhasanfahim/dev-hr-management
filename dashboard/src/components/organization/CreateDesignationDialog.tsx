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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useCreateDesignationMutation } from '@/redux/features/designation/designationApi';
import { useGetAllDepartmentsQuery } from '@/redux/features/department/departmentApi';

const designationSchema = z.object({
    name: z.string().min(2, 'Designation name must be at least 2 characters'),
    code: z.string().min(2, 'Designation code is required'),
    department: z.string().optional(),
    description: z.string().optional(),
    isActive: z.boolean().default(true).optional(),
});

type DesignationFormValues = z.infer<typeof designationSchema>;

export default function CreateDesignationDialog() {
    const [open, setOpen] = useState(false);
    const [createDesignation, { isLoading }] = useCreateDesignationMutation();
    const { data: deptData } = useGetAllDepartmentsQuery({ isActive: true });

    const departments = deptData?.departments || [];

    const form = useForm<DesignationFormValues>({
        resolver: zodResolver(designationSchema),
        defaultValues: {
            name: '',
            code: '',
            department: '',
            description: '',
            isActive: true,
        },
    });

    const codeValue = useWatch({ control: form.control, name: 'code' });
    const deptValue = useWatch({ control: form.control, name: 'department' });
    const isActiveValue = useWatch({ control: form.control, name: 'isActive' });

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value;
        form.setValue('name', name);
        if (!form.formState.dirtyFields.code) {
            const generatedCode = name
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '_')
                .slice(0, 30);
            form.setValue('code', generatedCode);
        }
    };

    const onSubmit = async (values: DesignationFormValues) => {
        try {
            await createDesignation({
                name: values.name.trim(),
                code: values.code.toLowerCase().trim(),
                department: values.department?.trim() || undefined,
                description: values.description?.trim() || undefined,
                isActive: values.isActive,
            }).unwrap();

            toast.success('Designation created successfully');
            form.reset({
                name: '',
                code: '',
                department: '',
                description: '',
                isActive: true,
            });
            setOpen(false);
        } catch (error: any) {
            toast.error(error?.data?.message || (error as Error).message || 'Failed to create designation');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="size-4" />
                    New Designation
                </Button>
            </DialogTrigger>

            <DialogContent className="w-full max-w-md">
                <DialogHeader>
                    <DialogTitle>Create Designation</DialogTitle>
                    <DialogDescription>
                        Add a new job designation/title for your organization.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="desig-name">Designation Title *</Label>
                        <Input
                            id="desig-name"
                            placeholder="e.g. Senior Software Engineer"
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
                        <Label htmlFor="desig-code">Designation Code / Key *</Label>
                        <Input
                            id="desig-code"
                            placeholder="e.g. senior_software_engineer"
                            value={codeValue || ''}
                            onChange={(e) =>
                                form.setValue('code', e.target.value.toLowerCase(), {
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
                        <Label htmlFor="desig-dept">Associated Department (Optional)</Label>
                        <Select
                            value={deptValue || 'none'}
                            onValueChange={(val) =>
                                form.setValue('department', val === 'none' ? '' : val, {
                                    shouldDirty: true,
                                })
                            }
                        >
                            <SelectTrigger id="desig-dept" className="w-full">
                                <SelectValue placeholder="Select a department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None / Any Department</SelectItem>
                                {departments.map((d) => (
                                    <SelectItem key={d._id} value={d.name}>
                                        {d.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="desig-desc">Description (Optional)</Label>
                        <Textarea
                            id="desig-desc"
                            placeholder="Briefly describe job responsibilities..."
                            rows={3}
                            {...form.register('description')}
                        />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <Label>Status</Label>
                            <p className="text-xs text-muted-foreground">
                                Active designations can be assigned to staff
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
                            {isLoading ? <Spinner /> : 'Create Designation'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
