"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  useGetLeadsQuery,
  useCreateLeadMutation,
  useUpdateLeadMutation,
} from "@/redux/features/lead/leadApi";
import { useGetLeadSettingsQuery } from "@/redux/features/lead/leadSettingApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Loader, FileDown, Settings } from "lucide-react";
import { toast } from "sonner";
import { LeadForm, type LeadFormValues } from "@/components/lead/LeadForm";
import { LeadSettingsDialog } from "@/components/lead/LeadSettingsDialog";
import { LeadStats } from "@/components/lead/LeadStats";
import { LeadFilters } from "@/components/lead/LeadFilters";
import { LeadTable } from "@/components/lead/LeadTable";
import { LeadPagination } from "@/components/lead/LeadPagination";
import { Lead } from "@/types/lead.type";

export default function LeadsPage() {
  const router = useRouter();

  // Filter states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [source, setSource] = useState("");

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Queries
  const { data: settingsData } = useGetLeadSettingsQuery(undefined);
  const statuses = useMemo(
    () => settingsData?.data?.filter((s: any) => s.type === "STATUS") || [],
    [settingsData]
  );
  const sources = useMemo(
    () => settingsData?.data?.filter((s: any) => s.type === "SOURCE") || [],
    [settingsData]
  );

  const {
    data: leadsData,
    isLoading,
    isFetching,
  } = useGetLeadsQuery({
    page,
    limit,
    search: search || undefined,
    status: status || undefined,
    priority: priority || undefined,
    source: source || undefined,
  });

  const [createLead, { isLoading: isCreating }] = useCreateLeadMutation();
  const [updateLead, { isLoading: isUpdating }] = useUpdateLeadMutation();

  const [serverErrors, setServerErrors] = useState<Record<string, string[]> | undefined>();

  const leads = useMemo(() => leadsData?.data?.leads || [], [leadsData]);
  const pagination = leadsData?.data || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };

  const stats = useMemo(() => {
    return {
      total: pagination.total,
      highPriority: leads.filter((l: Lead) => l.priority === "High").length,
      converted: leads.filter((l: Lead) => l.isConverted).length,
      active: leads.filter((l: Lead) => !l.isConverted).length,
    };
  }, [leads, pagination.total]);

  const handleFilterChange = (key: string, value: string | number) => {
    if (key === "search") setSearch(value as string);
    if (key === "status") setStatus(value as string);
    if (key === "priority") setPriority(value as string);
    if (key === "source") setSource(value as string);
    if (key === "limit") setLimit(value as number);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatus("");
    setPriority("");
    setSource("");
    setLimit(20);
    setPage(1);
  };

  const handleAddLead = async (data: LeadFormValues) => {
    try {
      setServerErrors(undefined);
      await createLead(data).unwrap();
      toast.success("Lead created successfully");
      setIsAddDialogOpen(false);
    } catch (error: any) {
      setServerErrors(error?.data?.errors || error?.errors);
      toast.error(error?.data?.message || "Failed to create lead");
    }
  };

  const handleUpdateLead = async (data: LeadFormValues) => {
    if (!selectedLead) return;
    try {
      setServerErrors(undefined);
      await updateLead({ id: selectedLead._id, data }).unwrap();
      toast.success("Lead updated successfully");
      setIsEditDialogOpen(false);
    } catch (error: any) {
      setServerErrors(error?.data?.errors || error?.errors);
      toast.error(error?.data?.message || "Failed to update lead");
    }
  };

  const openEditDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setServerErrors(undefined);
    setIsEditDialogOpen(true);
  };

  const handleViewLead = (lead: Lead) => {
    router.push(`/leads/${lead._id}`);
  };

  return (
    <div className="w-full space-y-8 bg-slate-50/50 min-h-screen pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Leads
          </h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
            Manage your leads and prospects pipeline
            {isFetching && (
              <Loader className="h-3 w-3 animate-spin text-teal-600" />
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="bg-white"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings className="h-4 w-4 text-slate-500" />
            Settings
          </Button>
          <Button
            variant="outline"
            className="bg-white"
            onClick={() => toast.info("Export feature coming soon")}
          >
            <FileDown className="h-4 w-4 text-slate-500" />
            Export
          </Button>
          <Button
            onClick={() => {
              setServerErrors(undefined);
              setIsAddDialogOpen(true);
            }}
            className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Lead
          </Button>
        </div>
      </div>

      <LeadStats
        total={stats.total}
        highPriority={stats.highPriority}
        converted={stats.converted}
        active={stats.active}
        isLoading={isLoading}
      />

      <Card className="border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-100">
          <LeadFilters
            search={search}
            status={status}
            priority={priority}
            source={source}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            statuses={statuses}
            sources={sources}
          />
        </div>

        <LeadTable
          leads={leads}
          isLoading={isLoading}
          onEdit={openEditDialog}
          onView={handleViewLead}
        />

        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-500">
            Showing <span className="font-medium text-slate-900">{leads.length}</span> of <span className="font-medium text-slate-900">{pagination.total}</span> leads
          </div>
          <LeadPagination
            currentPage={page}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </div>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-3xl h-[90vh] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0 bg-white">
          <div className="px-6 py-4 border-b border-slate-100 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-slate-900">
                Add New Lead
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                Create a new prospect to begin tracking their journey.
              </DialogDescription>
            </DialogHeader>
          </div>
          <LeadForm
            onSubmit={handleAddLead}
            isSubmitting={isCreating}
            submitLabel="Create Lead"
            onCancel={() => setIsAddDialogOpen(false)}
            serverErrors={serverErrors}
            statuses={statuses}
            sources={sources}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl h-[90vh] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0 bg-white">
          <div className="px-6 py-4 border-b border-slate-100 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-slate-900">
                Edit Lead
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                Update the prospect's basic information and pipeline status.
              </DialogDescription>
            </DialogHeader>
          </div>
          {selectedLead && (
            <LeadForm
              key={selectedLead._id}
              defaultValues={{
                name: selectedLead.name,
                phone: selectedLead.phone,
                email: selectedLead.email,
                website: selectedLead.website,
                status: selectedLead.status?._id,
                priority: selectedLead.priority,
                source: selectedLead.source?._id,
                currentNotes: selectedLead.currentNotes,
              }}
              onSubmit={handleUpdateLead}
              isSubmitting={isUpdating}
              submitLabel="Save Changes"
              onCancel={() => setIsEditDialogOpen(false)}
              serverErrors={serverErrors}
              isEditMode
              statuses={statuses}
              sources={sources}
            />
          )}
        </DialogContent>
      </Dialog>

      <LeadSettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </div>
  );
}
