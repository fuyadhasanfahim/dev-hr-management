"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { FileText, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { BdtInvoiceNotice, hasNoPaymentLink } from "@/components/shared/BdtInvoiceNotice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/use-permissions";
import {
    useCreatePhotoInvoiceMutation,
    useGetInvoiceClientsQuery,
    useGetInvoiceOrdersQuery,
    useGetPhotoInvoicesQuery,
    useGetPhotoOrderYearsQuery,
} from "@/redux/features/photoOrder/photoOrderApi";
import { cn } from "@/lib/utils";
import { InvoiceViewer } from "./InvoiceViewer";
import { MONTHS, money } from "./helpers";

export function InvoiceTab() {
    const { can } = usePermissions();
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [clientId, setClientId] = useState("");
    const [search, setSearch] = useState("");
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const [viewing, setViewing] = useState<string | null>(null);

    const { data: years } = useGetPhotoOrderYearsQuery();
    const yearOptions = useMemo(() => [...new Set([now.getFullYear(), ...(years ?? [])])].sort((a, b) => b - a), [years]); // eslint-disable-line react-hooks/exhaustive-deps
    const { data: clients, isLoading: loadingClients } = useGetInvoiceClientsQuery({ month, year });
    const { data: orders, isFetching: loadingOrders } = useGetInvoiceOrdersQuery({ clientId, month, year }, { skip: !clientId });
    const { data: invoices } = useGetPhotoInvoicesQuery({ month, year });
    const [createInvoice, { isLoading: creating }] = useCreatePhotoInvoiceMutation();

    const row = clients?.find((r) => r.client._id === clientId);
    const visibleClients = (clients ?? []).filter((r) => r.client.name.toLowerCase().includes(search.trim().toLowerCase()));
    const currency = row?.client.currency || "USD";
    const free = (orders ?? []).filter((o) => !o.invoiceId);
    const chosen = free.filter((o) => picked.has(o._id));
    const totals = { images: chosen.reduce((a, o) => a + o.imageQuantity, 0), amount: chosen.reduce((a, o) => a + o.totalPrice, 0) };

    const changePeriod = (fn: () => void) => {
        fn();
        setClientId("");
        setPicked(new Set());
    };

    const [bdtNotice, setBdtNotice] = useState(false);

    // BDT can't be paid through Stripe/PayPal, so tell the user before the invoice is made without a payment link.
    const requestGenerate = () => (hasNoPaymentLink(currency) ? setBdtNotice(true) : void generate());

    const generate = async () => {
        try {
            const inv = await createInvoice({ clientId, month, year, orderIds: [...picked] }).unwrap();
            toast.success(`Invoice ${inv.invoiceNumber} created`);
            setPicked(new Set());
            setViewing(inv._id);
        } catch (e) {
            toast.error((e as { data?: { message?: string } })?.data?.message || "Failed to create the invoice");
        }
    };

    return (
        <div className="space-y-4">
            <BdtInvoiceNotice open={bdtNotice} onOpenChange={setBdtNotice} onConfirm={() => void generate()} />
            <div className="flex flex-wrap items-center gap-2">
                <Select value={String(month)} onValueChange={(v) => changePeriod(() => setMonth(Number(v)))}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={String(year)} onValueChange={(v) => changePeriod(() => setYear(Number(v)))}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>{yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">Clients with orders in {MONTHS[month - 1]} {year}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                <Card className="gap-3 py-4">
                    <CardHeader className="px-4">
                        <CardTitle className="text-base">Clients</CardTitle>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                            <Input className="pl-8" placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                    </CardHeader>
                    <CardContent className="max-h-[60vh] space-y-1 overflow-y-auto px-2">
                        {loadingClients && <Skeleton className="mx-2 h-12" />}
                        {!loadingClients && visibleClients.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No clients with orders this month</p>}
                        {visibleClients.map((r) => (
                            <button
                                key={r.client._id}
                                type="button"
                                onClick={() => { setClientId(r.client._id); setPicked(new Set()); }}
                                className={cn("w-full rounded-lg px-3 py-2 text-left transition hover:bg-muted/60", clientId === r.client._id && "bg-primary/10 ring-1 ring-primary/30")}
                            >
                                <p className="truncate text-sm font-medium">{r.client.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {r.orders} order{r.orders === 1 ? "" : "s"} · {r.images.toLocaleString("en-US")} images
                                    {r.uninvoiced === 0 ? " · all invoiced" : ` · ${r.uninvoiced} to invoice`}
                                </p>
                            </button>
                        ))}
                    </CardContent>
                </Card>

                <Card className="gap-3 py-4">
                    <CardHeader className="px-4">
                        <CardTitle className="text-base">{row ? row.client.name : "Orders"}</CardTitle>
                        <CardDescription>{row ? "Tick the orders to put on this invoice." : "Select a client to see their orders."}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 px-4">
                        {clientId && (
                            <div className="overflow-hidden rounded-lg border">
                                <Table>
                                    <TableHeader className="bg-muted/40">
                                        <TableRow>
                                            <TableHead className="w-10">
                                                <Checkbox
                                                    checked={free.length > 0 && chosen.length === free.length}
                                                    disabled={!free.length}
                                                    onCheckedChange={(c) => setPicked(c ? new Set(free.map((o) => o._id)) : new Set())}
                                                />
                                            </TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Order</TableHead>
                                            <TableHead className="text-right">Images</TableHead>
                                            <TableHead className="text-right">Per image</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loadingOrders && <TableRow><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>}
                                        {(orders ?? []).map((o) => (
                                            <TableRow key={o._id} className={cn(o.invoiceId && "opacity-60")}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={picked.has(o._id)}
                                                        disabled={!!o.invoiceId}
                                                        onCheckedChange={(c) => setPicked((p) => { const n = new Set(p); if (c) n.add(o._id); else n.delete(o._id); return n; })}
                                                    />
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-muted-foreground">{format(new Date(o.orderDate), "dd MMM yyyy")}</TableCell>
                                                <TableCell className="font-medium">
                                                    {o.orderName}
                                                    {o.invoiceNumber && <Badge variant="outline" className="ml-2 text-[10px]">{o.invoiceNumber}</Badge>}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">{o.imageQuantity.toLocaleString("en-US")}</TableCell>
                                                <TableCell className="text-right tabular-nums">{money(o.perImagePrice, currency)}</TableCell>
                                                <TableCell className="text-right font-semibold tabular-nums">{money(o.totalPrice, currency)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                        {clientId && (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm text-muted-foreground">
                                    {chosen.length} selected · {totals.images.toLocaleString("en-US")} images · <span className="font-semibold text-foreground">{money(totals.amount, currency)}</span>
                                </p>
                                {can("photoOrder.invoice") && (
                                    <Button disabled={!chosen.length || creating} onClick={requestGenerate}>
                                        {creating ? <Loader2 className="mr-1 size-4 animate-spin" /> : <FileText className="mr-1 size-4" />}Generate invoice
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="gap-3 py-4">
                <CardHeader className="px-4"><CardTitle className="text-base">Invoices — {MONTHS[month - 1]} {year}</CardTitle></CardHeader>
                <CardContent className="px-4">
                    <div className="overflow-hidden rounded-lg border">
                        <Table>
                            <TableHeader className="bg-muted/40">
                                <TableRow><TableHead>Invoice</TableHead><TableHead>Client</TableHead><TableHead className="text-right">Images</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {(invoices ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No invoices for this month yet</TableCell></TableRow>}
                                {(invoices ?? []).map((inv) => (
                                    <TableRow key={inv._id}>
                                        <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                                        <TableCell>{typeof inv.clientId === "object" ? inv.clientId.name : "—"}</TableCell>
                                        <TableCell className="text-right tabular-nums">{inv.totalImages.toLocaleString("en-US")}</TableCell>
                                        <TableCell className="text-right font-semibold tabular-nums">{money(inv.totalAmount, inv.currency)}</TableCell>
                                        <TableCell><Badge variant={inv.paymentStatus === "paid" ? "default" : "outline"}>{inv.paymentStatus === "paid" ? "Paid" : "Unpaid"}</Badge></TableCell>
                                        <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => setViewing(inv._id)}>Open</Button></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {viewing && <InvoiceViewer invoiceId={viewing} canDelete={can("photoOrder.invoice")} onClose={() => setViewing(null)} />}
        </div>
    );
}
