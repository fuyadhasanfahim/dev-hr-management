"use client";

import { useState } from "react";
import { Edit2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { SharedDialog } from "@/components/shared/shared-dialog";
import {
    useCreatePhotoFormatMutation,
    useCreatePhotoServiceMutation,
    useDeletePhotoFormatMutation,
    useDeletePhotoServiceMutation,
    useGetPhotoFormatsQuery,
    useGetPhotoServicesQuery,
    useUpdatePhotoFormatMutation,
    useUpdatePhotoServiceMutation,
} from "@/redux/features/photoOrder/photoOrderApi";
import type { PhotoReturnFormat, PhotoService } from "@/types/photo-order.type";

const apiError = (e: unknown, fallback: string) => (e as { data?: { message?: string } })?.data?.message || fallback;

interface Field {
    key: string;
    label: string;
    placeholder?: string;
    type?: "text" | "number" | "textarea";
}

/** One metadata list (services or return file formats): table, add/edit dialog, active switch and delete. */
function MetaSection<T extends { _id: string; name: string; isActive: boolean }>({
    title, description, noun, items, loading, fields, columns, toValues, onSave, onToggle, onDelete,
}: {
    title: string;
    description: string;
    noun: string;
    items: T[];
    loading: boolean;
    fields: Field[];
    columns: { head: string; cell: (i: T) => React.ReactNode; className?: string }[];
    toValues: (i: T) => Record<string, string>;
    onSave: (id: string | null, values: Record<string, string>) => Promise<void>;
    onToggle: (i: T) => Promise<void>;
    onDelete: (i: T) => Promise<void>;
}) {
    const [editing, setEditing] = useState<{ id: string | null; values: Record<string, string> } | null>(null);
    const [deleting, setDeleting] = useState<T | null>(null);
    const [busy, setBusy] = useState(false);

    const attempt = async (fn: () => Promise<void>, ok: string, fail: string) => {
        setBusy(true);
        try {
            await fn();
            toast.success(ok);
            return true;
        } catch (e) {
            toast.error(apiError(e, fail));
            return false;
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>
                <Button size="sm" onClick={() => setEditing({ id: null, values: Object.fromEntries(fields.map((f) => [f.key, ""])) })}><Plus className="mr-1 size-4" /> Add {noun}</Button>
            </CardHeader>
            <CardContent>
                <div className="overflow-hidden rounded-lg border">
                    <Table>
                        <TableHeader className="bg-muted/40">
                            <TableRow>
                                {columns.map((c) => <TableHead key={c.head} className={c.className}>{c.head}</TableHead>)}
                                <TableHead className="w-24">Active</TableHead>
                                <TableHead className="w-24 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && <TableRow><TableCell colSpan={columns.length + 2}><Skeleton className="h-6 w-full" /></TableCell></TableRow>}
                            {!loading && items.length === 0 && <TableRow><TableCell colSpan={columns.length + 2} className="py-8 text-center text-muted-foreground">No {noun}s yet</TableCell></TableRow>}
                            {items.map((i) => (
                                <TableRow key={i._id}>
                                    {columns.map((c) => <TableCell key={c.head} className={c.className}>{c.cell(i)}</TableCell>)}
                                    <TableCell><Switch checked={i.isActive} onCheckedChange={() => void attempt(() => onToggle(i), `${noun} ${i.isActive ? "deactivated" : "activated"}`, `Failed to update the ${noun}`)} /></TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing({ id: i._id, values: toValues(i) })}><Edit2 className="size-4" /></Button>
                                        <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setDeleting(i)}><Trash2 className="size-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            {editing && (
                <SharedDialog
                    open
                    onOpenChange={(o) => !o && setEditing(null)}
                    title={`${editing.id ? "Edit" : "Add"} ${noun}`}
                    footer={
                        <div className="flex justify-end gap-2 p-4">
                            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                            <Button disabled={busy} onClick={async () => { if (await attempt(() => onSave(editing.id, editing.values), `${noun} saved`, `Failed to save the ${noun}`)) setEditing(null); }}>
                                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}Save
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        {fields.map((f) => (
                            <div key={f.key} className="space-y-2">
                                <Label>{f.label}</Label>
                                {f.type === "textarea" ? (
                                    <Textarea rows={3} value={editing.values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setEditing({ ...editing, values: { ...editing.values, [f.key]: e.target.value } })} />
                                ) : (
                                    <Input type={f.type ?? "text"} min={f.type === "number" ? 0 : undefined} step={f.type === "number" ? "0.01" : undefined} value={editing.values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setEditing({ ...editing, values: { ...editing.values, [f.key]: e.target.value } })} />
                                )}
                            </div>
                        ))}
                    </div>
                </SharedDialog>
            )}

            <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this {noun}?</AlertDialogTitle>
                        <AlertDialogDescription>“{deleting?.name}” will be removed. If orders use it, it cannot be deleted — deactivate it instead.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => deleting && void attempt(() => onDelete(deleting), `${noun} deleted`, `Failed to delete the ${noun}`)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

export function MetadataTab() {
    const { data: svc, isLoading: l1 } = useGetPhotoServicesQuery({ limit: 1000 });
    const { data: fmt, isLoading: l2 } = useGetPhotoFormatsQuery({ limit: 1000 });
    const [createService] = useCreatePhotoServiceMutation();
    const [updateService] = useUpdatePhotoServiceMutation();
    const [deleteService] = useDeletePhotoServiceMutation();
    const [createFormat] = useCreatePhotoFormatMutation();
    const [updateFormat] = useUpdatePhotoFormatMutation();
    const [deleteFormat] = useDeletePhotoFormatMutation();

    return (
        <div className="grid gap-4 xl:grid-cols-2">
            <MetaSection<PhotoService>
                title="Services"
                description="Editing services you can add to an order. The price is the default per-image price; leave it 0 for none."
                noun="service"
                items={svc?.data ?? []}
                loading={l1}
                fields={[
                    { key: "name", label: "Name", placeholder: "e.g. Background removal" },
                    { key: "price", label: "Price per image", type: "number", placeholder: "0" },
                    { key: "description", label: "Description", type: "textarea" },
                ]}
                columns={[
                    { head: "Name", cell: (i) => <span className="font-medium">{i.name}</span> },
                    { head: "Price / image", cell: (i) => (i.price > 0 ? i.price : "—"), className: "tabular-nums" },
                ]}
                toValues={(i) => ({ name: i.name, price: String(i.price ?? 0), description: i.description ?? "" })}
                onSave={async (id, v) => {
                    const body = { name: v.name!.trim(), price: Number(v.price) || 0, description: v.description?.trim() ?? "" };
                    if (!body.name) throw { data: { message: "Name is required" } };
                    await (id ? updateService({ id, data: body }) : createService(body)).unwrap();
                }}
                onToggle={async (i) => void (await updateService({ id: i._id, data: { isActive: !i.isActive } }).unwrap())}
                onDelete={async (i) => void (await deleteService(i._id).unwrap())}
            />
            <MetaSection<PhotoReturnFormat>
                title="Return file formats"
                description="File formats the edited images can be returned in."
                noun="format"
                items={fmt?.data ?? []}
                loading={l2}
                fields={[
                    { key: "name", label: "Name", placeholder: "e.g. PNG" },
                    { key: "extension", label: "Extension", placeholder: "png" },
                    { key: "description", label: "Description", type: "textarea" },
                ]}
                columns={[
                    { head: "Name", cell: (i) => <span className="font-medium">{i.name}</span> },
                    { head: "Extension", cell: (i) => `.${i.extension}` },
                ]}
                toValues={(i) => ({ name: i.name, extension: i.extension, description: i.description ?? "" })}
                onSave={async (id, v) => {
                    const body = { name: v.name!.trim(), extension: v.extension!.trim(), description: v.description?.trim() ?? "" };
                    if (!body.name || !body.extension) throw { data: { message: "Name and extension are required" } };
                    await (id ? updateFormat({ id, data: body }) : createFormat(body)).unwrap();
                }}
                onToggle={async (i) => void (await updateFormat({ id: i._id, data: { isActive: !i.isActive } }).unwrap())}
                onDelete={async (i) => void (await deleteFormat(i._id).unwrap())}
            />
        </div>
    );
}
