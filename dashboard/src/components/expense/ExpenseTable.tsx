import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, RefreshCcw, Receipt } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Expense } from "@/redux/features/expense/expenseApi";

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  pending: { label: "Pending", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  paid: { label: "Paid", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  partial_paid: { label: "Partial Paid", dot: "bg-orange-500", text: "text-orange-700 dark:text-orange-400" },
};

interface ExpenseTableProps {
  expenses: Expense[];
  isLoading: boolean;
  formatCurrency: (amount: number) => string;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  onMarkPending: (expense: Expense) => void;
}

export function ExpenseTable({
  expenses,
  isLoading,
  formatCurrency,
  onEdit,
  onDelete,
  onMarkPending,
}: ExpenseTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b border-border hover:bg-transparent bg-muted/40">
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">
            Date
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Title
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Category
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Branch
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
            Amount
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Status
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Note
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-6">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <TableRow key={index} className="border-b border-border/60">
              <TableCell className="pl-6"><Skeleton className="h-3.5 w-[90px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[130px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[90px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[90px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[70px] ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[80px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[100px]" /></TableCell>
              <TableCell className="pr-6">
                <div className="flex justify-end gap-1">
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <Skeleton className="h-7 w-7 rounded-md" />
                </div>
              </TableCell>
            </TableRow>
          ))
        ) : expenses.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="h-40 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-brand-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No expenses found matching your criteria.
                </p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          expenses.map((expense) => {
            const cfg = STATUS_CONFIG[expense.status] ?? STATUS_CONFIG.pending;
            return (
              <TableRow key={expense._id}>
                {/* Date */}
                <TableCell className="pl-6">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(expense.date), "MMM dd, yyyy")}
                  </span>
                </TableCell>

                {/* Title */}
                <TableCell>
                  <span className="text-sm text-foreground truncate max-w-[160px] block">
                    {expense.title}
                  </span>
                </TableCell>

                {/* Category */}
                <TableCell>
                  <span className="text-sm text-foreground/80">
                    {expense.category?.name || "—"}
                  </span>
                </TableCell>

                {/* Branch */}
                <TableCell>
                  <span className="text-sm text-foreground/80">
                    {expense.branch?.name || "—"}
                  </span>
                </TableCell>

                {/* Amount */}
                <TableCell className="text-right">
                  <span className="text-sm text-foreground">
                    {formatCurrency(expense.amount)}
                  </span>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <span className={cn("inline-flex items-center gap-1.5 text-sm", cfg.text)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
                    {cfg.label}
                  </span>
                </TableCell>

                {/* Note */}
                <TableCell>
                  <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                    {expense.note || "—"}
                  </span>
                </TableCell>

                {/* Actions */}
                <TableCell className="pr-6">
                  <div className="flex items-center justify-end gap-1">
                    {expense.status === "paid" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Mark as Pending"
                        onClick={() => onMarkPending(expense)}
                        className="h-7 w-7 text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit"
                      onClick={() => onEdit(expense)}
                      className="h-7 w-7 text-muted-foreground hover:text-brand-accent hover:bg-brand-accent/10"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      onClick={() => onDelete(expense)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
