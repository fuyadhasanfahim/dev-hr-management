"use client";

import { useForm, useWatch, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader, User, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LeadSetting } from "@/types/lead.type";

export const leadFormSchema = z.object({
  name: z.string().optional(),
  phone: z
    .string()
    .min(1, "Phone is required")
    .min(5, "Phone is too short")
    .max(20, "Phone is too long"),
  email: z.union([z.string().email("Invalid email address"), z.literal(""), z.undefined()]),
  website: z.string().optional(),
  status: z.string().optional(),
  priority: z.enum(["High", "Medium", "Low"]),
  source: z.string().optional(),
  currentNotes: z.string().optional(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;

interface LeadFormProps {
  defaultValues?: Partial<LeadFormValues>;
  onSubmit: (data: LeadFormValues) => Promise<void>;
  isSubmitting: boolean;
  submitLabel: string;
  onCancel: () => void;
  serverErrors?: Record<string, string[]>;
  isEditMode?: boolean;
  statuses: LeadSetting[];
  sources: LeadSetting[];
}

export function LeadForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel,
  onCancel,
  serverErrors,
  isEditMode = false,
  statuses,
  sources,
}: LeadFormProps) {
  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      phone: defaultValues?.phone || "",
      email: defaultValues?.email || "",
      website: defaultValues?.website || "",
      status: defaultValues?.status || "",
      priority: defaultValues?.priority || "Medium",
      source: defaultValues?.source || "",
      currentNotes: defaultValues?.currentNotes || "",
    },
  });

  const { handleSubmit } = form;

  const handleFormSubmit = async (data: LeadFormValues) => {
    // Clean up empty strings for optional fields if needed
    const payload = {
      ...data,
      email: data.email === "" ? undefined : data.email,
      website: data.website === "" ? undefined : data.website,
      status: data.status === "none" || data.status === "" ? undefined : data.status,
      source: data.source === "none" || data.source === "" ? undefined : data.source,
    };
    await onSubmit(payload);
  };

  const getFieldError = (fieldName: string) => {
    const errors = form.formState.errors;
    const error = errors[fieldName as keyof typeof errors];
    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return error.message;
    }

    if (serverErrors?.[fieldName]?.[0]) return serverErrors[fieldName][0];
    return null;
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="flex flex-col h-full flex-1 overflow-hidden"
    >
      <div className="flex-1 overflow-y-auto p-6 space-y-10">
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
            <User className="h-5 w-5 text-teal-600" />
            <h3 className="font-semibold text-slate-900 text-lg">
              Contact Information
            </h3>
          </div>
          <LeadContactInfo form={form} getFieldError={getFieldError} />
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
            <Info className="h-5 w-5 text-teal-600" />
            <h3 className="font-semibold text-slate-900 text-lg">
              Lead Details
            </h3>
          </div>
          <LeadDetails
            form={form}
            getFieldError={getFieldError}
            statuses={statuses}
            sources={sources}
          />
        </section>
      </div>

      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 sticky bottom-0 z-20 shrink-0 shadow-[0_-1px_2px_rgba(0,0,0,0.02)]">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="bg-white border-slate-200"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="min-w-[120px] bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
        >
          {isSubmitting && <Loader className="h-4 w-4 animate-spin shrink-0" />}
          <span>{submitLabel}</span>
        </Button>
      </div>
    </form>
  );
}

function LeadContactInfo({
  form,
  getFieldError,
}: {
  form: UseFormReturn<LeadFormValues>;
  getFieldError: (f: string) => string | null;
}) {
  const { register } = form;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-slate-700">
            Phone Number <span className="text-red-500">*</span>
          </Label>
          <Input
            id="phone"
            placeholder="+1 (555) 000-0000"
            {...register("phone")}
            className={cn(
              "bg-slate-50/50 border-slate-200 focus-visible:ring-teal-500",
              getFieldError("phone") && "border-red-500 focus-visible:ring-red-500"
            )}
          />
          {getFieldError("phone") && (
            <p className="text-xs text-red-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {getFieldError("phone")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name" className="text-slate-700">
            Lead Name
          </Label>
          <Input
            id="name"
            placeholder="John Doe or Company"
            {...register("name")}
            className="bg-slate-50/50 border-slate-200 focus-visible:ring-teal-500"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-700">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            {...register("email")}
            className={cn(
              "bg-slate-50/50 border-slate-200 focus-visible:ring-teal-500",
              getFieldError("email") && "border-red-500 focus-visible:ring-red-500"
            )}
          />
          {getFieldError("email") && (
            <p className="text-xs text-red-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {getFieldError("email")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="website" className="text-slate-700">
            Website
          </Label>
          <Input
            id="website"
            placeholder="https://example.com"
            {...register("website")}
            className="bg-slate-50/50 border-slate-200 focus-visible:ring-teal-500"
          />
        </div>
      </div>
    </div>
  );
}

function LeadDetails({
  form,
  getFieldError,
  statuses,
  sources,
}: {
  form: UseFormReturn<LeadFormValues>;
  getFieldError: (f: string) => string | null;
  statuses: LeadSetting[];
  sources: LeadSetting[];
}) {
  const { register, control, setValue } = form;
  const status = useWatch({ control, name: "status" });
  const priority = useWatch({ control, name: "priority" });
  const source = useWatch({ control, name: "source" });

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label className="text-slate-700">Status</Label>
          <Select
            value={status || "none"}
            onValueChange={(value) => setValue("status", value)}
          >
            <SelectTrigger className="w-full bg-slate-50/50 border-slate-200 focus:ring-teal-500">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {statuses?.map((opt) => (
                <SelectItem key={opt._id} value={opt._id}>
                  <div className="flex items-center gap-2">
                    {opt.color && (
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: opt.color }}
                      />
                    )}
                    {opt.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-700">Priority</Label>
          <Select
            value={priority}
            onValueChange={(value: "High" | "Medium" | "Low") =>
              setValue("priority", value)
            }
          >
            <SelectTrigger className="w-full bg-slate-50/50 border-slate-200 focus:ring-teal-500">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-700">Source</Label>
          <Select
            value={source || "none"}
            onValueChange={(value) => setValue("source", value)}
          >
            <SelectTrigger className="w-full bg-slate-50/50 border-slate-200 focus:ring-teal-500">
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {sources?.map((opt) => (
                <SelectItem key={opt._id} value={opt._id}>
                  {opt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="currentNotes" className="text-slate-700">
          Notes
        </Label>
        <Textarea
          id="currentNotes"
          placeholder="Add any initial notes or context about this lead..."
          {...register("currentNotes")}
          className="min-h-[120px] bg-slate-50/50 border-slate-200 focus-visible:ring-teal-500 resize-y"
        />
      </div>
    </div>
  );
}
