"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useGetFinanceAnalyticsQuery } from "@/redux/features/analytics/analyticsApi";
import {
    useGetExpensesQuery,
    useGetExpenseStatsQuery,
    useCreateExpenseMutation,
    useUpdateExpenseMutation,
    useDeleteExpenseMutation,
    useGetExpenseCategoriesQuery,
    useCreateExpenseCategoryMutation,
    useGetExpenseYearsQuery,
    type Expense,
    type ExpenseQueryParams,
} from "@/redux/features/expense/expenseApi";
import { useGetAllBranchesQuery } from "@/redux/features/branch/branchApi";
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
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
import { Label } from "@/components/ui/label";
import {
    Loader,
    Plus,
    TrendingUp,
    TrendingDown,
    Download,
} from "lucide-react";
import { toast } from "sonner";
import {
    ExpenseForm,
    type ExpenseFormData,
} from "@/components/expense/ExpenseForm";
import { ExportExpenseDialog } from "@/components/expense/ExportExpenseDialog";
import { usePermissions } from "@/hooks/use-permissions";
import { ExpenseFilters, type FilterType } from "@/components/expense/ExpenseFilters";
import { ExpenseTable } from "@/components/expense/ExpenseTable";
import { ExpensePagination } from "@/components/expense/ExpensePagination";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
    { value: "pending", label: "Pending" },
    { value: "paid", label: "Paid" },
    { value: "partial_paid", label: "Partial Paid" },
];

const currentYear = new Date().getFullYear();

interface Branch {
    _id: string;
    name: string;
}

export default function ExpensePage() {
    const { can } = usePermissions();
    const canCreateExpense = can("expense.create");

    // Filter State
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState<FilterType>("all");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [branchFilter, setBranchFilter] = useState<string>("");
    const [selectedMonth, setSelectedMonth] = useState(
        new Date().getMonth() + 1,
    );
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

    // Dialog states
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(
        null,
    );
    const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] =
        useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

    // Default form values for edit
    const [editDefaultValues, setEditDefaultValues] = useState<
        ExpenseFormData | undefined
    >(undefined);

    // Construct Query Params
    const queryParams = useMemo<ExpenseQueryParams>(() => {
        const params: ExpenseQueryParams = {
            page,
            limit,
            sortOrder: "desc", // Default sort
        };

        if (search) params.search = search;
        if (statusFilter) params.status = statusFilter;
        if (branchFilter) params.branchId = branchFilter;

        switch (filterType) {
            case "today":
                params.filterType = "today";
                break;
            case "week":
                params.filterType = "week";
                break;
            case "month":
                params.filterType = "month";
                params.month = selectedMonth;
                params.year = selectedYear;
                break;
            case "year":
                params.filterType = "year";
                params.year = selectedYear;
                break;
            case "range":
                if (dateRange.from) {
                    params.filterType = "range";
                    params.startDate = format(dateRange.from, "yyyy-MM-dd");
                    if (dateRange.to) {
                        params.endDate = format(dateRange.to, "yyyy-MM-dd");
                    }
                }
                break;
        }

        return params;
    }, [
        page,
        limit,
        search,
        statusFilter,
        branchFilter,
        filterType,
        selectedMonth,
        selectedYear,
        dateRange,
    ]);

    // Queries
    const {
        data: expenseData,
        isLoading,
        isFetching,
    } = useGetExpensesQuery(queryParams);

    // For stats, pass filters if selected
    const statsParams = useMemo(() => {
        const params: { branchId?: string; year?: number; month?: number } = {};

        if (branchFilter) params.branchId = branchFilter;

        if (filterType === "month") {
            params.month = selectedMonth;
            params.year = selectedYear;
        } else if (filterType === "year") {
            params.year = selectedYear;
        }

        return params;
    }, [branchFilter, filterType, selectedMonth, selectedYear]);

    const { data: stats } = useGetExpenseStatsQuery(statsParams);

    const { data: categories } = useGetExpenseCategoriesQuery(undefined);
    const { data: branchesData } = useGetAllBranchesQuery(undefined);
    const { data: yearsData } = useGetExpenseYearsQuery(undefined);
    const years =
        yearsData && yearsData.length > 0
            ? yearsData
            : Array.from({ length: 5 }, (_, i) => currentYear - i);

    // Mutations
    const [createExpense, { isLoading: isCreating }] =
        useCreateExpenseMutation();
    const [updateExpense, { isLoading: isUpdating }] =
        useUpdateExpenseMutation();
    const [deleteExpense, { isLoading: isDeleting }] =
        useDeleteExpenseMutation();
    const [createCategory, { isLoading: isCreatingCategory }] =
        useCreateExpenseCategoryMutation();

    const expenses = expenseData?.expenses || [];
    const pagination = expenseData?.pagination;
    const branches: Branch[] = branchesData?.branches || [];

    const { data: financeData } = useGetFinanceAnalyticsQuery({ months: 1 });
    const finalAmount = financeData?.summary?.finalAmount || 0;

    const handleCreateExpense = async (data: ExpenseFormData) => {
        const expenseAmount = parseFloat(data.amount);

        if (expenseAmount > finalAmount) {
            toast.error("Insufficient balance. Expense exceeds available amount.");
            return;
        }

        try {
            await createExpense({
                ...data,
                amount: expenseAmount,
            }).unwrap();
            toast.success("Expense created successfully");
            setIsAddDialogOpen(false);
        } catch (error) {
            toast.error(
                (error as Error)?.message || "Failed to create expense",
            );
        }
    };

    const handleUpdateExpense = async (data: ExpenseFormData) => {
        if (!selectedExpense) return;

        const newExpenseAmount = parseFloat(data.amount);
        const oldExpenseAmount = selectedExpense.amount;
        const maxAllowed = finalAmount + oldExpenseAmount;

        if (newExpenseAmount > maxAllowed) {
            toast.error("Insufficient balance. Expense exceeds available amount.");
            return;
        }

        try {
            await updateExpense({
                id: selectedExpense._id,
                ...data,
                amount: newExpenseAmount,
            }).unwrap();
            toast.success("Expense updated successfully");
            setIsEditDialogOpen(false);
            setSelectedExpense(null);
        } catch (error) {
            toast.error(
                (error as Error)?.message || "Failed to update expense",
            );
        }
    };

    const handleMarkPending = async (expense: Expense) => {
        setSelectedExpense(expense);
        try {
            await updateExpense({
                id: expense._id,
                date: new Date(expense.date),
                title: expense.title,
                categoryId: expense.category?._id || "",
                branchId: expense.branch?._id || "",
                amount: expense.amount,
                status: "pending",
                note: expense.note || "",
            }).unwrap();
            toast.success("Expense marked as pending");
        } catch (error) {
            toast.error(
                (error as Error)?.message || "Failed to update expense",
            );
        }
    };

    const handleDeleteExpense = async () => {
        if (!selectedExpense) return;
        try {
            await deleteExpense(selectedExpense._id).unwrap();
            toast.success("Expense deleted successfully");
            setIsDeleteDialogOpen(false);
            setSelectedExpense(null);
        } catch (error) {
            toast.error(
                (error as Error)?.message || "Failed to delete expense",
            );
        }
    };

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) {
            toast.error("Category name is required");
            return;
        }
        try {
            await createCategory({ name: newCategoryName }).unwrap();
            toast.success("Category created successfully");
            setIsAddCategoryDialogOpen(false);
            setNewCategoryName("");
        } catch (error) {
            toast.error(
                (error as Error)?.message || "Failed to create category",
            );
        }
    };

    const openEditDialog = (expense: Expense) => {
        setSelectedExpense(expense);
        setEditDefaultValues({
            date: new Date(expense.date),
            title: expense.title,
            categoryId: expense.category?._id || "",
            branchId: expense.branch?._id || "",
            amount: expense.amount.toString(),
            status: expense.status,
            note: expense.note || "",
        });
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (expense: Expense) => {
        setSelectedExpense(expense);
        setIsDeleteDialogOpen(true);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "BDT",
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const handleClearFilters = () => {
        setSearch("");
        setFilterType("all");
        setStatusFilter("");
        setBranchFilter("");
        setDateRange({});
        setPage(1);
    };

    const expenseStats = useMemo(
        () => [
            {
                description: "Today's Expense",
                value: formatCurrency(stats?.today || 0),
                trend: "up" as const,
                trendLabel: "Today",
                footerTitle: "Spent today",
                isMoney: true,
            },
            {
                description: "This Month",
                value: formatCurrency(stats?.thisMonth || 0),
                trend: "up" as const,
                trendLabel: "Month",
                footerTitle: "Spent this month",
                isMoney: true,
            },
            {
                description: "This Year",
                value: formatCurrency(stats?.thisYear || 0),
                trend: "up" as const,
                trendLabel: "Year",
                footerTitle: "Spent this year",
                isMoney: true,
            },
            {
                description: "Avg Monthly",
                value: formatCurrency(stats?.avgMonthly || 0),
                trend: "up" as const,
                trendLabel: "Avg",
                footerTitle: "Average monthly spend",
                isMoney: true,
            },
        ],
        [stats],
    );

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
                        Expense Management
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
                        Track and manage company expenses
                        {(isLoading || isFetching) && (
                            <Loader className="h-3 w-3 animate-spin text-primary" />
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => setIsExportDialogOpen(true)}
                    >
                        <Download className="h-3.5 w-3.5" />
                        Export
                    </Button>
                    <ExportExpenseDialog
                        open={isExportDialogOpen}
                        onOpenChange={setIsExportDialogOpen}
                        availableYears={years}
                        branches={branches}
                    />
                    <Dialog
                        open={isAddDialogOpen && canCreateExpense}
                        onOpenChange={setIsAddDialogOpen}
                    >
                        {canCreateExpense && (
                            <DialogTrigger asChild>
                                <Button size="sm" className="h-8">
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Expense
                                </Button>
                            </DialogTrigger>
                        )}
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Add New Expense</DialogTitle>
                                <DialogDescription>
                                    Fill in the details to add a new expense
                                </DialogDescription>
                            </DialogHeader>
                            <ExpenseForm
                                onSubmit={handleCreateExpense}
                                isSubmitting={isCreating}
                                categories={categories}
                                branches={branches}
                                onAddCategory={() =>
                                    setIsAddCategoryDialogOpen(true)
                                }
                                submitLabel="Create"
                                onCancel={() => setIsAddDialogOpen(false)}
                            />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* ── Stats Strip ──────────────────────────────────────────── */}
            <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:grid-cols-4">
                {expenseStats.map((stat) => {
                    const TrendIcon = stat.trend === "up" ? TrendingUp : TrendingDown;
                    return (
                        <Card key={stat.description} className="@container/card">
                            <CardHeader>
                                <CardDescription>{stat.description}</CardDescription>
                                <CardTitle
                                    className={cn(
                                        "font-semibold tabular-nums whitespace-nowrap",
                                        stat.isMoney
                                            ? "text-lg @[250px]/card:text-xl"
                                            : "text-2xl @[250px]/card:text-3xl",
                                    )}
                                >
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
                    <ExpenseFilters
                        search={search}
                        status={statusFilter}
                        branchId={branchFilter}
                        filterType={filterType}
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        dateRange={dateRange}
                        years={years}
                        branches={branches}
                        statusOptions={STATUS_OPTIONS}
                        onSearchChange={(v) => {
                            setSearch(v);
                            setPage(1);
                        }}
                        onStatusChange={(v) => {
                            setStatusFilter(v);
                            setPage(1);
                        }}
                        onBranchChange={(v) => {
                            setBranchFilter(v);
                            setPage(1);
                        }}
                        onFilterTypeChange={(v) => {
                            setFilterType(v);
                            setPage(1);
                        }}
                        onMonthChange={setSelectedMonth}
                        onYearChange={setSelectedYear}
                        onDateRangeChange={setDateRange}
                        onClearFilters={handleClearFilters}
                    />
                </div>
            </Card>

            {/* ── Table Card ───────────────────────────────────────────── */}
            <Card className="mt-4 py-0 gap-0 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <ExpenseTable
                        expenses={expenses}
                        isLoading={isLoading}
                        formatCurrency={formatCurrency}
                        onEdit={openEditDialog}
                        onDelete={openDeleteDialog}
                        onMarkPending={handleMarkPending}
                    />
                </div>

                <Separator />

                {/* Footer: Count + Pagination */}
                <CardContent className="flex items-center justify-between gap-4 px-5 py-3">
                    <p className="hidden flex-1 text-sm text-muted-foreground lg:flex">
                        Showing{" "}
                        <span className="mx-1 font-medium text-foreground/80">
                            {expenses.length}
                        </span>{" "}
                        of{" "}
                        <span className="mx-1 font-medium text-foreground/80">
                            {pagination?.total ?? 0}
                        </span>{" "}
                        expenses
                    </p>
                    <ExpensePagination
                        currentPage={page}
                        totalPages={pagination?.pages ?? 1}
                        limit={limit}
                        onPageChange={setPage}
                        onLimitChange={(l) => {
                            setLimit(l);
                            setPage(1);
                        }}
                        isLoading={isFetching}
                    />
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Expense</DialogTitle>
                        <DialogDescription>
                            Update the expense details
                        </DialogDescription>
                    </DialogHeader>
                    {editDefaultValues && (
                        <ExpenseForm
                            key={selectedExpense?._id}
                            defaultValues={editDefaultValues}
                            onSubmit={handleUpdateExpense}
                            isSubmitting={isUpdating}
                            categories={categories}
                            branches={branches}
                            onAddCategory={() =>
                                setIsAddCategoryDialogOpen(true)
                            }
                            submitLabel="Update"
                            onCancel={() => setIsEditDialogOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this expense? This
                            action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteExpense}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isDeleting}
                        >
                            {isDeleting && (
                                <Loader className="h-4 w-4 animate-spin" />
                            )}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Add Category Dialog */}
            <Dialog
                open={isAddCategoryDialogOpen && canCreateExpense}
                onOpenChange={setIsAddCategoryDialogOpen}
            >
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Add New Category</DialogTitle>
                        <DialogDescription>
                            Create a new expense category
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="category-name">
                                Category Name *
                            </Label>
                            <Input
                                id="category-name"
                                placeholder="e.g. Office Supplies"
                                value={newCategoryName}
                                onChange={(e) =>
                                    setNewCategoryName(e.target.value)
                                }
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsAddCategoryDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateCategory}
                            disabled={isCreatingCategory}
                        >
                            {isCreatingCategory && (
                                <Loader className="h-4 w-4 animate-spin" />
                            )}
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
