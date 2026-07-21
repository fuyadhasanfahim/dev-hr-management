"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Role } from "@/constants/role";
import { 
    useGetOrderByIdQuery, 
    useUpdateOrderStatusMutation
} from "@/redux/features/order/orderApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
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
import { 
    ArrowLeft, 
    Package, 
    Clock, 
    CheckCircle, 
    AlertCircle, 
    FileText, 
    LayoutDashboard,
    Loader2,
    ChevronDown,
    Users,
    LayoutList
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderTasksTab } from "@/components/tasks/OrderTasksTab";

import { OrderStatus, IOrder } from "@/types/order.type";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

// Status workflow: defines which statuses can transition to which
const statusWorkflow: Record<OrderStatus, OrderStatus[]> = {
  pending: ["in_progress", "cancelled"],
  in_progress: ["completed", "revision", "cancelled"],
  revision: ["in_progress", "cancelled"],
  completed: ["delivered", "revision"],
  delivered: ["revision"],
  cancelled: [],
};

const getFilteredStatusOptions = (order: IOrder): OrderStatus[] => {
  const currentStatus = order.status;
  const baseOptions = statusWorkflow[currentStatus] || [];
  return baseOptions.filter(opt => opt !== currentStatus);
};

export default function OrderDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const { data: session } = useSession();
    const canSeeFinancials = useMemo(() => {
        const r = session?.user?.role;
        return r === Role.SUPER_ADMIN || r === Role.ADMIN || r === Role.HR_MANAGER;
    }, [session]);

    const { data, isLoading, error } = useGetOrderByIdQuery(id);
    const order = data?.data;
    // -- Status Management Flow logic --
    const [updateOrderStatus] = useUpdateOrderStatusMutation();

    const handleStatusClick = async (target: OrderStatus) => {
        try {
            await updateOrderStatus({
                id: id,
                data: { status: target },
            }).unwrap();

            toast.success(`Status successfully updated to ${ORDER_STATUS_LABELS[target] || target}`);
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
                {/* Left Column: Project Details & Scope */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="shadow-md border-muted/60">
                        <CardHeader className="border-b bg-muted/10">
                                    <CardTitle className="text-xl flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-primary" />
                                        Project Overview & Services Breakdown
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-6">
                                    <div>
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Overview / Abstract</h3>
                                        <div className="mt-2 text-foreground/90 leading-relaxed bg-muted/20 p-4 rounded-lg border border-dashed text-sm">
                                            {order.quotationSnapshot?.overview || "No detailed description provided for this order."}
                                        </div>
                                    </div>
                                    
                                    {/* Services Breakdown */}
                                    <div>
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Service Scope & Deliverables</h3>
                                        <div className="grid gap-5">
                                            {/* Services list if present */}
                                            {Array.isArray(order.quotationSnapshot?.services) && order.quotationSnapshot.services.length > 0 ? (
                                                order.quotationSnapshot.services.map((svc: any, idx: number) => {
                                                    const CATEGORY_NAMES: Record<string, string> = {
                                                        'web-development': 'Web Design & Development',
                                                        'marketing': 'Marketing & Growth',
                                                        'photo-editing': 'Photo Editing',
                                                        'video-editing': 'Video Editing',
                                                    };

                                                    const overviewText = (order.quotationSnapshot?.overview || "").trim().toLowerCase();
                                                    const rawScopeDesc = String(svc.scopeDescription || "").trim();
                                                    const isDuplicateOverview = rawScopeDesc && overviewText && (
                                                        rawScopeDesc.toLowerCase() === overviewText ||
                                                        overviewText.includes(rawScopeDesc.toLowerCase()) ||
                                                        rawScopeDesc.toLowerCase().includes(overviewText)
                                                    );
                                                    const displayDesc = isDuplicateOverview ? "" : rawScopeDesc;

                                                    return (
                                                        <div key={idx} className="p-5 rounded-xl border bg-card shadow-xs space-y-3">
                                                            <div className="flex items-center justify-between border-b pb-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                                                        <Package className="h-5 w-5" />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-bold text-base">{CATEGORY_NAMES[svc.category] || svc.category}</h4>
                                                                        {displayDesc && (
                                                                            <p className="text-xs text-muted-foreground">{displayDesc}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {canSeeFinancials && (
                                                                    <span className="font-black text-sm text-primary">
                                                                        {order.quotationSnapshot?.currency || "৳"}
                                                                        {(svc.basePrice || 0).toLocaleString()}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Scope Items */}
                                                            {Array.isArray(svc.scopeItems) && svc.scopeItems.length > 0 && (
                                                                <div className="space-y-1.5 pt-1">
                                                                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Features & Deliverables:</span>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {svc.scopeItems.map((item: string, i: number) => (
                                                                            <Badge key={i} variant="secondary" className="text-xs font-medium px-2.5 py-1">
                                                                                ✓ {item}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Line Items */}
                                                            {Array.isArray(svc.lineItems) && svc.lineItems.length > 0 && (
                                                                <div className="space-y-2 pt-2 border-t border-dashed">
                                                                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Included Pricing Items:</span>
                                                                    <div className="grid gap-2">
                                                                        {svc.lineItems.map((item: any, i: number) => (
                                                                            <div key={i} className="flex justify-between items-center text-xs p-2 bg-muted/30 rounded border">
                                                                                <div className="flex flex-col">
                                                                                    <span className="font-bold text-foreground">{item.title}</span>
                                                                                    {item.description && <span className="text-muted-foreground text-[11px]">{item.description}</span>}
                                                                                </div>
                                                                                {canSeeFinancials && (
                                                                                    <span className="font-bold">
                                                                                        {order.quotationSnapshot?.currency || "৳"}{(item.price || 0).toLocaleString()}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                /* Fallback to ScopeOfWork */
                                                order.quotationSnapshot?.scopeOfWork?.map((item: any, index: number) => (
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
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Custom Payment Milestones */}
                                    {Array.isArray(order.quotationSnapshot?.paymentMilestones) && order.quotationSnapshot.paymentMilestones.length > 0 && (
                                        <div className="border-t pt-5">
                                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Payment Terms & Milestones</h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {order.quotationSnapshot.paymentMilestones.map((m: any, idx: number) => {
                                                    const amount = ((order.quotationSnapshot?.grandTotal || 0) * (m.percentage || 0)) / 100;
                                                    return (
                                                        <div key={idx} className="p-3 bg-muted/20 rounded-lg border flex flex-col justify-between">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-bold text-xs">{m.label}</span>
                                                                <Badge variant="outline" className="text-[10px] font-black text-primary bg-primary/10 border-primary/20">
                                                                    {m.percentage}%
                                                                </Badge>
                                                            </div>
                                                            {canSeeFinancials && (
                                                                <span className="text-lg font-black text-foreground mt-2">
                                                                    {order.quotationSnapshot?.currency || "৳"}{amount.toLocaleString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                </div>

                {/* Right Column: Metadata & Financial Summary */}
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
                                            {order.quotationSnapshot?.currency || "৳"}
                                            {(order.quotationSnapshot?.grandTotal || 0).toLocaleString()}
                                        </>
                                    ) : (
                                        "******"
                                    )}
                                </h2>
                            </div>

                            <div className="space-y-3 pt-4">
                                {canSeeFinancials && order.quotationSnapshot?.totals && (
                                    <>
                                        <div className="flex justify-between items-center text-xs py-1 border-b border-dashed">
                                            <span className="text-muted-foreground">Subtotal</span>
                                            <span className="font-bold">{order.quotationSnapshot?.currency || "৳"}{(order.quotationSnapshot.totals.subtotal || 0).toLocaleString()}</span>
                                        </div>
                                        {order.quotationSnapshot.totals.discountAmount > 0 && (
                                            <div className="flex justify-between items-center text-xs py-1 border-b border-dashed text-emerald-600">
                                                <span>Discount</span>
                                                <span className="font-bold">-{order.quotationSnapshot?.currency || "৳"}{order.quotationSnapshot.totals.discountAmount.toLocaleString()}</span>
                                            </div>
                                        )}
                                        {order.quotationSnapshot.totals.taxAmount > 0 && (
                                            <div className="flex justify-between items-center text-xs py-1 border-b border-dashed">
                                                <span className="text-muted-foreground">Tax</span>
                                                <span className="font-bold">+{order.quotationSnapshot?.currency || "৳"}{order.quotationSnapshot.totals.taxAmount.toLocaleString()}</span>
                                            </div>
                                        )}
                                    </>
                                )}

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
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-muted-foreground text-sm">Last Update</span>
                                    <span className="font-medium text-sm text-foreground/70">
                                        {format(new Date(order.updatedAt), "MMM d, h:mm a")}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
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
        </div>
    );
}
