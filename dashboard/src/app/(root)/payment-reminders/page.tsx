"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { differenceInCalendarDays, format } from "date-fns";
import {
  CalendarClock,
  CheckCircle2,
  Pause,
  Play,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePermissions } from "@/hooks/use-permissions";
import { formatMoney } from "@/lib/money";
import {
  useGetRemindersQuery,
  useReminderActionMutation,
  useRescheduleReminderMutation,
  useSyncRemindersMutation,
  type IPaymentReminder,
  type ReminderAction,
  type ReminderKind,
  type ReminderStatus,
} from "@/redux/features/paymentReminder/paymentReminderApi";
import { MarkPaidDialog } from "@/components/payment-reminders/mark-paid-dialog";
import {
  SchedulePicker,
  toScheduleItem,
  type ScheduleChoice,
} from "@/components/payment-reminders/schedule-picker";

const STATUS_LABEL: Record<ReminderStatus, string> = {
  awaiting_decision: "Needs decision",
  scheduled: "Scheduled",
  paused: "Paused",
  cancelled: "Cancelled",
  done: "Paid",
};

function countdown(r: IPaymentReminder) {
  if (r.status === "awaiting_decision") return "Not scheduled";
  if (r.status !== "scheduled" || !r.sendAt) return "—";
  const d = differenceInCalendarDays(new Date(r.sendAt), new Date());
  if (d < 0) return "Sending now";
  if (d === 0) return "Today";
  return `In ${d} day${d === 1 ? "" : "s"}`;
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Row({ r, canManage }: { r: IPaymentReminder; canManage: boolean }) {
  const [act, { isLoading }] = useReminderActionMutation();
  const [reschedule] = useRescheduleReminderMutation();
  const [choice, setChoice] = useState<ScheduleChoice>();
  const [paidOpen, setPaidOpen] = useState(false);
  const live = r.status !== "done";

  const run = (action: ReminderAction, ok: string) =>
    act({ id: r._id, action })
      .unwrap()
      .then(() => toast.success(ok))
      .catch((e) => toast.error(e?.data?.message || "Action failed"));

  const apply = (c: ScheduleChoice) => {
    setChoice(c);
    reschedule(toScheduleItem(r._id, c))
      .unwrap()
      .then(() => toast.success("Reminder rescheduled"))
      .catch((e) => toast.error(e?.data?.message || "Could not reschedule"));
  };

  return (
    <TableRow>
      <TableCell>
        <Link
          href={
            r.kind === "due" && r.receiptId
              ? `/receipts/${r.receiptId}`
              : `/orders/${r.orderId}`
          }
          className="font-medium hover:underline"
        >
          {r.orderNumber}
        </Link>
        <div className="text-xs text-muted-foreground">{r.clientName}</div>
      </TableCell>
      <TableCell>
        {r.kind === "due" ? "Due balance" : r.title}
        {r.cycle && (
          <div className="text-xs text-muted-foreground">
            <span className="capitalize">{r.cycle}</span>
            {r.dueDate && ` · cycle due ${format(new Date(r.dueDate), "dd MMM yyyy")}`}
            {!!r.paidCount && ` · paid ${r.paidCount}×`}
          </div>
        )}
      </TableCell>
      <TableCell className="tabular-nums">
        {formatMoney(r.amount, r.currency)}
      </TableCell>
      <TableCell>
        <Badge
          variant={r.status === "awaiting_decision" ? "destructive" : "outline"}
        >
          {STATUS_LABEL[r.status]}
        </Badge>
        {r.lastError && (
          <div className="mt-1 text-xs text-destructive">{r.lastError}</div>
        )}
      </TableCell>
      <TableCell>
        <div className="font-medium">{countdown(r)}</div>
        <div className="text-xs text-muted-foreground">
          {r.status === "scheduled" && r.sendAt
            ? format(new Date(r.sendAt), "dd MMM yyyy")
            : r.lastSentAt
              ? `Last sent ${format(new Date(r.lastSentAt), "dd MMM")}${r.lastChannels?.length ? ` · ${r.lastChannels.join(", ")}` : ""}`
              : ""}
        </div>
      </TableCell>
      <TableCell>
        {canManage && live && (
          <div className="flex justify-end">
            {r.status === "scheduled" && (
              <IconAction
                label="Pause"
                disabled={isLoading}
                onClick={() => run("pause", "Reminder paused")}
              >
                <Pause className="size-4" />
              </IconAction>
            )}
            {(r.status === "paused" || r.status === "cancelled") && (
              <IconAction
                label="Resume"
                disabled={isLoading}
                onClick={() => run("resume", "Reminder resumed")}
              >
                <Play className="size-4" />
              </IconAction>
            )}
            {r.kind === "recurring" && r.dueDate && (
              <IconAction
                label="Mark this cycle paid"
                disabled={isLoading}
                onClick={() => setPaidOpen(true)}
              >
                <CheckCircle2 className="size-4" />
              </IconAction>
            )}
            <IconAction
              label="Send now"
              disabled={isLoading}
              onClick={() => run("send-now", "Reminder email sent")}
            >
              <Send className="size-4" />
            </IconAction>
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Change date"
                    >
                      <CalendarClock className="size-4" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Change date</TooltipContent>
              </Tooltip>
              <PopoverContent align="end" className="w-auto space-y-2">
                <p className="text-sm font-medium">Send reminder</p>
                <SchedulePicker value={choice} onChange={apply} />
              </PopoverContent>
            </Popover>
            {r.status !== "cancelled" && (
              <IconAction
                label="Cancel"
                disabled={isLoading}
                onClick={() => run("cancel", "Reminder cancelled")}
              >
                <XCircle className="size-4" />
              </IconAction>
            )}
          </div>
        )}
        {paidOpen && (
          <MarkPaidDialog reminder={r} open onOpenChange={setPaidOpen} />
        )}
      </TableCell>
    </TableRow>
  );
}

function Content() {
  const router = useRouter();
  const kind: ReminderKind =
    useSearchParams().get("tab") === "recurring" ? "recurring" : "due";
  const { can } = usePermissions();
  const canManage = can("paymentReminder.manage");
  const { data = [], isLoading } = useGetRemindersQuery({ kind });
  const [sync, { isLoading: syncing }] = useSyncRemindersMutation();

  const runSync = () =>
    sync()
      .unwrap()
      .then((r) =>
        toast.success(
          r.created
            ? `${r.created} reminder(s) added from completed orders`
            : "Already up to date",
        ),
      )
      .catch(() => toast.error("Sync failed"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Payment Reminders</h1>
          <p className="text-sm text-muted-foreground">
            Clients are emailed at 10:00 AM on the scheduled day.
          </p>
        </div>
        {canManage && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={runSync} disabled={syncing}>
                <RefreshCw className={syncing ? "animate-spin" : ""} />
                Sync completed orders
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Add reminders for orders completed before this feature
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <Tabs
        value={kind}
        onValueChange={(v) => router.replace(`/payment-reminders?tab=${v}`)}
      >
        <TabsList>
          <TabsTrigger value="due">Due payments</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>For</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Next reminder</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => (
              <Row key={r._id} r={r} canManage={canManage} />
            ))}
            {!isLoading && data.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  Nothing here yet. Reminders appear when an order is completed.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function PaymentRemindersPage() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
