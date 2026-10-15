"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permissions";
import { InvoiceTab } from "@/components/photo-orders/InvoiceTab";
import { MetadataTab } from "@/components/photo-orders/MetadataTab";
import { OrdersTab } from "@/components/photo-orders/OrdersTab";

export default function PhotoOrdersPage() {
    const { can } = usePermissions();
    return (
        <div className="space-y-4 p-4 lg:p-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Photo Editing Orders</h1>
                <p className="text-sm text-muted-foreground">Create and track photo editing orders, manage services and file formats, and invoice clients by month.</p>
            </div>
            <Tabs defaultValue="orders">
                <TabsList>
                    <TabsTrigger value="orders">Orders</TabsTrigger>
                    {can("photoOrder.invoice") && <TabsTrigger value="invoice">Invoice</TabsTrigger>}
                    {can("photoOrder.manageMetadata") && <TabsTrigger value="metadata">Metadata</TabsTrigger>}
                </TabsList>
                <TabsContent value="orders" className="mt-4"><OrdersTab /></TabsContent>
                {can("photoOrder.invoice") && <TabsContent value="invoice" className="mt-4"><InvoiceTab /></TabsContent>}
                {can("photoOrder.manageMetadata") && <TabsContent value="metadata" className="mt-4"><MetadataTab /></TabsContent>}
            </Tabs>
        </div>
    );
}
