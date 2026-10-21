"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellRing, Repeat, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { formatMoney } from "@/lib/money";
import {
  useGetPendingRemindersQuery,
  useMarkRemindersPromptedMutation,
  useScheduleRemindersMutation,
} from "@/redux/features/paymentReminder/paymentReminderApi";
import {
  SchedulePicker,
  toScheduleItem,
  type ScheduleChoice,
} from "./schedule-picker";

/**
 * Shown to admins once a day while a completed order still has a due balance or
 * recurring charge with no reminder decision. Closing it without choosing applies
 * the 7-day default and it is not shown again; "Done" applies only what was picked.
 */
export function ReminderPromptDialog() {
  const { can } = usePermissions();
  const allowed = can("paymentReminder.manage");
  const { data: items = [] } = useGetPendingRemindersQuery(undefined, {
    skip: !allowed,
  });
  const [markPrompted] = useMarkRemindersPromptedMutation();
  const [schedule, { isLoading }] = useScheduleRemindersMutation();
  const [closed, setClosed] = useState(false);
  const [choices, setChoices] = useState<Record<string, ScheduleChoice>>({});
  const prompted = useRef(false);

  const open = allowed && !closed && items.length > 0;

  useEffect(() => {
    if (open && !prompted.current) {
      prompted.current = true;
      void markPrompted(items.map((i) => i._id));
    }
  }, [open, items, markPrompted]);

  const submit = async (list: { id: string; c: ScheduleChoice }[]) => {
    try {
      await schedule(list.map((x) => toScheduleItem(x.id, x.c))).unwrap();
      setClosed(true);
    } catch {
      toast.error("Could not save the reminder schedule");
    }
  };

  const picked = items.filter((i) => choices[i._id]);
  const done = () =>
    submit(picked.map((i) => ({ id: i._id, c: choices[i._id]! })));
  const dismiss = () =>
    submit(items.map((i) => ({ id: i._id, c: { option: "7d" } })));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isLoading && dismiss()}>
      <DialogContent className="sm:max-w-xl rounded-2xl p-0 gap-0 max-h-[85vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 text-left">
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BellRing className="size-5" />
          </div>
          <DialogTitle className="text-xl">
            Remind clients about payments?
          </DialogTitle>
          <DialogDescription>
            These orders are complete. Choose when each client should get a
            reminder. Closing this uses the default: 7 days from today.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-3 overflow-y-auto px-6 pb-4">
          {items.map((i) => {
            const isDue = i.kind === "due";
            return (
              <div key={i._id} className="rounded-xl border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {i.clientName}{" "}
                      <span className="text-muted-foreground font-normal">
                        · {i.orderNumber}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isDue
                        ? `${formatMoney(i.amount, i.currency)} due`
                        : `${i.title}: ${formatMoney(i.amount, i.currency)}/${i.cycle === "yearly" ? "year" : "month"}`}
                    </p>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    {isDue ? <Wallet /> : <Repeat />}
                    {isDue ? "Due" : "Recurring"}
                  </Badge>
                </div>
                <SchedulePicker
                  value={choices[i._id]}
                  onChange={(c) => setChoices((p) => ({ ...p, [i._id]: c }))}
                />
                <Link
                  href={
                    isDue && i.receiptId
                      ? `/receipts/${i.receiptId}`
                      : "/payment-reminders?tab=recurring"
                  }
                  onClick={() => setClosed(true)}
                  className="text-xs text-primary hover:underline"
                >
                  {isDue ? "View receipt" : "View in Payment Reminders"}
                </Link>
              </div>
            );
          })}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button
            onClick={done}
            disabled={picked.length === 0 || isLoading}
          >
            Done{picked.length ? ` (${picked.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
