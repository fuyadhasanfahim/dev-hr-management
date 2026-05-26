"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateQuotationTemplateMutation } from "@/redux/features/quotation/quotationApi";
import TemplateBuilder, { TemplateData } from "@/components/template/TemplateBuilder";
import { toast } from "sonner";

export default function NewTemplatePage() {
  const router = useRouter();
  const [createTemplate, { isLoading: isCreating }] = useCreateQuotationTemplateMutation();

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

  const handleSave = async () => {
    if (!data.name.trim()) {
      return toast.error("Template name is required");
    }

    try {
      await createTemplate(data).unwrap();
      toast.success("Template created successfully!");
      router.push("/templates");
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to create template");
    }
  };

  return (
    <TemplateBuilder
      data={data}
      onChange={setData}
      onSave={handleSave}
      isSaving={isCreating}
      pageTitle="Create New Template"
    />
  );
}
