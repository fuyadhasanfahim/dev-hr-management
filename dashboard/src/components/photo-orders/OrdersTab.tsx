"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Edit2, Eye, FileText, History, Loader2, MoreHorizontal, Plus, RotateCcw, Search, Trash2, CalendarClock } from "lucide-react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/shared/DateTimePicker";
import { SharedDialog } from "@/components/shared/shared-dialog";
import { OrderPagination } from "@/components/order/OrderPagination";
import { usePermissions } from "@/hooks/use-permissions";
import {
    useAddPhotoOrderRevisionMutation,
    useChangePhotoOrderStatusMutation,
    useCreatePhotoOrderMutation,
    useDeletePhotoOrderMutation,
    useExtendPhotoOrderDeadlineMutation,
    useGetPhotoOrderStatsQuery,
    useGetPhotoOrderYearsQuery,
    useGetPhotoOrdersQuery,
    useUpdatePhotoOrderMutation,
} from "@/redux/features/photoOrder/photoOrderApi";
import {
    PHOTO_PRIORITIES,
    PHOTO_PRIORITY_LABELS,
    PHOTO_STATUSES,
    PHOTO_STATUS_LABELS,
    PHOTO_STATUS_WORKFLOW,
    type PhotoOrder,
    type PhotoOrderFilters,
    type PhotoOrderInput,
    type PhotoOrderPriority,
    type PhotoOrderStatus,
} from "@/types/photo-order.type";
import { cn } from "@/lib/utils";
import { OrderForm } from "./OrderForm";
import { MONTHS, money } from "./helpers";

const STATUS_COLORS: Record<PhotoOrderStatus, string> = {
    pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
    in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    quality_check: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
    revision: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    ready_to_deliver: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
    completed: "bg-green-500/15 text-green-700 dark:text-green-400",
    delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    cancelled: "bg-red-500/15 text-red-700 dark:text-red-400",
};
const PRIORITY_COLORS: Record<PhotoOrderPriority, string> = {
    low: "bg-muted text-muted-foreground",
    normal: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    high: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    urgent: "bg-red-500/15 text-red-700 dark:text-red-400",
};

const apiError = (e: unknown, fallback: string) => (e as { data?: { message?: string } })?.data?.message || fallback;
const fmt = (v?: string, f = "dd MMM yyyy") => (v ? format(new Date(v), f) : "—");

const toInput = (o: PhotoOrder): PhotoOrderInput => ({
    orderName: o.orderName,
    clientId: o.clientId._id,
    ...(o.contactPersonId ? { contactPersonId: o.contactPersonId } : {}),
    orderDate: o.orderDate,
    deadline: o.deadline,
    imageQuantity: o.imageQuantity,
    perImagePrice: o.perImagePrice,
    totalPrice: o.totalPrice,
    services: o.services.map((s) => s._id),
    returnFileFormat: o.returnFileFormat._id,
    instruction: o.instruction ?? "",
    notes: o.notes ?? "",
    priority: o.priority,
});

type Dialog = { kind: "create" } | { kind: "edit" | "view" | "status" | "extend" | "revision" | "delete"; order: PhotoOrder } | null;

export function OrdersTab() {
    const { can } = usePermissions();
    const [filters, setFilters] = useState<PhotoOrderFilters>({ limit: 10 });
    const [page, setPage] = useState(1);
    const [dialog, setDialog] = useState<Dialog>(null);
    const close = () => setDialog(null);

    const { data, isLoading, isFetching } = useGetPhotoOrdersQuery({ ...filters, page });
    const { data: stats } = useGetPhotoOrderStatsQuery();
    const { data: years } = useGetPhotoOrderYearsQuery();
    const orders = data?.data ?? [];
    const meta = data?.meta;
    const canUpdate = can("photoOrder.update");

    const set = <K extends keyof PhotoOrderFilters>(k: K, v: PhotoOrderFilters[K] | "all" | "") => {
        setFilters((f) => ({ ...f, [k]: v === "all" || v === "" ? undefined : v }));
        setPage(1);
    };

    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    ["Total orders", stats?.total],
                    ["Total images", stats?.totalImages],
                    ["In progress", stats && (stats.byStatus.in_progress ?? 0)],
                    ["Delivered", stats && (stats.byStatus.delivered ?? 0)],
                ].map(([label, v]) => (
                    <Card key={label as string} className="py-4">
                        <CardContent className="px-4">
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <div className="mt-1 text-2xl font-bold tabular-nums">{v === undefined ? <Skeleton className="h-8 w-16" /> : Number(v).toLocaleString("en-US")}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="flex flex-wrap items-end gap-2">
                <div className="relative min-w-52 flex-1">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input className="pl-8" placeholder="Search order or client…" onChange={(e) => set("search", e.target.value)} />
                </div>
                <Select value={filters.status ?? "all"} onValueChange={(v) => set("status", v as PhotoOrderStatus | "all")}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {PHOTO_STATUSES.map((s) => <SelectItem key={s} value={s}>{PHOTO_STATUS_LABELS[s]}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filters.priority ?? "all"} onValueChange={(v) => set("priority", v as PhotoOrderPriority | "all")}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All priorities</SelectItem>
                        {PHOTO_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PHOTO_PRIORITY_LABELS[p]}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filters.month ? String(filters.month) : "all"} onValueChange={(v) => set("month", v === "all" ? undefined : Number(v))}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Month" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All months</SelectItem>
                        {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filters.year ? String(filters.year) : "all"} onValueChange={(v) => set("year", v === "all" ? undefined : Number(v))}>
                    <SelectTrigger className="w-28"><SelectValue placeholder="Year" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All years</SelectItem>
                        {(years ?? []).map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                </Select>
                {can("photoOrder.create") && (
                    <Button onClick={() => setDialog({ kind: "create" })}><Plus className="mr-1 size-4" /> New order</Button>
                )}
            </div>

            <div className="overflow-hidden rounded-lg border">
                <Table>
                    <TableHeader className="bg-muted/40">
                        <TableRow>
                            <TableHead className="pl-4">Order</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Deadline</TableHead>
                            <TableHead className="text-right">Images</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead className="pr-4 text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && Array.from({ length: 5 }, (_, i) => <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)}
                        {!isLoading && orders.length === 0 && <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No orders found</TableCell></TableRow>}
                        {orders.map((o) => {
                            const next = PHOTO_STATUS_WORKFLOW[o.status];
                            return (
                                <TableRow key={o._id}>
                                    <TableCell className="max-w-56 truncate pl-4 font-medium">
                                        {o.orderName}
                                        {o.invoiceNumber && <Badge variant="outline" className="ml-2 gap-1 text-[10px]"><FileText className="size-3" />{o.invoiceNumber}{o.isPaid ? " · paid" : ""}</Badge>}
                                    </TableCell>
                                    <TableCell>{o.clientId?.name ?? "—"}</TableCell>
                                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmt(o.orderDate)}</TableCell>
                                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmt(o.deadline, "dd MMM, h:mm a")}</TableCell>
                                    <TableCell className="text-right tabular-nums">{o.imageQuantity.toLocaleString("en-US")}</TableCell>
                                    <TableCell className="text-right font-semibold tabular-nums">{money(o.totalPrice, o.clientId?.currency)}</TableCell>
                                    <TableCell><Badge className={cn("border-0", STATUS_COLORS[o.status])}>{PHOTO_STATUS_LABELS[o.status]}</Badge></TableCell>
                                    <TableCell><Badge className={cn("border-0", PRIORITY_COLORS[o.priority])}>{PHOTO_PRIORITY_LABELS[o.priority]}</Badge></TableCell>
                                    <TableCell className="pr-4 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => setDialog({ kind: "view", order: o })}><Eye className="mr-2 size-4" />View details</DropdownMenuItem>
                                                {canUpdate && <DropdownMenuItem disabled={!!o.invoiceId} onClick={() => setDialog({ kind: "edit", order: o })}><Edit2 className="mr-2 size-4" />Edit</DropdownMenuItem>}
                                                {can("photoOrder.changeStatus") && <DropdownMenuItem disabled={!next.length} onClick={() => setDialog({ kind: "status", order: o })}><History className="mr-2 size-4" />Change status</DropdownMenuItem>}
                                                {canUpdate && <DropdownMenuItem onClick={() => setDialog({ kind: "extend", order: o })}><CalendarClock className="mr-2 size-4" />Extend deadline</DropdownMenuItem>}
                                                {canUpdate && <DropdownMenuItem disabled={!next.includes("revision")} onClick={() => setDialog({ kind: "revision", order: o })}><RotateCcw className="mr-2 size-4" />Request revision</DropdownMenuItem>}
                                                {can("photoOrder.delete") && (<><DropdownMenuSeparator /><DropdownMenuItem disabled={!!o.invoiceId} className="text-destructive" onClick={() => setDialog({ kind: "delete", order: o })}><Trash2 className="mr-2 size-4" />Delete</DropdownMenuItem></>)}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            {meta && (
                <OrderPagination
                    currentPage={meta.page}
                    totalPages={meta.totalPages}
                    limit={meta.limit}
                    onPageChange={setPage}
                    onLimitChange={(l) => { setFilters((f) => ({ ...f, limit: l })); setPage(1); }}
                    isLoading={isFetching}
                />
            )}

            <OrderDialogs dialog={dialog} onClose={close} canMeta={can("photoOrder.manageMetadata")} />
        </div>
    );
}

function OrderDialogs({ dialog, onClose, canMeta }: { dialog: Dialog; onClose: () => void; canMeta: boolean }) {
    const [createOrder, { isLoading: creating }] = useCreatePhotoOrderMutation();
    const [updateOrder, { isLoading: updating }] = useUpdatePhotoOrderMutation();
    const [deleteOrder, { isLoading: deleting }] = useDeletePhotoOrderMutation();
    const [changeStatus, { isLoading: changing }] = useChangePhotoOrderStatusMutation();
    const [extend, { isLoading: extending }] = useExtendPhotoOrderDeadlineMutation();
    const [addRevision, { isLoading: revising }] = useAddPhotoOrderRevisionMutation();
    const [status, setStatus] = useState<PhotoOrderStatus | "">("");
    const [note, setNote] = useState("");
    const [deadline, setDeadline] = useState<Date | undefined>();

    // reset the small dialogs' fields whenever a different dialog opens
    const key = dialog ? `${dialog.kind}-${"order" in dialog ? dialog.order._id : "new"}` : "";
    const [lastKey, setLastKey] = useState("");
    if (key !== lastKey) {
        setLastKey(key);
        setStatus("");
        setNote("");
        setDeadline(undefined);
    }

    const run = async (fn: () => Promise<unknown>, ok: string, fail: string) => {
        try {
            await fn();
            toast.success(ok);
            onClose();
        } catch (e) {
            toast.error(apiError(e, fail));
        }
    };

    if (!dialog) return null;
    const open = true;
    const order = "order" in dialog ? dialog.order : undefined;

    if (dialog.kind === "create" || dialog.kind === "edit") {
        const edit = dialog.kind === "edit" ? dialog.order : undefined;
        const busy = creating || updating;
        return (
            <SharedDialog
                open={open}
                onOpenChange={(o) => !o && onClose()}
                title={edit ? "Edit order" : "New photo editing order"}
                description="Client, schedule, services and pricing for this order."
                className="sm:max-w-3xl md:max-w-3xl"
                footer={
                    <div className="flex justify-end gap-2 p-4">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" form="photo-order-form" disabled={busy}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}{edit ? "Save changes" : "Create order"}</Button>
                    </div>
                }
            >
                <OrderForm
                    formId="photo-order-form"
                    canManageMetadata={canMeta}
                    {...(edit ? { defaultValues: toInput(edit) } : {})}
                    onSubmit={(data) =>
                        run(
                            () => (edit ? updateOrder({ id: edit._id, data }).unwrap() : createOrder(data).unwrap()),
                            edit ? "Order updated" : "Order created",
                            "Failed to save the order",
                        )
                    }
                />
            </SharedDialog>
        );
    }

    if (dialog.kind === "view" && order) {
        return (
            <SharedDialog open={open} onOpenChange={(o) => !o && onClose()} title={order.orderName} description={`${order.clientId?.name ?? ""} · ${PHOTO_STATUS_LABELS[order.status]}`} className="sm:max-w-2xl md:max-w-2xl">
                <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                    {[
                        ["Order date", fmt(order.orderDate)],
                        ["Deadline", fmt(order.deadline, "dd MMM yyyy, h:mm a")],
                        ["Images", order.imageQuantity.toLocaleString("en-US")],
                        ["Per image", money(order.perImagePrice, order.clientId?.currency)],
                        ["Total", money(order.totalPrice, order.clientId?.currency)],
                        ["Priority", PHOTO_PRIORITY_LABELS[order.priority]],
                        ["Services", order.services.map((s) => s.name).join(", ") || "—"],
                        ["Return format", `${order.returnFileFormat?.name ?? "—"} (.${order.returnFileFormat?.extension ?? ""})`],
                        ["Invoice", order.invoiceNumber ? `${order.invoiceNumber}${order.isPaid ? " (paid)" : ""}` : "Not invoiced"],
                        ["Revisions", String(order.revisionCount)],
                    ].map(([k, v]) => (
                        <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
                    ))}
                    {order.instruction && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Instructions</dt><dd className="whitespace-pre-wrap">{order.instruction}</dd></div>}
                    {order.notes && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Notes</dt><dd className="whitespace-pre-wrap">{order.notes}</dd></div>}
                </dl>
                <h4 className="mb-2 mt-6 text-sm font-semibold">Timeline</h4>
                <ol className="space-y-2 border-l pl-4">
                    {[...order.timeline].reverse().map((t, i) => (
                        <li key={i} className="relative text-sm">
                            <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" />
                            <span className="font-medium">{PHOTO_STATUS_LABELS[t.status]}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{fmt(t.timestamp, "dd MMM yyyy, h:mm a")}</span>
                            {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
                        </li>
                    ))}
                </ol>
            </SharedDialog>
        );
    }

    if (dialog.kind === "status" && order) {
        const next = PHOTO_STATUS_WORKFLOW[order.status];
        return (
            <SharedDialog
                open={open}
                onOpenChange={(o) => !o && onClose()}
                title="Change status"
                description={`${order.orderName} is currently ${PHOTO_STATUS_LABELS[order.status].toLowerCase()}.`}
                footer={<div className="flex justify-end gap-2 p-4"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!status || changing} onClick={() => run(() => changeStatus({ id: order._id, status: status as PhotoOrderStatus, ...(note.trim() ? { note: note.trim() } : {}) }).unwrap(), "Status updated", "Failed to update status")}>{changing && <Loader2 className="mr-2 size-4 animate-spin" />}Update</Button></div>}
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>New status</Label>
                        <Select value={status} onValueChange={(v) => setStatus(v as PhotoOrderStatus)}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
                            <SelectContent>{next.map((s) => <SelectItem key={s} value={s}>{PHOTO_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2"><Label>Note (optional)</Label><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
                </div>
            </SharedDialog>
        );
    }

    if (dialog.kind === "extend" && order) {
        return (
            <SharedDialog
                open={open}
                onOpenChange={(o) => !o && onClose()}
                title="Extend deadline"
                description={`Current deadline: ${fmt(order.deadline, "dd MMM yyyy, h:mm a")}`}
                footer={<div className="flex justify-end gap-2 p-4"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!deadline || extending} onClick={() => run(() => extend({ id: order._id, deadline: deadline!.toISOString(), ...(note.trim() ? { reason: note.trim() } : {}) }).unwrap(), "Deadline extended", "Failed to extend the deadline")}>{extending && <Loader2 className="mr-2 size-4 animate-spin" />}Extend</Button></div>}
            >
                <div className="space-y-4">
                    <DateTimePicker label="New deadline" value={deadline} onChange={setDeadline} />
                    <div className="space-y-2"><Label>Reason (optional)</Label><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
                </div>
            </SharedDialog>
        );
    }

    if (dialog.kind === "revision" && order) {
        return (
            <SharedDialog
                open={open}
                onOpenChange={(o) => !o && onClose()}
                title="Request revision"
                description={order.orderName}
                footer={<div className="flex justify-end gap-2 p-4"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!note.trim() || revising} onClick={() => run(() => addRevision({ id: order._id, instruction: note.trim() }).unwrap(), "Revision requested", "Failed to request the revision")}>{revising && <Loader2 className="mr-2 size-4 animate-spin" />}Request revision</Button></div>}
            >
                <div className="space-y-2"><Label>What needs to change?</Label><Textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </SharedDialog>
        );
    }

    if (dialog.kind === "delete" && order) {
        return (
            <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this order?</AlertDialogTitle>
                        <AlertDialogDescription>“{order.orderName}” will be permanently deleted. This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction disabled={deleting} className="bg-rose-600 text-white hover:bg-rose-700" onClick={(e) => { e.preventDefault(); void run(() => deleteOrder(order._id).unwrap(), "Order deleted", "Failed to delete the order"); }}>
                            {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        );
    }
    return null;
}
