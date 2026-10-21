"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { BellRing, CheckCircle2, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  useGetHeadsUpQuery,
  useGetPendingRemindersQuery,
  useMarkHeadsUpSeenMutation,
  useReminderActionMutation,
  type IPaymentReminder,
} from "@/redux/features/paymentReminder/paymentReminderApi";
import { MarkPaidDialog } from "./mark-paid-dialog";

/**
 * Last check before a client is emailed: lists reminders going out within a day so an admin can
 * Hold one (paid but nobody recorded it), record the payment, or just let it send as planned.
 * Shown once a day, and only after the "when to remind" prompt has been dealt with.
 */
export function ReminderHeadsUpDialog() {
  const { can } = usePermissions();
  const allowed = can("paymentReminder.manage");
  const { data: pending = [], isSuccess } = useGetPendingRemindersQuery(
    undefined,
    { skip: !allowed },
  );
  const { data: items = [] } = useGetHeadsUpQuery(undefined, {
    skip: !allowed || !isSuccess || pending.length > 0,
  });
  const [markSeen] = useMarkHeadsUpSeenMutation();
  const [act, { isLoading }] = useReminderActionMutation();
  const [closed, setClosed] = useState(false);
  const [held, setHeld] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState<IPaymentReminder | null>(null);
  const seen = useRef(false);

  const open = allowed && !closed && items.length > 0 && !paying;

  useEffect(() => {
    if (open && !seen.current) {
      seen.current = true;
      void markSeen(items.map((i) => i._id));
    }
  }, [open, items, markSeen]);

  const hold = (i: IPaymentReminder) =>
    act({ id: i._id, action: "pause" })
      .unwrap()
      .then(() => {
        setHeld((p) => new Set(p).add(i._id));
        toast.success("Reminder put on hold");
      })
      .catch((e) => toast.error(e?.data?.message || "Could not hold"));

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && setClosed(true)}>
        <DialogContent className="sm:max-w-xl rounded-2xl p-0 gap-0 max-h-[85vh] flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-4 text-left">
            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BellRing className="size-5" />
            </div>
            <DialogTitle className="text-xl">
              These reminders go out soon
            </DialogTitle>
            <DialogDescription>
              Check that none of these clients has already paid. Anything you
              leave alone is sent as planned.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 space-y-3 overflow-y-auto px-6 pb-4">
            {items.map((i) => {
              const isDue = i.kind === "due";
              const isHeld = held.has(i._id);
              return (
                <div key={i._id} className="rounded-xl border p-4 space-y-3">
                  <div>
                    <p className="font-medium">
                      {i.clientName}{" "}
                      <span className="text-muted-foreground font-normal">
                        · {i.orderNumber}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isDue
                        ? `${formatMoney(i.amount, i.currency)} due`
                        : `${i.title}: ${formatMoney(i.amount, i.currency)}`}
                      {i.sendAt &&
                        ` · goes out ${format(new Date(i.sendAt), "EEE d MMM, h:mm a")}`}
                    </p>
                  </div>
                  {isHeld ? (
                    <p className="text-sm text-muted-foreground">
                      On hold. Resume it from Payment Reminders.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {isDue ? (
                        i.receiptId && (
                          <Button size="sm" variant="outline" asChild>
                            <Link
                              href={`/receipts/${i.receiptId}`}
                              onClick={() => setClosed(true)}
                            >
                              <CheckCircle2 /> Record payment
                            </Link>
                          </Button>
                        )
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPaying(i)}
                        >
                          <CheckCircle2 /> Mark paid
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isLoading}
                        onClick={() => hold(i)}
                      >
                        <PauseCircle /> Hold
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter className="border-t px-6 py-4">
            <Button onClick={() => setClosed(true)}>Looks good</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {paying && (
        <MarkPaidDialog
          reminder={paying}
          open
          onOpenChange={(o) => !o && setPaying(null)}
        />
      )}
    </>
  );
}
