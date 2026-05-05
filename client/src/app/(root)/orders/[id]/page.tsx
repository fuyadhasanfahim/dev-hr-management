"use client";

import { useParams, useRouter } from "next/navigation";
import { useGetOrderByIdQuery } from "@/redux/features/order/orderApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ArrowLeft, Package, Clock, CheckCircle, AlertCircle, FileText, LayoutDashboard } from "lucide-react";

export default function OrderDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const { data, isLoading, error } = useGetOrderByIdQuery(id);
    const order = data?.data;

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
                    <Button variant="default" size="sm">
                        Update Status
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Details */}
                <div className="lg:col-span-2 space-y-8">
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

                    {/* Timeline / History could go here */}
                </div>

                {/* Right Column: Metadata & Stats */}
                <div className="space-y-6">
                    <Card className="shadow-md border-muted/60 overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="text-lg">Financial Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 text-center">
                                <span className="text-muted-foreground text-sm font-medium">Grand Total</span>
                                <h2 className="text-4xl font-black text-primary mt-1">
                                    {order.quotationSnapshot?.currency === "USD" ? "$" : order.quotationSnapshot?.currency || "$"}
                                    {(order.quotationSnapshot?.grandTotal || 0).toLocaleString()}
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
