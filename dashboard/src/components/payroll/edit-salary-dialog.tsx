import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
    useProcessPaymentMutation,
    type IProcessPaymentRequest,
} from "@/redux/features/payroll/payrollApi";
import { useSession } from "@/lib/auth-client";
import {
    getPayrollAmountMismatchDetails,
    type PayrollAmountMismatchDetails,
} from "@/lib/payroll-mismatch";
import { Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditSalaryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    staffId: string;
    staffName: string;
    month: string;
    baseAmount: number; // calculated payable amount
    mode?: "pay" | "edit";
    initialBonus?: number;
    initialDeduction?: number;
    initialNote?: string;
    onSave?: (data: {
        baseAmount: number;
        bonus: number;
        deduction: number;
        note: string;
    }) => void;
}

export default function EditSalaryDialog({
    open,
    onOpenChange,
    staffId,
    staffName,
    month,
    baseAmount,
    mode = "pay",
    initialBonus = 0,
    initialDeduction = 0,
    initialNote = "",
    onSave,
}: EditSalaryDialogProps) {
    const { data: session } = useSession();
    const [bonus, setBonus] = useState<string>("");
    const [deduction, setDeduction] = useState<string>("");
    const [note, setNote] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [localBaseAmount, setLocalBaseAmount] = useState<string>(
        (baseAmount || 0).toString(),
    );
    const [finalAmount, setFinalAmount] = useState<number>(baseAmount || 0);
    const [isBaseEditable, setIsBaseEditable] = useState(false);

    // E1-F2-T2: when the backend rejects an out-of-tolerance amount with a
    // 409 PAYROLL_AMOUNT_MISMATCH, we hold on to the exact request payload
    // that was rejected so the "Confirm & Pay Anyway" action can resend
    // precisely that same request with `confirm: true` — not whatever the
    // form fields have changed to while the confirmation dialog is open.
    const [pendingMismatch, setPendingMismatch] = useState<{
        payload: IProcessPaymentRequest;
        details: PayrollAmountMismatchDetails;
    } | null>(null);

    const [processPayment, { isLoading }] = useProcessPaymentMutation();

    useEffect(() => {
        if (open) {
            setBonus(initialBonus > 0 ? initialBonus.toString() : "");
            setDeduction(
                initialDeduction > 0 ? initialDeduction.toString() : "",
            );
            setNote(initialNote || "");
            setPaymentMethod("cash");
            setLocalBaseAmount((baseAmount || 0).toString());
            setFinalAmount(baseAmount || 0);
            setIsBaseEditable(false);
        }
    }, [open, baseAmount, initialBonus, initialDeduction, initialNote]);

    // Recalculate final amount when bonus/deduction/base changes
    useEffect(() => {
        const b = parseFloat(bonus) || 0;
        const d = parseFloat(deduction) || 0;
        const base = parseFloat(localBaseAmount) || 0;
        setFinalAmount(Math.max(0, base + b - d));
    }, [localBaseAmount, bonus, deduction]);

    const handleSave = () => {
        if (onSave) {
            onSave({
                baseAmount: parseFloat(localBaseAmount) || 0,
                bonus: parseFloat(bonus) || 0,
                deduction: parseFloat(deduction) || 0,
                note: note.trim(),
            });
            onOpenChange(false);
            toast.success("Changes Saved", {
                description:
                    "Salary adjustments have been saved for bulk payment.",
            });
        }
    };

    const submitPayment = async (payload: IProcessPaymentRequest) => {
        try {
            await processPayment(payload).unwrap();

            toast.success("Payment Successful", {
                description: `Salary paid to ${staffName}`,
            });
            setPendingMismatch(null);
            onOpenChange(false);
        } catch (error: unknown) {
            // E1-F2-T2: an out-of-tolerance amount that hasn't been
            // acknowledged yet — show the confirmation dialog with the
            // server's expected/received/difference figures instead of a
            // generic failure toast. Preserve existing behavior for every
            // other error (locked month, validation, etc.).
            const mismatch = getPayrollAmountMismatchDetails(error);
            if (mismatch) {
                setPendingMismatch({ payload, details: mismatch });
                return;
            }

            const message =
                (error as { data?: { message?: string } })?.data?.message;
            toast.error("Payment Failed", {
                description: message || "Could not process payment",
            });
        }
    };

    const handlePayment = () => {
        submitPayment({
            staffId,
            month,
            amount: finalAmount,
            paymentMethod,
            paymentType: "salary",
            note,
            bonus: parseFloat(bonus) || 0,
            deduction: parseFloat(deduction) || 0,
            createdBy: session?.user?.id || "",
        });
    };

    const handleConfirmMismatch = () => {
        if (!pendingMismatch) return;
        submitPayment({ ...pendingMismatch.payload, confirm: true });
    };

    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {mode === "edit"
                            ? "Edit Payment"
                            : "Review & Process Payment"}
                    </DialogTitle>
                    <DialogDescription>
                        Review and adjust salary for{" "}
                        <span className="font-semibold">{staffName}</span>.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="base" className="text-right">
                            Base
                        </Label>
                        <div className="col-span-3 flex items-center gap-2">
                            <Input
                                id="base"
                                type="number"
                                value={localBaseAmount}
                                onChange={(e) =>
                                    setLocalBaseAmount(e.target.value)
                                }
                                disabled={!isBaseEditable}
                                className={!isBaseEditable ? "bg-muted" : ""}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 shrink-0"
                                onClick={() =>
                                    setIsBaseEditable(!isBaseEditable)
                                }
                                title="Edit Base Salary"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="lucide lucide-pencil"
                                >
                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                    <path d="m15 5 4 4" />
                                </svg>
                            </Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="bonus" className="text-right">
                            Bonus
                        </Label>
                        <Input
                            id="bonus"
                            type="number"
                            value={bonus}
                            onChange={(e) => setBonus(e.target.value)}
                            className="col-span-3"
                            placeholder="0.00"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="deduction" className="text-right">
                            Deduction
                        </Label>
                        <Input
                            id="deduction"
                            type="number"
                            value={deduction}
                            onChange={(e) => setDeduction(e.target.value)}
                            className="col-span-3 text-red-500"
                            placeholder="0.00"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="total" className="text-right font-bold">
                            Total
                        </Label>
                        <div className="col-span-3 font-bold text-lg">
                            {(finalAmount || 0).toFixed(2)}
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="method" className="text-right">
                            Method
                        </Label>
                        <Select
                            value={paymentMethod}
                            onValueChange={setPaymentMethod}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Payment Method" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="bank_transfer">
                                    Bank Transfer
                                </SelectItem>
                                <SelectItem value="mobile_banking">
                                    Mobile Banking
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="note" className="text-right">
                            Note
                        </Label>
                        <Input
                            id="note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="col-span-3"
                            placeholder="Optional note..."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    {onSave && (
                        <Button
                            variant="secondary"
                            onClick={handleSave}
                            disabled={isLoading}
                            className="gap-2"
                        >
                            <Save className="h-4 w-4" />
                            Save
                        </Button>
                    )}
                    <Button onClick={handlePayment} disabled={isLoading}>
                        {isLoading && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        Confirm Payment
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* E1-F2-T2: amount-mismatch confirmation (409 PAYROLL_AMOUNT_MISMATCH) */}
        <AlertDialog
                open={!!pendingMismatch}
                onOpenChange={(open) => !open && setPendingMismatch(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Amount Mismatch</AlertDialogTitle>
                        <AlertDialogDescription>
                            The amount you entered for{" "}
                            <span className="font-semibold">{staffName}</span>{" "}
                            differs from the system-calculated expected
                            amount by more than the allowed tolerance.
                            Review the figures below before proceeding.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {pendingMismatch && (
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 rounded-md border bg-muted/30 p-3 text-sm">
                            <span className="text-muted-foreground">
                                Expected Amount
                            </span>
                            <span className="text-right font-mono font-medium">
                                {pendingMismatch.details.expectedAmount.toFixed(2)}
                            </span>

                            <span className="text-muted-foreground">
                                Received Amount
                            </span>
                            <span className="text-right font-mono font-medium">
                                {pendingMismatch.details.receivedAmount.toFixed(2)}
                            </span>

                            <span className="text-muted-foreground font-semibold">
                                Difference
                            </span>
                            <span
                                className={cn(
                                    "text-right font-mono font-semibold",
                                    pendingMismatch.details.difference > 0
                                        ? "text-green-600"
                                        : "text-red-600",
                                )}
                            >
                                {pendingMismatch.details.difference > 0
                                    ? "+"
                                    : ""}
                                {pendingMismatch.details.difference.toFixed(2)}
                            </span>
                        </div>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isLoading}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmMismatch}
                            disabled={isLoading}
                        >
                            {isLoading && (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            Confirm & Pay Anyway
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
