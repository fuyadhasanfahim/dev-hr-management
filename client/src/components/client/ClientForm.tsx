'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useForm, useFieldArray, useWatch, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Loader,
    Plus,
    Trash2,
    Users,
    Briefcase,
    User,
    FileText,
    UsersRound
} from 'lucide-react';
import { useLazyCheckClientIdQuery } from '@/redux/features/client/clientApi';
import { useGetServicesQuery } from '@/redux/features/service/serviceApi';
import { cn } from '@/lib/utils';
import { MultiSelect } from '@/components/ui/multi-select';

// --- SCHEMAS & TYPES ---

const teamMemberSchema = z.object({
    _id: z.string().optional(),
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    phone: z.string().optional(),
    designation: z.string().optional(),
});

export const clientFormSchema = z.object({
    clientId: z
        .string()
        .min(1, 'Client ID is required')
        .min(2, 'Client ID must be at least 2 characters')
        .max(50, 'Client ID must be at most 50 characters')
        .regex(
            /^[A-Za-z0-9_-]+$/,
            'Client ID can only contain letters, numbers, hyphens, and underscores',
        ),
    name: z
        .string()
        .min(1, 'Name is required')
        .min(2, 'Name must be at least 2 characters'),
    emails: z
        .array(z.object({ value: z.string().email('Invalid email address') }))
        .min(1, 'At least one email is required'),
    phone: z.string().optional(),
    address: z.string().optional(),
    officeAddress: z.string().optional(),
    description: z.string().optional(),
    currency: z.string().optional(),
    status: z.enum(['active', 'inactive']),
    teamMembers: z.array(teamMemberSchema),
    assignedServices: z.array(z.string()),
});

export type FormValues = z.infer<typeof clientFormSchema>;

export interface ClientFormData {
    clientId: string;
    name: string;
    emails: string[];
    phone?: string;
    address?: string;
    officeAddress?: string;
    description?: string;
    currency?: string;
    status: 'active' | 'inactive';
    teamMembers: {
        _id?: string;
        name: string;
        email: string;
        phone?: string;
        designation?: string;
    }[];
    assignedServices: string[];
}

interface ClientFormProps {
    defaultValues?: Partial<ClientFormData>;
    onSubmit: (data: ClientFormData) => Promise<void>;
    isSubmitting: boolean;
    submitLabel: string;
    onCancel: () => void;
    serverErrors?: Record<string, string[]>;
    isEditMode?: boolean;
}

const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
];

const currencyOptions = [
    { value: 'USD', label: 'US Dollar ($)' },
    { value: 'EUR', label: 'Euro (€)' },
    { value: 'GBP', label: 'British Pound (£)' },
    { value: 'AUD', label: 'Australian Dollar (A$)' },
    { value: 'CAD', label: 'Canadian Dollar (C$)' },
];

// --- MAIN COMPONENT ---

export function ClientForm({
    defaultValues,
    onSubmit,
    isSubmitting,
    submitLabel,
    onCancel,
    serverErrors,
    isEditMode = false,
}: ClientFormProps) {
    const [checkClientId, { isFetching: isCheckingId, data: checkResult, originalArgs: lastCheckedClientId }] =
        useLazyCheckClientIdQuery();
    const { data: servicesData } = useGetServicesQuery({ isActive: true });
    
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(clientFormSchema),
        defaultValues: {
            clientId: defaultValues?.clientId || '',
            name: defaultValues?.name || '',
            emails: defaultValues?.emails?.map(email => ({ value: email })) || [{ value: '' }],
            phone: defaultValues?.phone || '',
            address: defaultValues?.address || '',
            officeAddress: defaultValues?.officeAddress || '',
            description: defaultValues?.description || '',
            currency: defaultValues?.currency || '',
            status: defaultValues?.status || 'active',
            teamMembers: defaultValues?.teamMembers || [],
            assignedServices: defaultValues?.assignedServices || [],
        },
    });

    const {
        handleSubmit,
        control,
    } = form;

    const clientIdValue = useWatch({ control, name: 'clientId' });

    // Derived client ID error from API result
    const clientIdError = useMemo(() => {
        if (isEditMode || !clientIdValue || clientIdValue.length < 2) return null;
        if (lastCheckedClientId === clientIdValue && checkResult && !checkResult.available) {
            const suggestions = checkResult.suggestions?.join(', ') || '';
            return `Client ID "${clientIdValue}" already exists.${suggestions ? ` Try: ${suggestions}` : ''}`;
        }
        return null;
    }, [isEditMode, clientIdValue, lastCheckedClientId, checkResult]);

    // Debounced client ID check
    useEffect(() => {
        if (isEditMode || !clientIdValue || clientIdValue.length < 2) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(async () => {
            try {
                await checkClientId(clientIdValue).unwrap();
            } catch {
                // Ignore API error
            }
        }, 500);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [clientIdValue, isEditMode, checkClientId]);

    const handleFormSubmit = async (data: FormValues) => {
        if (clientIdError && !isEditMode) return;
        const formattedData: ClientFormData = {
            clientId: data.clientId,
            name: data.name,
            emails: data.emails.map(e => e.value),
            phone: data.phone,
            address: data.address,
            officeAddress: data.officeAddress,
            description: data.description,
            currency: data.currency,
            status: data.status,
            teamMembers: data.teamMembers,
            assignedServices: data.assignedServices,
        };
        await onSubmit(formattedData);
    };

    const getFieldError = (fieldName: string) => {
        if (fieldName === 'clientId' && clientIdError) return clientIdError;

        const errors = form.formState.errors;
        
        if (fieldName.startsWith('emails')) {
            const parts = fieldName.split('.');
            if (parts.length >= 2) {
                const index = parseInt(parts[1]);
                const emailErrors = errors.emails;
                if (emailErrors && emailErrors[index]?.value?.message) {
                    return emailErrors[index]?.value?.message;
                }
            }
        }

        if (fieldName.startsWith('teamMembers')) {
            const parts = fieldName.split('.');
            if (parts.length >= 3) {
                const index = parseInt(parts[1]);
                const subField = parts[2] as keyof FormValues['teamMembers'][0];
                const teamErrors = errors.teamMembers;
                if (teamErrors && teamErrors[index]) {
                    const fieldError = teamErrors[index]?.[subField];
                    if (fieldError && typeof fieldError === 'object' && 'message' in fieldError && typeof fieldError.message === 'string') {
                        return fieldError.message;
                    }
                }
            }
        }

        const error = errors[fieldName as keyof typeof errors];
        if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
            return error.message;
        }

        if (serverErrors?.[fieldName]?.[0]) return serverErrors[fieldName][0];
        return null;
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col h-full flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-10">
                
                {/* Basic Info Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                        <User className="h-5 w-5 text-teal-600" />
                        <h3 className="font-semibold text-slate-900 text-lg">Basic Information</h3>
                    </div>
                    <ClientBasicInfo 
                        form={form} 
                        isEditMode={isEditMode} 
                        isCheckingId={isCheckingId}
                        getFieldError={getFieldError}
                    />
                </section>

                {/* Team Members Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                        <Users className="h-5 w-5 text-teal-600" />
                        <h3 className="font-semibold text-slate-900 text-lg">Team Members</h3>
                    </div>
                    <ClientTeamSection 
                        form={form} 
                        getFieldError={getFieldError} 
                    />
                </section>

                {/* Service Assignment Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                        <Briefcase className="h-5 w-5 text-teal-600" />
                        <h3 className="font-semibold text-slate-900 text-lg">Service Assignment</h3>
                    </div>
                    <ClientServiceSection 
                        form={form} 
                        servicesData={servicesData} 
                    />
                </section>

                {/* Additional Details Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                        <FileText className="h-5 w-5 text-teal-600" />
                        <h3 className="font-semibold text-slate-900 text-lg">Additional Details</h3>
                    </div>
                    <ClientAdditionalDetails 
                        form={form} 
                    />
                </section>
                
            </div>

            {/* Sticky Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 sticky bottom-0 z-20 shrink-0 shadow-[0_-1px_2px_rgba(0,0,0,0.02)]">
                <Button type="button" variant="outline" onClick={onCancel} className="bg-white border-slate-200">
                    Cancel
                </Button>
                <Button
                    type="submit"
                    disabled={isSubmitting || (!!clientIdError && !isEditMode)}
                    className="min-w-[120px] bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                >
                    {isSubmitting && <Loader className="h-4 w-4 animate-spin shrink-0" />}
                    <span>{submitLabel}</span>
                </Button>
            </div>
        </form>
    );
}


// --- SUB COMPONENTS ---

function ClientBasicInfo({ 
    form, 
    isEditMode, 
    isCheckingId, 
    getFieldError 
}: { 
    form: UseFormReturn<FormValues>, 
    isEditMode: boolean,
    isCheckingId: boolean,
    getFieldError: (f: string) => string | null 
}) {
    const { register, control, setValue } = form;
    const { fields: emailFields, append: appendEmail, remove: removeEmail } = useFieldArray({ control, name: "emails" });
    const status = useWatch({ control, name: 'status' });

    return (
        <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="clientId" className="text-slate-700">Client ID <span className="text-red-500">*</span></Label>
                    <div className="relative">
                        <Input
                            id="clientId"
                            placeholder="e.g., CLT-001"
                            {...register('clientId')}
                            disabled={isEditMode}
                            className={cn("bg-slate-50/50 border-slate-200 focus-visible:ring-teal-500", getFieldError('clientId') && 'border-red-500 focus-visible:ring-red-500')}
                        />
                        {isCheckingId && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <Loader className="h-4 w-4 animate-spin text-slate-400" />
                            </div>
                        )}
                    </div>
                    {getFieldError('clientId') && <p className="text-xs text-red-500 font-medium">{getFieldError('clientId')}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="name" className="text-slate-700">Client Name <span className="text-red-500">*</span></Label>
                    <Input
                        id="name"
                        placeholder="Company or individual name"
                        {...register('name')}
                        className={cn("bg-slate-50/50 border-slate-200 focus-visible:ring-teal-500", getFieldError('name') && 'border-red-500 focus-visible:ring-red-500')}
                    />
                    {getFieldError('name') && <p className="text-xs text-red-500 font-medium">{getFieldError('name')}</p>}
                </div>
            </div>

            <div className="space-y-3">
                <Label className="text-slate-700">Email Addresses <span className="text-red-500">*</span></Label>
                <div className="space-y-3">
                    {emailFields.map((field, index) => (
                        <div key={field.id} className="space-y-1">
                            <div className="flex gap-2">
                                <Input
                                    {...register(`emails.${index}.value` as const)}
                                    type="email"
                                    placeholder="contact@company.com"
                                    className={cn("bg-slate-50/50 border-slate-200 focus-visible:ring-teal-500", getFieldError(`emails.${index}`) && 'border-red-500 focus-visible:ring-red-500')}
                                />
                                {emailFields.length > 1 && (
                                    <Button type="button" variant="outline" size="icon" className="shrink-0 text-slate-500 hover:text-red-600 border-slate-200" onClick={() => removeEmail(index)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            {getFieldError(`emails.${index}`) && <p className="text-xs text-red-500 font-medium">{getFieldError(`emails.${index}`)}</p>}
                        </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" className="bg-slate-50 border-slate-200 text-teal-700 hover:text-teal-800 hover:bg-slate-100 gap-2" onClick={() => appendEmail({ value: '' })}>
                        <Plus className="h-4 w-4" />
                        Add Email
                    </Button>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="phone" className="text-slate-700">Phone</Label>
                    <Input id="phone" placeholder="+1 (555) 000-0000" {...register('phone')} className="bg-slate-50/50 border-slate-200 focus-visible:ring-teal-500" />
                </div>

                <div className="space-y-2">
                    <Label className="text-slate-700">Status</Label>
                    <Select value={status} onValueChange={(value: 'active' | 'inactive') => setValue('status', value)}>
                        <SelectTrigger className="w-full bg-slate-50/50 border-slate-200 focus:ring-teal-500">
                            <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                            {statusOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}


function ClientTeamSection({ 
    form, 
    getFieldError 
}: { 
    form: UseFormReturn<FormValues>,
    getFieldError: (f: string) => string | null 
}) {
    const { register, control } = form;
    const { fields: teamFields, append: appendTeam, remove: removeTeam } = useFieldArray({ control, name: "teamMembers" });

    return (
        <div className="space-y-4">
            {teamFields.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-center">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                        <UsersRound className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-900 mb-1">No team members added</p>
                    <p className="text-xs text-slate-500 max-w-[250px] mb-4">Add key contacts or team members associated with this client.</p>
                    <Button type="button" variant="outline" size="sm" className="bg-white border-slate-200 text-teal-700 hover:text-teal-800 hover:bg-slate-50 gap-2" onClick={() => appendTeam({ name: '', email: '' })}>
                        <Plus className="h-4 w-4" />
                        Add Team Member
                    </Button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid gap-4">
                        {teamFields.map((field, index) => (
                            <div key={field.id} className="relative p-5 border border-slate-200 rounded-xl bg-white shadow-sm transition-all hover:shadow-md group">
                                <button
                                    type="button"
                                    className="absolute top-3 right-3 p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                    onClick={() => removeTeam(index)}
                                    title="Remove member"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                                <div className="grid md:grid-cols-2 gap-4 mr-6">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Name <span className="text-red-500">*</span></Label>
                                        <Input
                                            placeholder="Full Name"
                                            {...register(`teamMembers.${index}.name`)}
                                            className={cn("h-9 bg-slate-50/50 focus-visible:ring-teal-500", getFieldError(`teamMembers.${index}.name`) && 'border-red-500')}
                                        />
                                        {getFieldError(`teamMembers.${index}.name`) && <p className="text-[10px] text-red-500">{getFieldError(`teamMembers.${index}.name`)}</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Email <span className="text-red-500">*</span></Label>
                                        <Input
                                            placeholder="email@example.com"
                                            {...register(`teamMembers.${index}.email`)}
                                            className={cn("h-9 bg-slate-50/50 focus-visible:ring-teal-500", getFieldError(`teamMembers.${index}.email`) && 'border-red-500')}
                                        />
                                        {getFieldError(`teamMembers.${index}.email`) && <p className="text-[10px] text-red-500">{getFieldError(`teamMembers.${index}.email`)}</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Designation</Label>
                                        <Input
                                            placeholder="e.g., Marketing Director"
                                            {...register(`teamMembers.${index}.designation`)}
                                            className="h-9 bg-slate-50/50 focus-visible:ring-teal-500"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Phone</Label>
                                        <Input
                                            placeholder="+1 (555) 000-0000"
                                            {...register(`teamMembers.${index}.phone`)}
                                            className="h-9 bg-slate-50/50 focus-visible:ring-teal-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button type="button" variant="outline" size="sm" className="bg-slate-50 border-slate-200 text-teal-700 hover:text-teal-800 hover:bg-slate-100 gap-2 w-full border-dashed" onClick={() => appendTeam({ name: '', email: '' })}>
                        <Plus className="h-4 w-4" />
                        Add Another Member
                    </Button>
                </div>
            )}
        </div>
    );
}


function ClientServiceSection({ 
    form, 
    servicesData 
}: { 
    form: UseFormReturn<FormValues>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    servicesData: any 
}) {
    const { control, setValue } = form;
    const assignedServices = useWatch({ control, name: 'assignedServices' });

    const serviceOptions = servicesData?.data?.map((s: { name: string, _id: string }) => ({
        label: s.name,
        value: s._id
    })) || [];

    return (
        <div className="space-y-3">
            <Label className="text-slate-700">Services</Label>
            <MultiSelect
                options={serviceOptions}
                selected={assignedServices}
                onChange={(selected) => setValue('assignedServices', selected)}
                placeholder="Assign active services to this client..."
                // Assuming MultiSelect accepts className, passing classes for consistency
                className="bg-slate-50/50 border-slate-200 focus-within:ring-teal-500 focus-within:border-teal-500"
            />
            <p className="text-xs text-slate-500">
                If no services are assigned, all active services will be available during order creation.
            </p>
        </div>
    );
}


function ClientAdditionalDetails({ 
    form 
}: { 
    form: UseFormReturn<FormValues> 
}) {
    const { register, control, setValue } = form;
    const currency = useWatch({ control, name: 'currency' });

    return (
        <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="address" className="text-slate-700">Billing Address</Label>
                    <Input id="address" placeholder="123 Main St, City, Country" {...register('address')} className="bg-slate-50/50 border-slate-200 focus-visible:ring-teal-500" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="officeAddress" className="text-slate-700">Office Address</Label>
                    <Input id="officeAddress" placeholder="Suite 400, Business Park" {...register('officeAddress')} className="bg-slate-50/50 border-slate-200 focus-visible:ring-teal-500" />
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-slate-700">Default Currency</Label>
                    <Select value={currency || ''} onValueChange={(value) => setValue('currency', value === 'none' ? '' : value)}>
                        <SelectTrigger className="w-full bg-slate-50/50 border-slate-200 focus:ring-teal-500">
                            <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Not specified</SelectItem>
                            {currencyOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="description" className="text-slate-700">Internal Notes</Label>
                <Textarea
                    id="description"
                    placeholder="Add any specific details, SLAs, or billing instructions..."
                    {...register('description')}
                    className="min-h-[120px] bg-slate-50/50 border-slate-200 focus-visible:ring-teal-500 resize-y"
                />
            </div>
        </div>
    );
}
