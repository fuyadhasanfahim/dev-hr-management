"use client";

import { Info } from "lucide-react";
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
import { isBDT } from "@/lib/money";

/** True when an invoice in this currency can't carry an online payment link (Stripe and PayPal don't support BDT). */
export const hasNoPaymentLink = (currency?: string | null) => isBDT(currency);

/**
 * Shown before generating an invoice in BDT: Stripe and PayPal don't support BDT, so the invoice is created
 * without a Pay Now link. Every other currency (USD, EUR, GBP …) gets its link and is paid in that currency.
 */
export function BdtInvoiceNotice({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Info className="size-5 text-amber-500" aria-hidden />
            No payment link for BDT invoices
          </AlertDialogTitle>
          <AlertDialogDescription>
            Stripe and PayPal do not support BDT, so a payment link will not be added to this invoice. Please collect
            BDT payments by bank transfer or another manual method and record them in the receipt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Generate invoice without link</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
