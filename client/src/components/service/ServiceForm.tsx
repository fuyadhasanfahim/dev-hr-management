import React from 'react';
import { useForm, useWatch, Controller, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Briefcase, DollarSign, Activity } from 'lucide-react';
import { IService } from '@/types/order.type';

const serviceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  category: z.string().optional(),
  description: z.string().optional(),
  pricingModel: z.enum(['fixed', 'hourly', 'milestone']),
  basePrice: z.coerce.number().min(0, 'Price cannot be negative').optional(),
  hourlyRate: z.coerce.number().min(0, 'Rate cannot be negative').optional(),
  milestoneNotes: z.string().optional(),
  isActive: z.boolean(),
});

export type ServiceFormValues = z.infer<typeof serviceSchema>;

interface ServiceFormProps {
  defaultValues?: Partial<IService>;
  onSubmit: (data: ServiceFormValues) => Promise<void>;
  isSubmitting: boolean;
  submitLabel?: string;
  onCancel: () => void;
  isEditMode?: boolean;
}

export function ServiceForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel = 'Create Service',
  onCancel,
}: ServiceFormProps) {
  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema) as unknown as Resolver<ServiceFormValues>,
    defaultValues: {
      name: defaultValues?.name || '',
      category: defaultValues?.category || '',
      description: defaultValues?.description || '',
      pricingModel: defaultValues?.pricingModel || 'fixed',
      basePrice: defaultValues?.basePrice || 0,
      hourlyRate: defaultValues?.hourlyRate || 0,
      milestoneNotes: defaultValues?.milestoneNotes || '',
      isActive: defaultValues?.isActive ?? true,
    },
  });

  const { control, handleSubmit, register, formState: { errors } } = form;
  const pricingModel = useWatch({ control, name: 'pricingModel' });

  const submitHandler = async (data: ServiceFormValues) => {
    // Validate conditionals
    if (data.pricingModel === 'fixed' && !data.basePrice) {
      form.setError('basePrice', { message: 'Base price is required for fixed pricing' });
      return;
    }
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(submitHandler)} className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/50">
        
        {/* Section 1: Basic Information */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <div className="p-1.5 bg-teal-100/50 rounded-md">
              <Briefcase className="w-4 h-4 text-teal-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">Basic Information</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-700">Service Name <span className="text-red-500">*</span></Label>
              <Input
                id="name"
                placeholder="e.g. Logo Design"
                {...register('name')}
                className="bg-white focus-visible:ring-teal-500"
              />
              {errors.name && <p className="text-sm font-medium text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-slate-700">Category</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="category" className="bg-white focus-visible:ring-teal-500">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="design">Design</SelectItem>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="consulting">Consulting</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.category && <p className="text-sm font-medium text-red-500">{errors.category.message}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description" className="text-slate-700">Description</Label>
              <Textarea
                id="description"
                placeholder="Detailed description of the service..."
                className="resize-none bg-white focus-visible:ring-teal-500 min-h-[100px]"
                {...register('description')}
              />
              {errors.description && <p className="text-sm font-medium text-red-500">{errors.description.message}</p>}
            </div>
          </div>
        </div>

        {/* Section 2: Pricing */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <div className="p-1.5 bg-teal-100/50 rounded-md">
              <DollarSign className="w-4 h-4 text-teal-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">Pricing</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="pricingModel" className="text-slate-700">Pricing Model</Label>
              <Controller
                control={control}
                name="pricingModel"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="pricingModel" className="bg-white focus-visible:ring-teal-500">
                      <SelectValue placeholder="Select pricing model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Price</SelectItem>
                      <SelectItem value="hourly">Hourly Rate</SelectItem>
                      <SelectItem value="milestone">Milestone Based</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.pricingModel && <p className="text-sm font-medium text-red-500">{errors.pricingModel.message}</p>}
            </div>

            {pricingModel === 'fixed' && (
              <div className="space-y-2">
                <Label htmlFor="basePrice" className="text-slate-700">Base Price ($) <span className="text-red-500">*</span></Label>
                <Input
                  id="basePrice"
                  type="number"
                  placeholder="0.00"
                  {...register('basePrice')}
                  className="bg-white focus-visible:ring-teal-500"
                />
                {errors.basePrice && <p className="text-sm font-medium text-red-500">{errors.basePrice.message}</p>}
              </div>
            )}

            {pricingModel === 'hourly' && (
              <div className="space-y-2">
                <Label htmlFor="hourlyRate" className="text-slate-700">Hourly Rate ($)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  placeholder="0.00"
                  {...register('hourlyRate')}
                  className="bg-white focus-visible:ring-teal-500"
                />
                {errors.hourlyRate && <p className="text-sm font-medium text-red-500">{errors.hourlyRate.message}</p>}
              </div>
            )}

            {pricingModel === 'milestone' && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="milestoneNotes" className="text-slate-700">Milestone Notes</Label>
                <Textarea
                  id="milestoneNotes"
                  placeholder="Describe standard milestones..."
                  className="resize-none bg-white focus-visible:ring-teal-500"
                  {...register('milestoneNotes')}
                />
                {errors.milestoneNotes && <p className="text-sm font-medium text-red-500">{errors.milestoneNotes.message}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Status */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <div className="p-1.5 bg-teal-100/50 rounded-md">
              <Activity className="w-4 h-4 text-teal-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">Status</h3>
          </div>

          <div className="flex flex-row items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="space-y-0.5">
              <Label htmlFor="isActive" className="text-base text-slate-800">Active Service</Label>
              <p className="text-sm text-slate-500">
                Inactive services will not be selectable when creating new orders.
              </p>
            </div>
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Switch
                  id="isActive"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="data-[state=checked]:bg-teal-600"
                />
              )}
            />
          </div>
        </div>

      </div>

      {/* Sticky Footer */}
      <div className="p-4 border-t border-slate-200 bg-white shrink-0 flex justify-end gap-3 shadow-[0_-1px_2px_rgba(0,0,0,0.02)]">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="hover:bg-slate-100"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-teal-600 hover:bg-teal-700 text-white min-w-[120px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}
