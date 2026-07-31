"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
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
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Loader,
  FileDown,
  Users,
  Eye,
  Edit2,
  CheckCircle2,
  TrendingUp,
  Clock,
} from "lucide-react";
import { subDays, isAfter } from "date-fns";
import { toast } from "sonner";
import {
  ClientForm,
  type ClientFormData,
} from "@/components/client/ClientForm";
import { TableContent } from "@/components/shared/table-content";
import { Client } from "@/types/client.type";

export default function ClientsPage() {
  const { data: user } = useGetMeQuery({});
  const isTelemarketer = user?.role === "telemarketer";

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editDefaultValues, setEditDefaultValues] = useState<
    ClientFormData | undefined
  >(undefined);

  // Queries - fetch all for client-side table rendering (matching earnings page)
  const {
    data: clientsData,
    isLoading,
    isFetching,
  } = useGetClientsQuery({
    limit: 1000,
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

  // State for pure rendering of date-based stats
  const [thirtyDaysAgo] = useState(() => subDays(new Date(), 30));

  const stats = useMemo(() => {
    return {
      total: clients.length,
      active: clients.filter((c: Client) => c.status === "active").length,
      inactive: clients.filter((c: Client) => c.status === "inactive").length,
      newClients: clients.filter((c: Client) => {
        return c.createdAt ? isAfter(new Date(c.createdAt), thirtyDaysAgo) : false;
      }).length,
    };
  }, [clients, thirtyDaysAgo]);

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
      assignedTelemarketer: typeof client.assignedTelemarketer === 'object' ? client.assignedTelemarketer._id : client.assignedTelemarketer || "",
    });
    setIsEditDialogOpen(true);
  };

  const statusFilterOptions = [
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
  ];

  const columns = useMemo<ColumnDef<Client, any>[]>(
    () => [
      {
        id: "clientId",
        header: "Client ID",
        accessorFn: (row) => row.clientId,
        cell: ({ row }) => (
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {row.original.clientId || "-"}
          </span>
        ),
      },
      {
        id: "name",
        header: "Name",
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {row.original.name}
          </span>
        ),
      },
      {
        id: "email",
        header: "Email",
        accessorFn: (row) => row.emails?.[0] || "",
        cell: ({ row }) => {
          const client = row.original;
          return (
            <div className="flex items-center gap-2">
              <span className="truncate max-w-[150px] text-slate-600 dark:text-slate-300">
                {client.emails?.[0] || "-"}
              </span>
              {client.emails && client.emails.length > 1 && (
                <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                  +{client.emails.length - 1}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: "phone",
        header: "Phone",
        accessorFn: (row) => row.phone,
        cell: ({ row }) => (
          <span className="text-slate-600 dark:text-slate-300">
            {row.original.phone || "-"}
          </span>
        ),
      },
      {
        id: "telemarketer",
        header: "Assigned TM",
        accessorFn: (row) => typeof row.assignedTelemarketer === 'object' ? row.assignedTelemarketer?.name : "-",
        cell: ({ row }) => {
          const tm = typeof row.original.assignedTelemarketer === 'object' ? row.original.assignedTelemarketer : null;
          return tm?.name ? (
            <Badge variant="outline" className="bg-teal-50/50 text-teal-700 border-teal-200/80 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-900/50">
              {tm.name}
            </Badge>
          ) : (
            <span className="text-slate-400 text-xs">-</span>
          );
        },
      },
      {
        id: "teamMembers",
        header: () => <div className="text-center">Team Members</div>,
        accessorFn: (row) => row.teamMembers?.length || 0,
        cell: ({ row }) => {
          const client = row.original;
          return (
            <div className="flex justify-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 cursor-default hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded-md transition-colors text-slate-600 dark:text-slate-300">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span className="font-semibold text-sm">
                      {client.teamMembers?.length || 0}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="p-3 min-w-[150px] shadow-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  {client.teamMembers && client.teamMembers.length > 0 ? (
                    <div className="space-y-2">
                      <ul className="space-y-1.5">
                        {client.teamMembers.map((member, idx) => (
                          <li key={idx} className="flex flex-col">
                            <span className="font-medium text-sm">
                              {idx + 1}. {member.name}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">No team members assigned</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </div>
          );
        },
      },
      {
        id: "status",
        header: () => <div className="text-center">Status</div>,
        accessorFn: (row) => row.status,
        cell: ({ row }) => {
          const isActive = row.original.status === "active";
          return (
            <div className="flex justify-center">
              <Badge 
                variant="outline" 
                className={isActive 
                  ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/50 text-[11px] font-semibold px-2.5 py-0.5" 
                  : "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/50 text-[11px] font-semibold px-2.5 py-0.5"
                }
              >
                {isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const client = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100" asChild>
                <Link href={`/clients/${client._id}`}>
                  <Eye className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400"
                onClick={() => openEditDialog(client)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600/10 text-teal-600 ring-1 ring-teal-600/20">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
              Clients
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5 flex items-center gap-2">
              Manage your client relationships and teams.
              {isFetching && (
                <Loader className="h-3 w-3 animate-spin text-teal-600" />
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total Clients",
            value: stats.total,
            icon: <Users className="h-5 w-5 text-teal-600" />,
            color: "text-teal-600 bg-teal-50 dark:bg-teal-950/20",
          },
          {
            label: "Active Clients",
            value: stats.active,
            icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20",
          },
          {
            label: "Inactive Clients",
            value: stats.inactive,
            icon: <Clock className="h-5 w-5 text-amber-600" />,
            color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20",
          },
          {
            label: "New This Month",
            value: stats.newClients,
            icon: <TrendingUp className="h-5 w-5 text-[#4E12D4]" />,
            color: "text-[#4E12D4] bg-[#4E12D4]/10",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="rounded-3xl border border-slate-200/60 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-5 transition-all duration-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}>
                {stat.icon}
              </div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
            <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <TableContent
        data={clients}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Search by name, email, or client ID..."
        statusFilterKey="status"
        statusOptions={statusFilterOptions}
        actionHeader={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="bg-white dark:bg-slate-900"
              onClick={() => toast.info("Export feature coming soon")}
            >
              <FileDown className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Client
            </Button>
          </div>
        }
      />

      {/* Add Client Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-4xl h-[95vh] max-h-[95vh] flex flex-col p-0 overflow-hidden gap-0 bg-white dark:bg-slate-900 border shadow-2xl">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">Add New Client</DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                Create a new client profile with contact and team details.
              </DialogDescription>
            </DialogHeader>
          </div>
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
        <DialogContent className="max-w-4xl h-[95vh] max-h-[95vh] flex flex-col p-0 overflow-hidden gap-0 bg-white dark:bg-slate-900 border shadow-2xl">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">Edit Client</DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                Update client profile and team information.
              </DialogDescription>
            </DialogHeader>
          </div>
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
