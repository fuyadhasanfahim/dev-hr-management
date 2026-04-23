"use client";

import { useState, useMemo } from "react";
import {
  useGetClientsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
} from "@/redux/features/client/clientApi";
import { useGetMeQuery } from "@/redux/features/staff/staffApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Plus,
  Loader,
  FileDown,
} from "lucide-react";
import { subDays, isAfter } from "date-fns";
import { toast } from "sonner";
import {
  ClientForm,
  type ClientFormData,
} from "@/components/client/ClientForm";
import { ClientStats } from "@/components/client/ClientStats";
import { ClientFilters } from "@/components/client/ClientFilters";
import { ClientTable } from "@/components/client/ClientTable";
import { ClientPagination } from "@/components/client/ClientPagination";
import { Client } from "@/types/client.type";

export default function ClientsPage() {
  const { data: user } = useGetMeQuery({});
  const isTelemarketer = user?.role === "telemarketer";

  // Filter states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20); // Default 20 as per plan
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editDefaultValues, setEditDefaultValues] = useState<
    ClientFormData | undefined
  >(undefined);

  // Queries
  const {
    data: clientsData,
    isLoading,
    isFetching,
  } = useGetClientsQuery({
    page,
    limit,
    search: search || undefined,
    status: status || undefined,
  });

  const [createClient, { isLoading: isCreating }] = useCreateClientMutation();
  const [updateClient, { isLoading: isUpdating }] = useUpdateClientMutation();

  const [addServerErrors, setAddServerErrors] = useState<
    Record<string, string[]> | undefined
  >(undefined);
  const [updateServerErrors, setUpdateServerErrors] = useState<
    Record<string, string[]> | undefined
  >(undefined);

  const clients = useMemo(
    () => clientsData?.clients || [],
    [clientsData?.clients],
  );
  const pagination = clientsData?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  };

  // State for pure rendering of date-based stats
  const [thirtyDaysAgo] = useState(() => subDays(new Date(), 30));

  const stats = useMemo(() => {
    return {
      total: pagination.total,
      active: clients.filter((c: Client) => c.status === "active").length,
      inactive: clients.filter((c: Client) => c.status === "inactive").length,
      newClients: clients.filter((c: Client) => {
        // Mock new clients calculation based on created date if available, or just 0
        const isNew = c.createdAt
          ? isAfter(new Date(c.createdAt), thirtyDaysAgo)
          : false;
        return isNew;
      }).length,
    };
  }, [clients, pagination.total, thirtyDaysAgo]);

  const handleFilterChange = (key: string, value: string | number) => {
    if (key === "search") setSearch(value as string);
    if (key === "status") setStatus(value as string);
    if (key === "limit") setLimit(value as number);
    setPage(1); // Reset to page 1 on filter change
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatus("");
    setLimit(20);
    setPage(1);
  };

  const handleAddClient = async (data: ClientFormData) => {
    try {
      setAddServerErrors(undefined);
      await createClient(data).unwrap();
      toast.success("Client created successfully");
      setIsAddDialogOpen(false);
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      setAddServerErrors(err?.data?.errors || err?.errors);
      toast.error(err?.data?.message || "Failed to create client");
    }
  };

  const handleUpdateClient = async (data: ClientFormData) => {
    if (!selectedClient) return;
    try {
      setUpdateServerErrors(undefined);
      await updateClient({ id: selectedClient._id, ...data }).unwrap();
      toast.success("Client updated successfully");
      setIsEditDialogOpen(false);
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      setUpdateServerErrors(err?.data?.errors || err?.errors);
      toast.error(err?.data?.message || "Failed to update client");
    }
  };

  const openEditDialog = (client: Client) => {
    setSelectedClient(client);
    setUpdateServerErrors(undefined);
    setEditDefaultValues({
      clientId: client.clientId,
      name: client.name,
      emails: client.emails,
      phone: client.phone || "",
      address: client.address || "",
      officeAddress: client.officeAddress || "",
      description: client.description || "",
      currency: client.currency || "",
      status: client.status,
      teamMembers: client.teamMembers || [],
      assignedServices: client.assignedServices || [],
    });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="w-full p-4 md:p-6 space-y-8 bg-slate-50/50 min-h-screen">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Clients
          </h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
            Manage your client relationships
            {isFetching && (
              <Loader className="h-3 w-3 animate-spin text-teal-600" />
            )}
          </p>
        </div>
        {!isTelemarketer && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="bg-white"
              onClick={() => toast.info("Export feature coming soon")}
            >
              <FileDown className="h-4 w-4 text-slate-500" />
              Export
            </Button>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
            >
              <Plus className="h-4 w-4" /> Add Client
            </Button>
          </div>
        )}
      </div>

      {/* Stats section */}
      <ClientStats
        total={stats.total}
        active={stats.active}
        inactive={stats.inactive}
        newClients={stats.newClients}
        isLoading={isLoading}
      />

      {/* Main Table Card wrapper */}
      <Card className="border-slate-200 bg-white">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100">
          <ClientFilters
            search={search}
            status={status}
            limit={limit}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
          />
        </div>

        {/* Table section */}
        <ClientTable
          clients={clients}
          isLoading={isLoading}
          isTelemarketer={isTelemarketer}
          onEdit={openEditDialog}
        />

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-500">
            Showing{" "}
            <span className="font-medium text-slate-900">{clients.length}</span>{" "}
            of{" "}
            <span className="font-medium text-slate-900">
              {pagination.total}
            </span>{" "}
            clients
          </div>
          <ClientPagination
            currentPage={page}
            totalPages={pagination.pages}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </div>
      </Card>

      {/* Add Client Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>
              Create a new client profile with contact and team details.
            </DialogDescription>
          </DialogHeader>
          <ClientForm
            onSubmit={handleAddClient}
            isSubmitting={isCreating}
            submitLabel="Create Client"
            onCancel={() => setIsAddDialogOpen(false)}
            serverErrors={addServerErrors}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Update client profile and team information.
            </DialogDescription>
          </DialogHeader>
          {editDefaultValues && (
            <ClientForm
              key={selectedClient?._id}
              defaultValues={editDefaultValues}
              onSubmit={handleUpdateClient}
              isSubmitting={isUpdating}
              submitLabel="Save Changes"
              onCancel={() => setIsEditDialogOpen(false)}
              serverErrors={updateServerErrors}
              isEditMode
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
