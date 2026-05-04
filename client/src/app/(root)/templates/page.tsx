"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Eye, Edit, Trash2, Layout, Calendar, Briefcase, DollarSign } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useGetQuotationTemplatesQuery, useDeleteQuotationTemplateMutation } from "@/redux/features/quotation/quotationApi";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatMoney } from "@/lib/money";

export default function TemplatesPage() {
  const [search, setSearch] = useState("");
  const { data: templates, isLoading, isFetching } = useGetQuotationTemplatesQuery();
  const [deleteTemplate, { isLoading: isDeleting }] = useDeleteQuotationTemplateMutation();

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const filteredTemplates = templates?.filter((t: any) =>
    t.name?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleDeleteClick = (id: string) => {
    setSelectedTemplateId(id);
    setIsDeleteAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedTemplateId) return;
    try {
      await deleteTemplate(selectedTemplateId).unwrap();
      toast.success("Template deleted successfully");
      setIsDeleteAlertOpen(false);
      setSelectedTemplateId(null);
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to delete template");
    }
  };

  // Compute stats
  const totalTemplates = templates?.length || 0;
  const avgPrice =
    templates && templates.length > 0
      ? templates.reduce((acc: number, cur: any) => acc + (cur.pricing?.basePrice || 0), 0) / templates.length
      : 0;
  const totalPhases =
    templates && templates.length > 0
      ? templates.reduce((acc: number, cur: any) => acc + (cur.phases?.length || 0), 0)
      : 0;

  return (
    <div className="w-full space-y-8 p-6 bg-slate-50/40 min-h-screen">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Layout className="w-8 h-8 text-teal-600" />
            <span>Quotation Templates</span>
          </h1>
          <p className="text-slate-500 mt-1">
            Build and manage reusable quotation templates for easy dispatching
          </p>
        </div>
        <div>
          <Button
            asChild
            className="bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-2 shadow-md hover:shadow-lg transition duration-200"
          >
            <Link href="/templates/new">
              <Plus className="w-4 h-4" />
              <span>Create Template</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-teal-100 bg-white/60 shadow-sm border-l-4 border-l-teal-600">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Templates</CardTitle>
            <Layout className="w-5 h-5 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalTemplates}</div>
            <p className="text-xs text-muted-foreground mt-1">Templates saved in system</p>
          </CardContent>
        </Card>
        <Card className="border-orange-100 bg-white/60 shadow-sm border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Avg Template Price</CardTitle>
            <DollarSign className="w-5 h-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {formatMoney(avgPrice, "৳")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Base price average</p>
          </CardContent>
        </Card>
        <Card className="border-teal-100 bg-white/60 shadow-sm border-l-4 border-l-teal-600">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Phase Scope</CardTitle>
            <Briefcase className="w-5 h-5 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalPhases}</div>
            <p className="text-xs text-muted-foreground mt-1">Total phase breakdowns</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Card with consistent SaaS toolbar/table design */}
      <Card className="border-slate-200 bg-white shadow-md overflow-hidden flex flex-col rounded-xl">
        {/* Toolbar */}
        <div className="p-4 md:p-6 border-b border-slate-100 bg-white">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition duration-150"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Table */}
        <div className="overflow-x-auto">
          {isLoading || isFetching ? (
            <div className="p-12 text-center text-slate-400">Loading templates...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="p-12 text-center text-slate-400">No templates found.</div>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                  <th className="p-4">Name</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Phase Count</th>
                  <th className="p-4">Created By</th>
                  <th className="p-4">Created At</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTemplates.map((template: any) => (
                  <tr key={template._id} className="hover:bg-slate-50/50 transition duration-150 text-slate-700">
                    <td className="p-4 font-medium text-slate-900">{template.name || "Unnamed Template"}</td>
                    <td className="p-4 text-teal-700 font-semibold">
                      {formatMoney(template.pricing?.basePrice || 0, "৳")}
                    </td>
                    <td className="p-4">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-medium">
                        {template.phases?.length || 0} Phases
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">{template.createdBy?.name || "System Admin"}</td>
                    <td className="p-4 text-slate-500">
                      {template.createdAt ? format(new Date(template.createdAt), "MMM d, yyyy") : "N/A"}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 rounded-lg text-slate-600 hover:text-teal-600 hover:bg-teal-50"
                        >
                          <Link href={`/templates/details/${template._id}`}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 rounded-lg text-slate-600 hover:text-orange-600 hover:bg-orange-50"
                        >
                          <Link href={`/templates/edit/${template._id}`}>
                            <Edit className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteClick(template._id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Delete Alert with spinner / disabled buttons during deletion */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-slate-900">
              Delete Template?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              This action cannot be undone. This will permanently delete the template from your dynamic template selector.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="border-slate-200">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white font-medium flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
