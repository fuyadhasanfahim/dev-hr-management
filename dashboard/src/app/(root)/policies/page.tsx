"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  useGetPoliciesQuery,
  useCreatePolicyMutation,
  useUpdatePolicyMutation,
  useTogglePolicyStatusMutation,
  useDeletePolicyMutation,
} from "@/redux/features/policy/policyApi";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { PolicyForm } from "@/components/policy/PolicyForm";
import { PolicyFilters } from "@/components/policy/PolicyFilters";
import { PolicyTable } from "@/components/policy/PolicyTable";
import { PolicyPagination } from "@/components/policy/PolicyPagination";
import { useSession } from "@/lib/auth-client";
import { Role } from "@/constants/role";
import { CreatePolicyData, IPolicy } from "@/types/policy.type";

export default function PoliciesPage() {
  const { data: session } = useSession();
  const isAdmin = useMemo(() => {
    return [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER].includes(
      session?.user?.role as Role,
    );
  }, [session]);

  const { data, isLoading } = useGetPoliciesQuery();
  const [createPolicy, { isLoading: isCreating }] = useCreatePolicyMutation();
  const [updatePolicy, { isLoading: isUpdating }] = useUpdatePolicyMutation();
  const [toggleStatus, { isLoading: isToggling }] =
    useTogglePolicyStatusMutation();
  const [deletePolicy] = useDeletePolicyMutation();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<IPolicy | null>(null);
  const [viewingPolicy, setViewingPolicy] = useState<IPolicy | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const policies = useMemo(() => data?.policies || [], [data]);

  const filteredPolicies = useMemo(() => {
    return policies.filter((p) => {
      if (isAdmin && statusFilter) {
        const isActive = statusFilter === "active";
        if (p.isActive !== isActive) return false;
      }
      if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [policies, search, statusFilter, isAdmin]);

  const totalPages = Math.max(1, Math.ceil(filteredPolicies.length / limit));
  const pagedPolicies = useMemo(
    () => filteredPolicies.slice((page - 1) * limit, page * limit),
    [filteredPolicies, page, limit],
  );

  const handleFilterChange = (key: string, value: string) => {
    if (key === "search") setSearch(value);
    if (key === "status") setStatusFilter(value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPage(1);
  };

  const handleCreate = async (formData: CreatePolicyData) => {
    try {
      await createPolicy(formData).unwrap();
      toast.success("Policy created successfully");
      setIsCreateOpen(false);
    } catch (error) {
      toast.error("Failed to create policy");
      console.error(error);
    }
  };

  const handleUpdate = async (formData: CreatePolicyData) => {
    if (!editingPolicy) return;
    try {
      await updatePolicy({ id: editingPolicy._id, data: formData }).unwrap();
      toast.success("Policy updated successfully");
      setEditingPolicy(null);
    } catch (error) {
      toast.error("Failed to update policy");
      console.error(error);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await toggleStatus({ id, data: { isActive: !currentStatus } }).unwrap();
      toast.success(`Policy ${!currentStatus ? "activated" : "deactivated"}`);
    } catch (error) {
      toast.error("Failed to update status");
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePolicy(id).unwrap();
      toast.success("Policy deleted successfully");
    } catch (error) {
      toast.error("Failed to delete policy");
      console.error(error);
    }
  };

  const policyStats = useMemo(() => {
    const total = policies.length;
    const active = policies.filter((p) => p.isActive).length;
    const requiresAcceptance = policies.filter((p) => p.requiresAcceptance).length;

    return [
      {
        description: "Total Policies",
        value: total,
        trend: "up" as const,
        trendLabel: "All",
        footerTitle: "All policies defined",
      },
      {
        description: "Active",
        value: active,
        trend: "up" as const,
        trendLabel: "Active",
        footerTitle: "Currently in effect",
      },
      {
        description: "Requires Acceptance",
        value: requiresAcceptance,
        trend: "down" as const,
        trendLabel: "Required",
        footerTitle: "Employees must acknowledge",
      },
    ];
  }, [policies]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="w-full min-h-screen pb-10"
    >
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Organization Policies
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            View and manage company-wide or targeted policies and track acceptance
            {isLoading && (
              <Loader className="h-3 w-3 animate-spin text-primary" />
            )}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8">
                <Plus className="h-3.5 w-3.5" />
                Create Policy
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Policy</DialogTitle>
                <DialogDescription>
                  Define a new policy and target it to specific branches or
                  departments.
                </DialogDescription>
              </DialogHeader>
              <PolicyForm onSubmit={handleCreate} isLoading={isCreating} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* ── Stats Strip ──────────────────────────────────────────── */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:grid-cols-3">
        {policyStats.map((stat) => {
          const TrendIcon = stat.trend === "up" ? TrendingUp : TrendingDown;
          return (
            <Card key={stat.description} className="@container/card">
              <CardHeader>
                <CardDescription>{stat.description}</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {stat.value}
                </CardTitle>
                <CardAction>
                  <Badge variant="outline" className="text-primary border-primary/30">
                    <TrendIcon className="text-primary" />
                    {stat.trendLabel}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1.5 text-sm">
                <div className="line-clamp-1 flex gap-2 font-medium">
                  {stat.footerTitle}
                  <TrendIcon className="size-4 text-primary" />
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* ── Filters Card ─────────────────────────────────────────── */}
      <Card className="mt-5 py-0 shadow-sm">
        <div className="px-5 py-4">
          <PolicyFilters
            search={search}
            status={statusFilter}
            showStatusFilter={isAdmin}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
          />
        </div>
      </Card>

      {/* ── Table Card ───────────────────────────────────────────── */}
      <Card className="mt-4 py-0 gap-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <PolicyTable
            policies={pagedPolicies}
            isLoading={isLoading}
            isAdmin={isAdmin}
            isToggling={isToggling}
            onView={setViewingPolicy}
            onEdit={setEditingPolicy}
            onDelete={handleDelete}
            onToggleStatus={handleToggleStatus}
          />
        </div>

        <Separator />

        {/* Footer: Count + Pagination */}
        <CardContent className="flex items-center justify-between gap-4 px-5 py-3">
          <p className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            Showing{" "}
            <span className="mx-1 font-medium text-foreground/80">
              {pagedPolicies.length}
            </span>{" "}
            of{" "}
            <span className="mx-1 font-medium text-foreground/80">
              {filteredPolicies.length}
            </span>{" "}
            policies
          </p>
          <PolicyPagination
            currentPage={page}
            totalPages={totalPages}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingPolicy}
        onOpenChange={(open) => !open && setEditingPolicy(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Policy</DialogTitle>
          </DialogHeader>
          {editingPolicy && (
            <PolicyForm
              initialData={editingPolicy}
              onSubmit={handleUpdate}
              isLoading={isUpdating}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog
        open={!!viewingPolicy}
        onOpenChange={(open) => !open && setViewingPolicy(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {viewingPolicy?.title}
            </DialogTitle>
            <DialogDescription>
              Published on{" "}
              {viewingPolicy && format(new Date(viewingPolicy.createdAt), "PPP")}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 prose prose-slate dark:prose-invert max-w-none">
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">
              {viewingPolicy?.description}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
