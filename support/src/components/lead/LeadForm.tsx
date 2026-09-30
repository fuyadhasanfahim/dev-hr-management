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
import { ScrollArea } from "@/components/ui/scroll-area";
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

const PRIORITY_OPTIONS = [
  { value: "High", dot: "bg-red-500" },
  { value: "Medium", dot: "bg-amber-500" },
  { value: "Low", dot: "bg-blue-500" },
] as const;

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
      className="flex min-h-0 flex-1 flex-col"
    >
      {/* Scrolls inside the dialog, so a long note never pushes the buttons off-screen. */}
      <ScrollArea className="min-h-0 flex-1 [&>[data-slot=scroll-area-viewport]]:max-h-[calc(90vh-10rem)]">
        <div className="space-y-6 px-6 py-5">
          <FormSection
            icon={User}
            title="Contact information"
            description="How to reach this lead."
          >
            <LeadContactInfo form={form} getFieldError={getFieldError} />
          </FormSection>

          <FormSection
            icon={Info}
            title="Pipeline"
            description={isEditMode ? "Where this lead stands right now." : "Where this lead starts in the pipeline."}
          >
            <LeadDetails
              form={form}
              getFieldError={getFieldError}
              statuses={statuses}
              sources={sources}
            />
          </FormSection>
        </div>
      </ScrollArea>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-muted/30 px-6 py-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
          {isSubmitting && <Loader className="h-4 w-4 animate-spin shrink-0" />}
          <span>{submitLabel}</span>
        </Button>
      </div>
    </form>
  );
}

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof User;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card/50 p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
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
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-foreground/90">
            Phone Number <span className="text-red-500">*</span>
          </Label>
          <Input
            id="phone"
            placeholder="+1 (555) 000-0000"
            {...register("phone")}
            className={cn(
              "bg-background border-border focus-visible:ring-primary",
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
          <Label htmlFor="name" className="text-foreground/90">
            Lead Name
          </Label>
          <Input
            id="name"
            placeholder="John Doe or Company"
            {...register("name")}
            className="bg-background border-border focus-visible:ring-primary"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground/90">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            {...register("email")}
            className={cn(
              "bg-background border-border focus-visible:ring-primary",
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
          <Label htmlFor="website" className="text-foreground/90">
            Website
          </Label>
          <Input
            id="website"
            placeholder="https://example.com"
            {...register("website")}
            className="bg-background border-border focus-visible:ring-primary"
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
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-foreground/90">Status</Label>
          <Select
            value={status || "none"}
            onValueChange={(value) => setValue("status", value)}
          >
            <SelectTrigger className="w-full bg-background border-border focus:ring-primary">
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
          <Label className="text-foreground/90">Priority</Label>
          <Select
            value={priority}
            onValueChange={(value: "High" | "Medium" | "Low") =>
              setValue("priority", value)
            }
          >
            <SelectTrigger className="w-full bg-background border-border focus:ring-primary">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2.5 h-2.5 rounded-full", p.dot)} />
                    {p.value}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-foreground/90">Source</Label>
          <Select
            value={source || "none"}
            onValueChange={(value) => setValue("source", value)}
          >
            <SelectTrigger className="w-full bg-background border-border focus:ring-primary">
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {sources?.map((opt) => (
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="currentNotes" className="text-foreground/90">
          Notes
        </Label>
        <Textarea
          id="currentNotes"
          placeholder="Add any initial notes or context about this lead..."
          {...register("currentNotes")}
          className="min-h-28 max-h-60 overflow-y-auto break-words resize-none bg-background border-border focus-visible:ring-primary"
        />
      </div>
    </div>
  );
}
