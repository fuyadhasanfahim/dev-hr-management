"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/shared/DatePicker";
import { DateTimePicker } from "@/components/shared/DateTimePicker";
import { useGetClientsQuery } from "@/redux/features/client/clientApi";
import {
    useCreatePhotoFormatMutation,
    useCreatePhotoServiceMutation,
    useGetPhotoFormatsQuery,
    useGetPhotoServicesQuery,
} from "@/redux/features/photoOrder/photoOrderApi";
import { PHOTO_PRIORITIES, PHOTO_PRIORITY_LABELS, type PhotoOrderInput, type PhotoOrderPriority } from "@/types/photo-order.type";
import { cn } from "@/lib/utils";

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: string) => (v === "" ? 0 : Math.max(0, Number(v) || 0));

interface Props {
    formId: string;
    defaultValues?: PhotoOrderInput;
    canManageMetadata: boolean;
    onSubmit: (data: PhotoOrderInput) => Promise<void>;
}

function Err({ msg }: { msg?: string }) {
    return msg ? <p className="text-xs text-destructive">{msg}</p> : null;
}

export function OrderForm({ formId, defaultValues: d, canManageMetadata, onSubmit }: Props) {
    const [orderName, setOrderName] = useState(d?.orderName ?? "");
    const [clientId, setClientId] = useState(d?.clientId ?? "");
    const [contactPersonId, setContactPersonId] = useState(d?.contactPersonId ?? "");
    const [orderDate, setOrderDate] = useState<Date | undefined>(d?.orderDate ? new Date(d.orderDate) : new Date());
    const [deadline, setDeadline] = useState<Date | undefined>(d?.deadline ? new Date(d.deadline) : undefined);
    const [qty, setQty] = useState(d?.imageQuantity ?? 1);
    const [perImage, setPerImage] = useState(d?.perImagePrice ?? 0);
    const [total, setTotal] = useState(d?.totalPrice ?? 0);
    const [serviceIds, setServiceIds] = useState<string[]>(d?.services ?? []);
    const [formatId, setFormatId] = useState(d?.returnFileFormat ?? "");
    const [priority, setPriority] = useState<PhotoOrderPriority>(d?.priority ?? "normal");
    const [instruction, setInstruction] = useState(d?.instruction ?? "");
    const [notes, setNotes] = useState(d?.notes ?? "");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [serviceSearch, setServiceSearch] = useState("");
    const [newService, setNewService] = useState<{ name: string; price: string } | null>(null);
    const [newFormat, setNewFormat] = useState<{ name: string; extension: string } | null>(null);

    const { data: clientsData, isLoading: loadingClients } = useGetClientsQuery({ status: "active", limit: 1000 });
    const { data: servicesData } = useGetPhotoServicesQuery({ isActive: true, limit: 1000 });
    const { data: formatsData } = useGetPhotoFormatsQuery({ isActive: true, limit: 1000 });
    const [createService, { isLoading: creatingService }] = useCreatePhotoServiceMutation();
    const [createFormat, { isLoading: creatingFormat }] = useCreatePhotoFormatMutation();

    const clients = useMemo(() => clientsData?.clients ?? [], [clientsData]);
    const services = useMemo(() => servicesData?.data ?? [], [servicesData]);
    const formats = useMemo(() => formatsData?.data ?? [], [formatsData]);
    const client = clients.find((c) => c._id === clientId);
    const members = client?.teamMembers ?? [];
    const visibleServices = services.filter((s) => s.name.toLowerCase().includes(serviceSearch.trim().toLowerCase()));

    // drop a contact person that doesn't belong to the newly chosen client
    useEffect(() => {
        if (contactPersonId && client && !members.some((m) => m._id === contactPersonId)) setContactPersonId("");
    }, [client, members, contactPersonId]);

    const clear = (k: string) => setErrors((e) => (e[k] ? Object.fromEntries(Object.entries(e).filter(([key]) => key !== k)) : e));

    // Price rules: the per-image price comes from the chosen services (0 when none has a price) and can be overridden.
    const setPerImageAndTotal = (p: number, q = qty) => {
        setPerImage(p);
        setTotal(round2(p * q));
    };
    const toggleService = (id: string) => {
        const next = serviceIds.includes(id) ? serviceIds.filter((x) => x !== id) : [...serviceIds, id];
        setServiceIds(next);
        clear("services");
        setPerImageAndTotal(round2(next.reduce((a, sid) => a + (services.find((s) => s._id === sid)?.price ?? 0), 0)));
    };
    const changeQty = (q: number) => {
        setQty(q);
        setTotal(round2(perImage * q));
        clear("imageQuantity");
    };
    const changeTotal = (t: number) => {
        setTotal(t);
        if (qty > 0) setPerImage(round2(t / qty));
    };

    const addService = async () => {
        if (!newService?.name.trim()) return toast.error("Service name is required");
        try {
            const created = await createService({ name: newService.name.trim(), price: num(newService.price) }).unwrap();
            setNewService(null);
            toggleService(created._id);
            toast.success("Service created");
        } catch (e) {
            toast.error((e as { data?: { message?: string } })?.data?.message || "Failed to create service");
        }
    };
    const addFormat = async () => {
        if (!newFormat?.name.trim() || !newFormat.extension.trim()) return toast.error("Format name and extension are required");
        try {
            const created = await createFormat({ name: newFormat.name.trim(), extension: newFormat.extension.trim() }).unwrap();
            setFormatId(created._id);
            clear("returnFileFormat");
            setNewFormat(null);
            toast.success("File format created");
        } catch (e) {
            toast.error((e as { data?: { message?: string } })?.data?.message || "Failed to create file format");
        }
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs: Record<string, string> = {};
        if (!orderName.trim()) errs.orderName = "Order name is required";
        if (!clientId) errs.clientId = "Select a client";
        if (!orderDate) errs.orderDate = "Order date is required";
        if (!deadline) errs.deadline = "Deadline is required";
        else if (orderDate && deadline < orderDate) errs.deadline = "Deadline cannot be before the order date";
        if (!Number.isInteger(qty) || qty < 1) errs.imageQuantity = "At least 1 image is required";
        if (!serviceIds.length) errs.services = "Select at least one service";
        if (!formatId) errs.returnFileFormat = "Select a return file format";
        setErrors(errs);
        if (Object.keys(errs).length) return toast.error("Please fix the highlighted fields");
        await onSubmit({
            orderName: orderName.trim(),
            clientId,
            ...(contactPersonId ? { contactPersonId } : {}),
            orderDate: format(orderDate!, "yyyy-MM-dd"),
            deadline: deadline!.toISOString(),
            imageQuantity: qty,
            perImagePrice: perImage,
            totalPrice: total,
            services: serviceIds,
            returnFileFormat: formatId,
            instruction: instruction.trim(),
            notes: notes.trim(),
            priority,
        });
    };

    return (
        <form id={formId} onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
                <Label>Order name <span className="text-destructive">*</span></Label>
                <Input value={orderName} onChange={(e) => { setOrderName(e.target.value); clear("orderName"); }} placeholder="e.g. Product photo editing — batch 1" />
                <Err msg={errors.orderName} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label>Client <span className="text-destructive">*</span></Label>
                    <Combobox
                        options={clients.map((c) => ({ value: c._id, label: c.name, description: c.clientId || c.emails?.[0] }))}
                        value={clientId}
                        onChange={(v) => { setClientId(v); clear("clientId"); }}
                        placeholder="Search or select a client"
                        searchPlaceholder="Search by name or ID…"
                        emptyText="No client found"
                        isLoading={loadingClients}
                        className="w-full"
                    />
                    <Err msg={errors.clientId} />
                </div>
                <div className="space-y-2">
                    <Label>Contact person</Label>
                    <Select value={contactPersonId || "none"} onValueChange={(v) => setContactPersonId(v === "none" ? "" : v)} disabled={!members.length}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {members.filter((m) => m._id).map((m) => <SelectItem key={m._id} value={m._id!}>{m.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <DatePicker label={<>Order date <span className="text-destructive">*</span></>} value={orderDate} onChange={(v) => { setOrderDate(v); clear("orderDate"); }} />
                    <Err msg={errors.orderDate} />
                </div>
                <div className="space-y-2">
                    <DateTimePicker label="Deadline *" value={deadline} onChange={(v) => { setDeadline(v); clear("deadline"); }} />
                    <Err msg={errors.deadline} />
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                    <Label>Images <span className="text-destructive">*</span></Label>
                    <Input type="number" min={1} step={1} value={qty || ""} onChange={(e) => changeQty(Math.floor(num(e.target.value)))} />
                    <Err msg={errors.imageQuantity} />
                </div>
                <div className="space-y-2">
                    <Label>Price per image</Label>
                    <Input type="number" min={0} step="0.01" value={perImage || ""} placeholder="0" onChange={(e) => setPerImageAndTotal(num(e.target.value))} />
                </div>
                <div className="space-y-2">
                    <Label>Total price</Label>
                    <Input type="number" min={0} step="0.01" value={total || ""} placeholder="0" onChange={(e) => changeTotal(num(e.target.value))} />
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <Label>Services <span className="text-destructive">*</span></Label>
                    {!newService && (
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-primary" onClick={() => setNewService({ name: "", price: "" })}>
                            <Plus className="mr-1 size-3.5" /> New service
                        </Button>
                    )}
                </div>
                {newService && (
                    <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3">
                        <div className="min-w-40 flex-1 space-y-1">
                            <Label className="text-xs">Name</Label>
                            <Input value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} placeholder="e.g. Background removal" />
                        </div>
                        <div className="w-28 space-y-1">
                            <Label className="text-xs">Price / image</Label>
                            <Input type="number" min={0} step="0.01" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })} placeholder="0" />
                        </div>
                        <Button type="button" size="sm" disabled={creatingService} onClick={addService}>{creatingService && <Loader2 className="mr-1 size-3.5 animate-spin" />}Add</Button>
                        <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => setNewService(null)}><X className="size-4" /></Button>
                    </div>
                )}
                <Input value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} placeholder="Search services…" className="h-9" />
                <div className={cn("max-h-44 space-y-1 overflow-y-auto rounded-lg border p-2", errors.services && "border-destructive")}>
                    {visibleServices.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No services found. Create one above{canManageMetadata ? " or in the Metadata tab" : ""}.</p>}
                    {visibleServices.map((s) => (
                        <label key={s._id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                            <Checkbox checked={serviceIds.includes(s._id)} onCheckedChange={() => toggleService(s._id)} />
                            <span className="flex-1">{s.name}</span>
                            <span className="text-xs text-muted-foreground">{s.price > 0 ? `${s.price} / image` : "no price"}</span>
                        </label>
                    ))}
                </div>
                <Err msg={errors.services} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <Label>Return file format <span className="text-destructive">*</span></Label>
                        {!newFormat && (
                            <Button type="button" variant="ghost" size="sm" className="h-7 text-primary" onClick={() => setNewFormat({ name: "", extension: "" })}>
                                <Plus className="mr-1 size-3.5" /> New
                            </Button>
                        )}
                    </div>
                    {newFormat ? (
                        <div className="flex items-end gap-2 rounded-lg border bg-muted/30 p-3">
                            <div className="flex-1 space-y-1"><Label className="text-xs">Name</Label><Input value={newFormat.name} onChange={(e) => setNewFormat({ ...newFormat, name: e.target.value })} placeholder="PNG" /></div>
                            <div className="w-24 space-y-1"><Label className="text-xs">Extension</Label><Input value={newFormat.extension} onChange={(e) => setNewFormat({ ...newFormat, extension: e.target.value })} placeholder="png" /></div>
                            <Button type="button" size="sm" disabled={creatingFormat} onClick={addFormat}>{creatingFormat && <Loader2 className="mr-1 size-3.5 animate-spin" />}Add</Button>
                            <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => setNewFormat(null)}><X className="size-4" /></Button>
                        </div>
                    ) : (
                        <Select value={formatId} onValueChange={(v) => { setFormatId(v); clear("returnFileFormat"); }}>
                            <SelectTrigger className={cn("w-full", errors.returnFileFormat && "border-destructive")}><SelectValue placeholder="Select a format" /></SelectTrigger>
                            <SelectContent>{formats.map((f) => <SelectItem key={f._id} value={f._id}>{f.name} (.{f.extension})</SelectItem>)}</SelectContent>
                        </Select>
                    )}
                    <Err msg={errors.returnFileFormat} />
                </div>
                <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as PhotoOrderPriority)}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{PHOTO_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PHOTO_PRIORITY_LABELS[p]}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label>Instructions</Label>
                <Textarea rows={3} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Editing instructions for this order" />
            </div>
            <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes" />
            </div>
        </form>
    );
}
