"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Role } from "@/constants/role";
import { 
    useGetOrderByIdQuery, 
    useRecordManualPaymentMutation,
    useUpdateOrderStatusMutation
} from "@/redux/features/order/orderApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    ArrowLeft, 
    Package, 
    Clock, 
    CheckCircle, 
    AlertCircle, 
    FileText, 
    LayoutDashboard, 
    Wallet,
    DollarSign,
    Loader2,
    ChevronDown,
    Users,
    LayoutList
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderTasksTab } from "@/components/tasks/OrderTasksTab";

import { OrderStatus, IOrder } from "@/types/order.type";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { EmailDialog } from "../EmailDialog";

// Status workflow: defines which statuses can transition to which
const statusWorkflow: Record<OrderStatus, OrderStatus[]> = {
  pending: ["in_progress", "cancelled"],
  in_progress: ["quality_check", "revision", "cancelled"],
  quality_check: ["pending_delivery", "revision", "in_progress"],
  revision: ["in_progress", "cancelled"],
  completed: ["revision"],
  delivered: ["pending_final", "revision", "cancelled"], 
  cancelled: ["pending_upfront"],
  pending_upfront: ["active", "cancelled"], 
  active: ["in_progress", "cancelled"], 
  pending_delivery: ["revision", "cancelled"], 
  pending_final: ["cancelled"], 
};

const getFilteredStatusOptions = (order: IOrder): OrderStatus[] => {
  const currentStatus = order.status;
  const baseOptions = statusWorkflow[currentStatus] || [];
  const payment = order.paymentPhases;

  if (!payment) return baseOptions;

  const isUpfrontPaid = payment.upfront?.status === "paid";
  const isDeliveryPaid = payment.delivery?.status === "paid";
  const isFinalPaid = payment.final?.status === "paid";

  if (isUpfrontPaid && isDeliveryPaid && isFinalPaid) {
    const restricted = ["delivered", "completed", "revision", "cancelled"] as OrderStatus[];
    return restricted.filter(opt => opt !== currentStatus);
  }

  return baseOptions.map((opt) => {
    if (opt === "pending_delivery" && isDeliveryPaid) return "delivered";
    if (opt === "pending_final" && isFinalPaid) return "completed";
    return opt;
  }).filter((opt, index, self) => 
    self.indexOf(opt) === index && opt !== currentStatus
  );
};

export default function OrderDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = params.id as string;
    
    const [activeTab, setActiveTab] = useState("overview");
    
    // Sync tab state with URL query params when URL changes or on hydration
    useEffect(() => {
        const t = searchParams.get("tab");
        if (t && (t === "overview" || t === "tasks")) {
            setActiveTab(t);
        }
    }, [searchParams]);

    const { data: session } = useSession();
    const canSeeFinancials = useMemo(() => {
        const r = session?.user?.role;
        return r === Role.SUPER_ADMIN || r === Role.ADMIN || r === Role.HR_MANAGER;
    }, [session]);

    const { data, isLoading, error } = useGetOrderByIdQuery(id);
    const order = data?.data;

    const [recordManualPayment, { isLoading: isRecording }] = useRecordManualPaymentMutation();

    // Modal Interaction State
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [selectedPhase, setSelectedPhase] = useState<"upfront" | "delivery" | "final" | null>(null);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentNotes, setPaymentNotes] = useState("");

    const openPaymentDialog = (phase: "upfront" | "delivery" | "final", defaultAmountCents: number) => {
        setSelectedPhase(phase);
        // Show user the standard dollar/taka units
        setPaymentAmount((defaultAmountCents / 100).toString()); 
        setPaymentNotes("");
        setIsPaymentDialogOpen(true);
    };

    const handleRecordPayment = async () => {
        if (!selectedPhase || !order?.quotationGroupId) return;
        const amt = parseFloat(paymentAmount);
        if (isNaN(amt) || amt <= 0) {
            toast.error("Please enter a valid numeric amount greater than 0.");
            return;
        }
        try {
            const res = await recordManualPayment({
                quotationGroupId: order.quotationGroupId,
                orderId: id,
                phase: selectedPhase,
                amount: amt,
                notes: paymentNotes
            }).unwrap();
            
            toast.success(res.message || "Physical receipt recorded successfully!");
            setIsPaymentDialogOpen(false);
        } catch (err: any) {
            toast.error(err?.data?.message || "Failed to record physical receipt.");
        }
    };

    // -- Status Management Flow logic --
    const [updateOrderStatus, { isLoading: isUpdatingStatus }] = useUpdateOrderStatusMutation();
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
    const [pendingTargetStatus, setPendingTargetStatus] = useState<OrderStatus | null>(null);

    const handleStatusClick = (target: OrderStatus) => {
        setPendingTargetStatus(target);
        setIsEmailDialogOpen(true);
    };

    const handleSendStatusEmail = async (message: string, downloadLink?: string, selectedEmails?: string[]) => {
        if (!pendingTargetStatus) return;
        try {
            await updateOrderStatus({
                id: id,
                data: {
                    status: pendingTargetStatus,
                    customEmailMessage: message,
                    downloadLink,
                    sendEmail: true,
                    selectedEmails,
                },
            }).unwrap();
            
            toast.success(`Status successfully updated to ${ORDER_STATUS_LABELS[pendingTargetStatus] || pendingTargetStatus}`);
            setIsEmailDialogOpen(false);
            setPendingTargetStatus(null);
        } catch (err: any) {
            toast.error(err?.data?.message || "Failed to update order status.");
        }
    };

    // Debugging logs
    console.log("ORDER ID PARAM:", id);
    console.log("ORDER DATA:", order);

    if (isLoading) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-10 w-64" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-96 col-span-2" />
                    <div className="space-y-6">
                        <Skeleton className="h-48" />
                        <Skeleton className="h-48" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="container mx-auto p-6 text-center mt-20">
                <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="p-4 bg-red-100 rounded-full">
                        <AlertCircle className="h-12 w-12 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold">Order Not Found</h1>
                    <p className="text-muted-foreground max-w-md">
                        We couldn&apos;t find the order with ID <span className="font-mono text-primary font-medium">{id}</span>. 
                        It may have been deleted or the link might be incorrect.
                    </p>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={() => router.push("/orders")}>
                            Back to Orders
                        </Button>
                        <Button onClick={() => router.push("/dashboard")}>
                            Go to Dashboard
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400";
            case "active": return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400";
            case "completed": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400";
            case "cancelled": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400";
            default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status?.toLowerCase()) {
            case "pending": return <Clock className="h-4 w-4" />;
            case "active": return <Package className="h-4 w-4" />;
            case "completed": return <CheckCircle className="h-4 w-4" />;
            case "cancelled": return <AlertCircle className="h-4 w-4" />;
            default: return null;
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-500">
            {/* Header / Breadcrumb */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.push("/orders")} className="rounded-full shadow-sm">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">
                                {order.quotationSnapshot?.templateName || order.orderNumber || "Untitled Order"}
                            </h1>
                            <Badge className={`${getStatusColor(order.status)} flex items-center shadow-sm`}>
                                {getStatusIcon(order.status)}
                                {order.status?.toUpperCase()?.replace("_", " ")}
                            </Badge>
                        </div>
                        <p className="text-muted-foreground flex items-center gap-2 mt-1">
                            <span className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">{order.orderNumber}</span>
                            <span className="text-xs">•</span>
                            <span className="text-sm">Placed on {format(new Date(order.createdAt), "PPP")}</span>
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4" />
                        Export PDF
                    </Button>
                    {/* Update Status Dropdown Trigger */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="default" size="sm" className="gap-2 shadow-sm font-bold">
                                Update Status
                                <ChevronDown className="h-4 w-4 opacity-80" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[220px] border-border/50 shadow-xl">
                            {getFilteredStatusOptions(order).length === 0 ? (
                                <div className="p-3 text-center text-xs text-muted-foreground italic">
                                    No manual workflow paths available from current status ({order.status})
                                </div>
                            ) : (
                                getFilteredStatusOptions(order).map((nextStep) => (
                                    <DropdownMenuItem 
                                        key={nextStep} 
                                        onClick={() => handleStatusClick(nextStep)}
                                        className="cursor-pointer font-medium py-2 text-foreground/90 hover:text-primary transition-colors capitalize"
                                    >
                                        {ORDER_STATUS_LABELS[nextStep] || nextStep.replace("_", " ")}
                                    </DropdownMenuItem>
                                ))
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Tabbed Sections */}
                <div className="lg:col-span-2 space-y-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-muted/50 border h-12 p-1 rounded-xl mb-6">
                            <TabsTrigger value="overview" className="font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                                <LayoutDashboard className="h-4 w-4" />
                                Overview
                            </TabsTrigger>
                            <TabsTrigger value="tasks" className="font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                                <LayoutList className="h-4 w-4" />
                                Tasks & Team
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="space-y-6 mt-0 animate-in slide-in-from-left-4 duration-300">
                            <Card className="shadow-md border-muted/60">
                                <CardHeader className="border-b bg-muted/10">
                                    <CardTitle className="text-xl flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-primary" />
                                        Project Overview
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-6">
                                    <div>
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Description</h3>
                                        <div className="mt-2 text-foreground/90 leading-relaxed bg-muted/20 p-4 rounded-lg border border-dashed">
                                            {order.quotationSnapshot?.overview || "No detailed description provided for this order."}
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Service Breakdown (Scope of Work)</h3>
                                        <div className="grid gap-4">
                                            {order.quotationSnapshot?.scopeOfWork?.map((item: any, index: number) => (
                                                <div key={index} className="flex flex-col md:flex-row justify-between items-start md:items-center p-5 rounded-xl border bg-card hover:shadow-md transition-shadow">
                                                    <div className="flex items-start gap-4">
                                                        <div className="p-3 bg-primary/5 rounded-lg">
                                                            <Package className="h-6 w-6 text-primary" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-lg">{item.title}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-sm text-muted-foreground line-clamp-2">{item.description}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!order.quotationSnapshot?.scopeOfWork || order.quotationSnapshot.scopeOfWork.length === 0) && (
                                                <div className="text-muted-foreground text-sm italic">No specific scope of work items found.</div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="tasks" className="space-y-6 mt-0 animate-in slide-in-from-right-4 duration-300">
                            <OrderTasksTab 
                                order={order} 
                                canManage={canSeeFinancials || session?.user?.role === Role.TEAM_LEADER} 
                            />
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Right Column: Metadata & Stats */}
                <div className="space-y-6">
                    <Card className="shadow-md border-muted/60 overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="text-lg">Financial Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 text-center relative overflow-hidden">
                                <span className="text-muted-foreground text-sm font-medium">Grand Total</span>
                                <h2 className={cn("text-4xl font-black text-primary mt-1 tracking-tight", !canSeeFinancials && "blur-[3px] opacity-50 select-none")}>
                                    {canSeeFinancials ? (
                                        <>
                                            {order.quotationSnapshot?.currency === "USD" ? "$" : order.quotationSnapshot?.currency || "$"}
                                            {(order.quotationSnapshot?.grandTotal || 0).toLocaleString()}
                                        </>
                                    ) : (
                                        "******"
                                    )}
                                </h2>
                            </div>

                            <div className="space-y-3 pt-4">
                                <div className="flex justify-between items-center py-2 border-b border-dashed">
                                    <span className="text-muted-foreground text-sm">Client</span>
                                    <span className="font-bold text-sm">
                                        {order.quotationSnapshot?.clientName || (typeof order.clientId === "object" ? order.clientId.name : "N/A")}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-dashed">
                                    <span className="text-muted-foreground text-sm">Order Type</span>
                                    <Badge variant="secondary" className="capitalize font-bold text-[10px]">
                                        {order.orderType?.replace("_", " ") || "Project"}
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-dashed">
                                    <span className="text-muted-foreground text-sm">Payment Status</span>
                                    {order.status === "pending_upfront" ? (
                                        <Badge variant="destructive" className="font-bold text-[10px]">AWAITING UPFRONT</Badge>
                                    ) : (
                                        <Badge variant="default" className="font-bold text-[10px] bg-green-500">PAID</Badge>
                                    )}
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-muted-foreground text-sm">Last Update</span>
                                    <span className="font-medium text-sm text-foreground/70">
                                        {format(new Date(order.updatedAt), "MMM d, h:mm a")}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Payment Installments Dash */}
                    {order.paymentPhases && (
                        <Card className="shadow-md border-muted/60 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                            <CardHeader className="bg-emerald-500/5 border-b">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Wallet className="h-5 w-5 text-emerald-600" />
                                    Collection Progress
                                </CardTitle>
                                <CardDescription className="text-xs">Track installment stages & manually record cash</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                {(["upfront", "delivery", "final"] as const).map((phase) => {
                                    const details = order.paymentPhases?.[phase];
                                    if (!details) return null;

                                    const rawDue = details.amountDue || 0;
                                    const rawPaid = details.amountPaid || 0;
                                    const remaining = Math.max(0, rawDue - rawPaid);
                                    
                                    // Prioritize backend-calculated percentage if present (prevents arithmetic anomalies when masked)
                                    const pct = typeof details.percentage === "number" ? details.percentage : (rawDue > 0 ? Math.min(100, Math.floor((rawPaid / rawDue) * 100)) : 0);
                                    const isPhasePaid = details.status === "paid";

                                    return (
                                        <div key={phase} className="space-y-2 pb-4 border-b last:border-0 border-dashed last:pb-0">
                                            <div className="flex items-center justify-between">
                                                <h4 className="capitalize font-bold text-sm text-foreground/80 flex items-center gap-2">
                                                    {phase} 
                                                    {isPhasePaid ? (
                                                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                                    ) : (
                                                        <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground border uppercase">{details.status || 'pending'}</span>
                                                    )}
                                                </h4>
                                                <span className={cn("text-xs font-mono font-bold", isPhasePaid ? "text-emerald-600" : "text-muted-foreground")}>{pct}%</span>
                                            </div>
                                            
                                            <Progress value={pct} className={cn("h-2 bg-muted", isPhasePaid && "[&>div]:bg-emerald-600")} />

                                            <div className="flex items-center justify-between text-[11px]">
                                                <div className="text-muted-foreground font-medium italic">
                                                    {canSeeFinancials ? (
                                                        <>
                                                            <span className="text-foreground font-bold not-italic">{(rawPaid / 100).toFixed(2)}</span> / {(rawDue / 100).toFixed(2)} {order.quotationSnapshot?.currency === "USD" ? "$" : order.quotationSnapshot?.currency || "$"}
                                                        </>
                                                    ) : (
                                                        <span className="opacity-70">Visual tracking only</span>
                                                    )}
                                                </div>
                                                {!isPhasePaid && remaining > 0 && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-6 text-[10px] px-2 hover:bg-emerald-100 hover:text-emerald-900 dark:hover:bg-emerald-950/40 font-bold gap-1 border border-emerald-200 dark:border-emerald-900/50"
                                                        onClick={() => openPaymentDialog(phase, remaining)}
                                                    >
                                                        <DollarSign className="h-3 w-3" />
                                                        Record Cash
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    <Card className="shadow-md border-muted/60 bg-muted/20">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <LayoutDashboard className="h-4 w-4" />
                                Administration
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button variant="outline" className="w-full justify-start font-semibold" onClick={() => router.push(`/orders/invoice/${order._id}`)}>
                                <FileText className="h-4 w-4" />
                                Generate Invoice
                            </Button>
                            <Button variant="outline" className="w-full justify-start font-semibold">
                                <Package className="h-4 w-4" />
                                View Project Files
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
            {/* Record Manual Payment Confirmation Modal */}
            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="capitalize flex items-center gap-2 text-xl font-bold">
                            <Wallet className="h-6 w-6 text-emerald-600" />
                            Record Receipt: {selectedPhase}
                        </DialogTitle>
                        <DialogDescription className="text-xs pt-1">
                            Enter the physical cash/transfer payment received. Downstream logic will automatically lock in and trigger pipeline updates.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount" className="text-sm font-semibold text-foreground/90">
                                Amount Received ({order.quotationSnapshot?.currency || "$"})
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold pointer-events-none">
                                    {order.quotationSnapshot?.currency === "USD" ? "$" : order.quotationSnapshot?.currency || "$"}
                                </span>
                                <Input 
                                    id="amount" 
                                    type="number" 
                                    className="pl-8 h-12 text-lg font-mono font-bold focus-visible:ring-emerald-500"
                                    placeholder="0.00" 
                                    step="0.01"
                                    value={paymentAmount} 
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="notes" className="text-sm font-semibold text-foreground/90">Internal Recording Note (Optional)</Label>
                            <Input 
                                id="notes" 
                                placeholder="e.g. Hand-cash accepted at reception" 
                                value={paymentNotes}
                                onChange={(e) => setPaymentNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)} disabled={isRecording}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleRecordPayment} 
                            disabled={isRecording}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold"
                        >
                            {isRecording ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Recording...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-4 w-4" />
                                    Confirm Receipt
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Email confirmation dialog used for global status workflows */}
            {pendingTargetStatus && (
                <EmailDialog
                    open={isEmailDialogOpen}
                    onOpenChange={setIsEmailDialogOpen}
                    order={order}
                    status={pendingTargetStatus}
                    onSend={handleSendStatusEmail}
                    isLoading={isUpdatingStatus}
                />
            )}
        </div>
    );
}
