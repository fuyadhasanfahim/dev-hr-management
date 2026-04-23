"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import {
  useGetServicesQuery,
  useCreateServiceMutation,
  useUpdateServiceMutation,
  useDeleteServiceMutation,
  useLazyCheckServiceUsageQuery,
} from "@/redux/features/service/serviceApi";
import { toast } from "sonner";
import { IService } from "@/types/order.type";

import { ServiceStatsCards } from "@/components/service/ServiceStatsCards";
import { ServiceFilters } from "@/components/service/ServiceFilters";
import { ServiceTable } from "@/components/service/ServiceTable";
import { ServicePagination } from "@/components/service/ServicePagination";
import { ServiceForm, ServiceFormValues } from "@/components/service/ServiceForm";
import { useDebounce } from "@/hooks/use-debounce";

export default function ServicesPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pricingFilter, setPricingFilter] = useState("all");

  const debouncedSearch = useDebounce(search, 500);

  // Determine isActive query param
  const isActiveParam = statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined;

  // Services Queries
  const {
    data: servicesData,
    isLoading,
    isFetching,
  } = useGetServicesQuery({
    page,
    limit,
    search: debouncedSearch,
    ...(isActiveParam !== undefined && { isActive: isActiveParam }),
  });

  const [createService, { isLoading: isCreating }] = useCreateServiceMutation();
  const [updateService, { isLoading: isUpdating }] = useUpdateServiceMutation();
  const [deleteService, { isLoading: isDeleting }] = useDeleteServiceMutation();
  const [checkUsage] = useLazyCheckServiceUsageQuery();

  // Dialog States
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isMigrationDialogOpen, setIsMigrationDialogOpen] = useState(false);
  
  const [selectedService, setSelectedService] = useState<(IService & { usageCount: number }) | null>(null);
  const [migrationTargetId, setMigrationTargetId] = useState("");

  const handleOpenAdd = useCallback(() => {
    setSelectedService(null);
    setIsAddEditDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((service: IService & { usageCount: number }) => {
    setSelectedService(service);
    setIsAddEditDialogOpen(true);
  }, []);

  const handleDeleteClick = useCallback(async (service: IService & { usageCount: number }) => {
    setSelectedService(service);
    try {
      const usageCheck = await checkUsage(service._id).unwrap();
      if (usageCheck.data.hasUsage) {
        setIsMigrationDialogOpen(true);
      } else {
        setIsDeleteAlertOpen(true);
      }
    } catch (error) {
      toast.error((error as Error).message || "Failed to check service usage");
    }
  }, [checkUsage]);

  const handleToggleStatus = async (service: IService) => {
    try {
      await updateService({
        id: service._id,
        data: { isActive: !service.isActive },
      }).unwrap();
      toast.success(`Service ${!service.isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      toast.error((error as Error).message || "Failed to update service status");
    }
  };

  const handleFormSubmit = async (data: ServiceFormValues) => {
    try {
      if (selectedService) {
        await updateService({
          id: selectedService._id,
          data,
        }).unwrap();
        toast.success("Service updated successfully");
      } else {
        await createService(data).unwrap();
        toast.success("Service created successfully");
      }
      setIsAddEditDialogOpen(false);
    } catch (error) {
      toast.error((error as Error).message || "Something went wrong");
    }
  };

  const confirmDelete = async () => {
    if (!selectedService) return;
    try {
      await deleteService({ id: selectedService._id }).unwrap();
      toast.success("Service deleted successfully");
      setIsDeleteAlertOpen(false);
    } catch (error) {
      toast.error((error as Error).message || "Failed to delete service");
    }
  };

  const handleMigrateAndDelete = async () => {
    if (!selectedService || !migrationTargetId) {
      toast.error("Please select a target service for migration");
      return;
    }
    try {
      await deleteService({
        id: selectedService._id,
        migrationId: migrationTargetId,
      }).unwrap();
      toast.success("Service migrated and deleted successfully");
      setIsMigrationDialogOpen(false);
      setMigrationTargetId("");
    } catch (error) {
      toast.error((error as Error).message || "Migration and deletion failed");
    }
  };

  // Frontend filtering for pricingModel until backend fully supports it via query
  const rawServices = useMemo(() => servicesData?.data || [], [servicesData]);
  const services = useMemo(() => {
    let filtered = [...rawServices];
    if (pricingFilter !== 'all') {
      filtered = filtered.filter(s => s.pricingModel === pricingFilter || (!s.pricingModel && pricingFilter === 'fixed'));
    }
    return filtered;
  }, [rawServices, pricingFilter]);

  const meta = servicesData?.meta || { total: 0 };
  const totalPages = Math.ceil(meta.total / limit);

  return (
    <div className="w-full space-y-8 bg-slate-50/50 min-h-screen">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Services</h1>
          <p className="text-slate-500 mt-1">
            Manage your services and pricing
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="bg-white"
            onClick={() => toast.info('Export functionality coming soon')}
          >
            <FileDown className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button 
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={handleOpenAdd}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <ServiceStatsCards services={rawServices} total={meta.total} />

      {/* Main Content Card */}
      <Card className="border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 md:p-6 border-b border-slate-100 bg-white">
          <ServiceFilters 
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            pricingFilter={pricingFilter}
            setPricingFilter={setPricingFilter}
            limit={limit}
            setLimit={setLimit}
          />
        </div>

        {/* Table */}
        <ServiceTable 
          data={services} 
          isLoading={isLoading || isFetching} 
          onEdit={handleOpenEdit} 
          onDelete={handleDeleteClick} 
          onToggleStatus={handleToggleStatus}
        />

        {/* Footer Pagination */}
        {!isLoading && services.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
            <div className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-900">{services.length}</span> services
            </div>
            <ServicePagination 
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              isLoading={isLoading || isFetching}
            />
          </div>
        )}
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddEditDialogOpen} onOpenChange={setIsAddEditDialogOpen}>
        <DialogContent className="max-w-2xl h-[90vh] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0 bg-white">
          <div className="px-6 py-4 border-b border-slate-100 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-slate-900">
                {selectedService ? "Edit Service" : "Add New Service"}
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                {selectedService ? "Update service profile and pricing" : "Create a new service offering"}
              </DialogDescription>
            </DialogHeader>
          </div>
          <ServiceForm 
            defaultValues={selectedService || undefined}
            onSubmit={handleFormSubmit}
            isSubmitting={isCreating || isUpdating}
            submitLabel={selectedService ? "Save Changes" : "Create Service"}
            onCancel={() => setIsAddEditDialogOpen(false)}
            isEditMode={!!selectedService}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the 
              <span className="font-semibold text-slate-900"> {selectedService?.name} </span> 
              service.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Service
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Migration Dialog */}
      <Dialog open={isMigrationDialogOpen} onOpenChange={setIsMigrationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Migration Required</DialogTitle>
            <DialogDescription>
              This service is currently used in existing orders. Please select a replacement service to migrate those orders to before deleting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Target Service</Label>
              <Select value={migrationTargetId} onValueChange={setMigrationTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target service..." />
                </SelectTrigger>
                <SelectContent>
                  {rawServices
                    .filter((s) => s._id !== selectedService?._id && s.isActive)
                    .map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMigrationDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!migrationTargetId || isDeleting}
              onClick={handleMigrateAndDelete}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              Migrate & Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
