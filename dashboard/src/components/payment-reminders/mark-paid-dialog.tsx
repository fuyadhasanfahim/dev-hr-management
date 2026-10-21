"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/shared/DatePicker";
import { formatMoney } from "@/lib/money";
import {
  useReminderActionMutation,
  type IPaymentReminder,
} from "@/redux/features/paymentReminder/paymentReminderApi";

const METHODS = ["bKash", "Nagad", "Bank transfer", "Cash", "Card", "Other"];

/** Records that a recurring cycle was paid (amount, date, method) and moves the charge to its next cycle. */
export function MarkPaidDialog({
  reminder,
  open,
  onOpenChange,
}: {
  reminder: IPaymentReminder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [act, { isLoading }] = useReminderActionMutation();
  const [amount, setAmount] = useState(String(reminder.amount));
  const [paidAt, setPaidAt] = useState<Date | undefined>(new Date());
  const [method, setMethod] = useState("bKash");
  const [note, setNote] = useState("");

  const submit = () =>
    act({
      id: reminder._id,
      action: "mark-paid",
      body: {
        amount: Number(amount),
        ...(paidAt ? { paidAt: paidAt.toISOString() } : {}),
        method,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
    })
      .unwrap()
      .then(() => {
        toast.success("Marked paid. Next cycle scheduled");
        onOpenChange(false);
      })
      .catch((e) => toast.error(e?.data?.message || "Could not save payment"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {reminder.clientName} · {reminder.title} ·{" "}
            {formatMoney(reminder.amount, reminder.currency)}
            {reminder.cycle === "yearly" ? "/year" : "/month"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="mp-amount">Amount received</Label>
            <Input
              id="mp-amount"
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Paid on</Label>
            <DatePicker value={paidAt} onChange={setPaidAt} maxDate={new Date()} />
          </div>
          <div className="grid gap-2">
            <Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mp-note">Note (optional)</Label>
            <Input
              id="mp-note"
              placeholder="Transaction ID, etc."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={isLoading || !(Number(amount) > 0)}
          >
            Save payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
