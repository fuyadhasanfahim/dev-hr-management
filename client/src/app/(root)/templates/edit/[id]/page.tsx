"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useGetQuotationTemplateByIdQuery,
  useUpdateQuotationTemplateMutation,
} from "@/redux/features/quotation/quotationApi";
import TemplateBuilder, { TemplateData } from "@/components/template/TemplateBuilder";
import { toast } from "sonner";

export default function EditTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: fetchedTemplate, isLoading: isFetching } = useGetQuotationTemplateByIdQuery(id, { skip: !id });
  const [updateTemplate, { isLoading: isUpdating }] = useUpdateQuotationTemplateMutation();

  const [data, setData] = useState<TemplateData>({
    name: "",
    overview: "",
    phases: [],
    techStack: {
      frontend: "",
      backend: "",
      database: "",
      tools: [],
    },
    pricing: {
      basePrice: 0,
      discount: 0,
    },
    additionalServices: [],
    workflow: [],
    paymentMilestones: [],
  });

  useEffect(() => {
    if (fetchedTemplate) {
      setData({
        name: fetchedTemplate.name || "",
        overview: fetchedTemplate.overview || "",
        phases: fetchedTemplate.phases || [],
        techStack: {
          frontend: fetchedTemplate.techStack?.frontend || "",
          backend: fetchedTemplate.techStack?.backend || "",
          database: fetchedTemplate.techStack?.database || "",
          tools: fetchedTemplate.techStack?.tools || [],
        },
        pricing: {
          basePrice: fetchedTemplate.pricing?.basePrice || 0,
          discount: fetchedTemplate.pricing?.discount || 0,
        },
        additionalServices: fetchedTemplate.additionalServices || [],
        workflow: fetchedTemplate.workflow || [],
        paymentMilestones: fetchedTemplate.paymentMilestones || [],
      });
    }
  }, [fetchedTemplate]);

  const handleSave = async () => {
    if (!data.name.trim()) {
      return toast.error("Template name is required");
    }

    try {
      await updateTemplate({ id, ...data }).unwrap();
      toast.success("Template updated successfully!");
      router.push("/templates");
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to update template");
    }
  };

  if (isFetching) {
    return (
      <div className="w-full h-screen flex items-center justify-center text-muted-foreground/60">
        Loading template profile...
      </div>
    );
  }

  return (
    <TemplateBuilder
      data={data}
      onChange={setData}
      onSave={handleSave}
      isSaving={isUpdating}
      pageTitle="Edit Template"
    />
  );
}
