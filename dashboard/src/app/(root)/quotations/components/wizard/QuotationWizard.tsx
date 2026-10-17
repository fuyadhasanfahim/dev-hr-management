'use client';

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    IconArrowLeft,
    IconArrowRight,
    IconBuilding,
    IconCalendar,
    IconMinus,
    IconArrowsMaximize,
    IconArrowsMinimize,
    IconDownload,
    IconMapPin,
    IconMail,
    IconPhone,
    IconWorld,
    IconSend,
    IconBulb,
    IconCrown,
    IconClock,
    IconBox,
    IconUsers,
    IconUserPlus,
    IconCheck,
    IconCircleCheck,
    IconCode,
    IconDeviceFloppy,
    IconGripVertical,
    IconInfoCircle,
    IconPencil,
    IconStarFilled,
    IconFileText,
    IconPlus,
    IconReceipt,
    IconSettings,
    IconShieldCheck,
    IconTrash,
    IconUser,
    IconX,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Combobox } from "@/components/ui/combobox";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { useCreateClientMutation, useGetClientsQuery } from "@/redux/features/client/clientApi";
import { useCreateQuotationMutation, useSendQuotationMutation, useUpdateQuotationMutation } from "@/redux/features/quotation/quotationApi";
import { QuotationEmailDialog } from "../QuotationEmailDialog";
import { QuotationDocument } from "@/components/quotation/document/QuotationDocument";
import { isPdfCancelled, saveBlob, useQuotationPdf, useQuotationPrint } from "@/components/quotation/document/use-quotation-pdf";
import type { QuotationDocInput } from "@/components/quotation/document/types";
import { useGetCatalogTreeQuery } from "@/redux/features/catalog/catalogApi";
import { catalogIcon } from "@/lib/catalog-icons";
import { BrandLogo } from "@/components/catalog/BrandLogo";
import type { CatalogSectionKind, CatalogTreePackage, CatalogTreeService } from "@/types/catalog.type";
import { Client } from "@/types/client.type";
import type { BillingCycle, IQuotationService, QuotationCategory } from "@/types/quotation.type";
import { unitLabel } from "@/components/catalog/canvas/section-meta";
import { DEFAULT_BLUEPRINT, flowOf, resolveBlueprint, type BlueprintInclusion, type FlowType } from "@/lib/quotation-blueprint";
import { computeQuotationTotals } from "@/lib/quotation-totals";

// ───────────────────────────── types & constants ─────────────────────────────

type CheckItem = { text: string; on: boolean; price?: number; id?: string; group?: string };
type LineItem = { title: string; description: string; qty: number; price: number; discount: number; billing: "one-time" | "monthly" | "yearly" };
type Milestone = { label: string; percentage: number; note: string; due?: string };
type UnitService = { qty: number; rate: number };

const STEPS = [
    { title: "Client", sub: "Client details" },
    { title: "Services", sub: "Select service & package" },
    { title: "Scope", sub: "Customize features" },
    { title: "Pricing", sub: "Payment & timeline" },
    { title: "Terms", sub: "Support & conditions" },
    { title: "Preview", sub: "Review & send" },
] as const;

/** "৳60,000", "৳300 – 600 / product", "Custom Quote". */
const priceText = (p: CatalogTreePackage, cur: string) => {
    if (p.price === null) return "Custom Quote";
    const range = p.priceMax ? `${money(p.price, cur)} – ${Math.round(p.priceMax).toLocaleString("en-US")}` : money(p.price, cur);
    const per = p.billingCycle === "one-time" ? "" : ` / ${p.unitLabel || p.billingCycle.replace("per-", "")}`;
    return `${range}${per}`;
};
/** The package a service/platform opens with: the badged one (e.g. "Most Popular"), else the first. */
const defaultPkg = (list: CatalogTreePackage[]) => list.find((p) => p.badge) ?? list[0];


const PAYMENT_PRESETS: Record<string, Milestone[]> = {
    "50-50": [
        { label: "Advance Payment", percentage: 50, note: "Upon quotation acceptance" },
        { label: "Final Payment", percentage: 50, note: "Upon project completion" },
    ],
    "40-30-30": [
        { label: "Advance Payment", percentage: 40, note: "Upon quotation acceptance" },
        { label: "Second Milestone", percentage: 30, note: "After design approval" },
        { label: "Final Payment", percentage: 30, note: "Upon project completion" },
    ],
    "100": [{ label: "Full Payment", percentage: 100, note: "Upon quotation acceptance" }],
};

const withDue = (list: Milestone[]): Milestone[] => list.map((m, i) => ({ ...m, due: new Date(Date.now() + i * 30 * 86400000).toISOString().split("T")[0] }));
const COMPANY = {
    name: "Web Briks LLC",
    address: "House #35 (2nd Floor), Road# 04, Nikunjo 2, Khilkhet, Dhaka-1229",
    email: "info@webbriks.com",
    phone: "09617-008822, +88 01767201923, +88 01977201923",
    website: "www.webbriks.com",
    logo: "/assets/brand/logo.png",
};
const todayISO = () => new Date().toISOString().split("T")[0];
const plusDaysISO = (d: number) => new Date(Date.now() + d * 86400000).toISOString().split("T")[0];
const money = (n: number, cur: string) => `${cur === "USD" ? "$" : "৳"} ${Math.round(n).toLocaleString("en-US")}`;

// ───────────────────────────── small building blocks ─────────────────────────────

function Panel({
    icon: Icon,
    title,
    hint,
    children,
    className,
    right,
    plain,
    id,
    fixed,
}: {
    icon: typeof IconUser;
    title: string;
    hint?: string;
    children: React.ReactNode;
    className?: string;
    right?: React.ReactNode;
    /** Heading without the icon tile. */
    plain?: boolean;
    id?: string;
    /** Fixed card height (a Tailwind `h-*` class). Content past it scrolls in a shadcn ScrollArea. */
    fixed?: string;
}) {
    return (
        <Card id={id} className={cn("scroll-mt-4 gap-4 py-4 shadow-xs md:py-5", fixed && "overflow-hidden", fixed, className)}>
            <CardHeader className="px-4 md:px-5">
                <div className="flex min-w-0 items-start gap-3">
                    {!plain && (
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="size-[18px]" />
                        </span>
                    )}
                    <div className="min-w-0">
                        <CardTitle className="text-sm leading-tight">{title}</CardTitle>
                        {hint && <CardDescription className="mt-1 text-xs">{hint}</CardDescription>}
                    </div>
                </div>
                {right && <CardAction>{right}</CardAction>}
            </CardHeader>
            <CardContent className={cn("px-4 md:px-5", fixed && "flex min-h-0 flex-1 flex-col")}>
                {fixed ? (
                    // padding on every side so focus rings are never clipped by the scroll viewport
                    <ScrollArea className="-mx-1 min-h-0 flex-1">
                        <div className="p-1 pr-4">{children}</div>
                    </ScrollArea>
                ) : (
                    children
                )}
            </CardContent>
        </Card>
    );
}

/** One collapsible step of the Services flow: open = full content, closed = one-line summary + Change. */
function StageCard({
    n,
    title,
    hint,
    open,
    done,
    summary,
    onOpen,
    children,
    footer,
}: {
    n: number;
    title: string;
    hint: string;
    open: boolean;
    done: boolean;
    summary?: React.ReactNode;
    onOpen: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    return (
        <Card className={cn("gap-4 py-4 shadow-xs md:py-5", !open && "gap-0")}>
            <CardHeader className="px-4 md:px-5">
                <div className="flex min-w-0 items-center gap-3">
                    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                        {done && !open ? <IconCheck className="size-4" /> : n}
                    </span>
                    <div className="min-w-0">
                        <CardTitle className="text-sm leading-tight">{title}</CardTitle>
                        {open ? <CardDescription className="mt-1 text-xs">{hint}</CardDescription> : done && <div className="mt-1 text-xs text-muted-foreground">{summary}</div>}
                    </div>
                </div>
                {!open && done && (
                    <CardAction>
                        <Button type="button" variant="outline" size="sm" className="h-7" onClick={onOpen}>Change</Button>
                    </CardAction>
                )}
            </CardHeader>
            {open && <CardContent className="px-4 md:px-5">{children}</CardContent>}
            {open && footer && <CardFooter className="justify-end px-4 md:px-5">{footer}</CardFooter>}
        </Card>
    );
}

function Field({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("space-y-1.5", className)}>
            <Label className="text-xs font-medium">
                {label} {required && <span className="text-destructive">*</span>}
            </Label>
            {children}
        </div>
    );
}

/** Collapsed "Add …" button that opens an inline input with Cancel / Add. */
function AddInline({ label, placeholder, onAdd, secondPlaceholder }: { label: string; placeholder: string; onAdd: (text: string, second: string) => void; secondPlaceholder?: string }) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");
    const [second, setSecond] = useState("");
    const close = () => {
        setOpen(false);
        setText("");
        setSecond("");
    };
    const submit = () => {
        const t = text.trim();
        if (!t) return;
        onAdd(t, second.trim());
        close();
    };
    if (!open) {
        return (
            <Button type="button" variant="outline" size="sm" className="w-full border-dashed bg-primary/5 text-primary" onClick={() => setOpen(true)}>
                <IconPlus className="size-4" /> {label}
            </Button>
        );
    }
    const onKey = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            submit();
        }
        if (e.key === "Escape") close();
    };
    return (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
            <div className="flex gap-2">
                <Input autoFocus className="h-9 min-w-0 flex-1 bg-background" value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} />
                {secondPlaceholder && <Input className="h-9 w-24 shrink-0 bg-background text-center" value={second} placeholder={secondPlaceholder} onChange={(e) => setSecond(e.target.value)} onKeyDown={onKey} />}
            </div>
            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={close}>Cancel</Button>
                <Button type="button" size="sm" disabled={!text.trim()} onClick={submit}>Add</Button>
            </div>
        </div>
    );
}

/** Checkbox list with an inline "add custom" row; used for inclusions, exclusions, responsibilities. */
function CheckList({
    items,
    onChange,
    addLabel,
    tone = "primary",
    twoCol,
}: {
    items: CheckItem[];
    onChange: (next: CheckItem[]) => void;
    addLabel: string;
    tone?: "primary" | "danger";
    twoCol?: boolean;
}) {
    return (
        <div className="space-y-1.5">
            <div className={cn(twoCol ? "grid gap-x-6 gap-y-1.5 sm:grid-cols-2" : "space-y-1.5")}>
            {items.map((it, i) => (
                <div key={i} className="group flex items-center gap-2.5 rounded-md px-1 py-1 hover:bg-muted/50">
                    <Checkbox
                        checked={it.on}
                        onCheckedChange={(v) => onChange(items.map((x, j) => (j === i ? { ...x, on: !!v } : x)))}
                        className={cn(tone === "danger" && "data-[state=checked]:border-destructive data-[state=checked]:bg-destructive")}
                    />
                    <span className={cn("flex-1 text-sm", !it.on && "text-muted-foreground line-through")}>{it.text}</span>
                    <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => onChange(items.filter((_, j) => j !== i))}
                        className="text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                    >
                        <IconTrash className="size-4" />
                    </button>
                </div>
            ))}
            </div>
            <div className="pt-1">
                <AddInline label={addLabel.replace(/…$/, "")} placeholder="Type and press Enter" onAdd={(text) => onChange([...items, { text, on: true }])} />
            </div>
        </div>
    );
}

/** Plain editable string list (deliverables, general terms). */
function TextList({ items, onChange, addLabel }: { items: string[]; onChange: (n: string[]) => void; addLabel: string }) {
    return (
        <div className="space-y-2">
            {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                        {i + 1}
                    </span>
                    <Input value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} className="h-9" />
                    <button type="button" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                        <IconTrash className="size-4" />
                    </button>
                </div>
            ))}
            <AddInline label={addLabel} placeholder="Type and press Enter" onAdd={(text) => onChange([...items, text])} />
        </div>
    );
}

type Milestone2 = { title: string; duration: string };

/** Milestone rows: title + short duration chip ("1 week"). */
function MilestoneList({ items, onChange }: { items: Milestone2[]; onChange: (n: Milestone2[]) => void }) {
    return (
        <div className="space-y-2">
            {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">{i + 1}</span>
                    <Input value={it.title} placeholder="Milestone" onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className="h-9 min-w-0 flex-1" />
                    <Input value={it.duration} placeholder="1 week" onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, duration: e.target.value } : x)))} className="h-9 w-24 shrink-0 text-center" />
                    <button type="button" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-destructive/80 hover:text-destructive"><IconTrash className="size-4" /></button>
                </div>
            ))}
            <AddInline label="Add Milestone" placeholder="Milestone" secondPlaceholder="1 week" onAdd={(title, duration) => onChange([...items, { title, duration }])} />
        </div>
    );
}

/** "6 Weeks" from milestone durations like "1 week" / "3 days" / "1 month"; null if none parse. */
function totalDuration(items: Milestone2[]): string | null {
    let weeks = 0, found = false;
    for (const m of items) {
        const hit = m.duration.match(/(\d+(?:\.\d+)?)\s*(day|week|month)/i);
        if (!hit) continue;
        found = true;
        const n = Number(hit[1]), u = hit[2].toLowerCase();
        weeks += u === "day" ? n / 7 : u === "month" ? n * 4 : n;
    }
    if (!found) return null;
    const w = Math.round(weeks * 10) / 10;
    return `${w} ${w === 1 ? "Week" : "Weeks"}`;
}

const TAX_OPTIONS = [
    { value: "0", label: "No VAT", sub: "(Price excludes VAT)" },
    { value: "5", label: "VAT 5%", sub: "(Added to total)" },
    { value: "7.5", label: "VAT 7.5%", sub: "(Added to total)" },
    { value: "15", label: "VAT 15%", sub: "(Added to total)" },
];

const parseISO = (v: string) => {
    const [y, m, d] = v.split("-").map(Number);
    return y ? new Date(y, m - 1, d) : undefined;
};
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** shadcn date picker (Popover + Calendar) bound to a `yyyy-mm-dd` string. */
function DatePicker({ value, onChange, min, className }: { value: string; onChange: (v: string) => void; min?: string; className?: string }) {
    const [open, setOpen] = useState(false);
    const sel = parseISO(value);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" className={cn("h-10 w-full justify-start px-3 font-normal", !sel && "text-muted-foreground", className)}>
                    <IconCalendar className="mr-2 size-4" />
                    {sel ? sel.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Pick a date"}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={sel}
                    defaultMonth={sel}
                    disabled={min ? { before: parseISO(min) as Date } : undefined}
                    onSelect={(d) => {
                        if (d) {
                            onChange(toISO(d));
                            setOpen(false);
                        }
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}

function Stepper({ step, maxStep, onGo }: { step: number; maxStep: number; onGo: (i: number) => void }) {
    return (
        <ol className="flex items-start rounded-xl border bg-card px-3 py-4 shadow-xs md:px-6">
            {STEPS.map((s, i) => {
                const active = i === step;
                const done = i < step;
                return (
                    <li key={s.title} className="flex flex-1 items-start last:flex-none">
                        <button
                            type="button"
                            disabled={i > maxStep}
                            onClick={() => onGo(i)}
                            className="flex flex-col items-center gap-1.5 disabled:cursor-not-allowed"
                        >
                            <span
                                className={cn(
                                    "flex size-8 items-center justify-center rounded-full border text-xs font-semibold transition",
                                    active && "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30",
                                    done && "border-primary bg-primary/10 text-primary",
                                    !active && !done && "bg-muted text-muted-foreground",
                                )}
                            >
                                {done ? <IconCheck className="size-4" /> : i + 1}
                            </span>
                            <span className={cn("text-xs font-semibold", active ? "text-primary" : "text-foreground/80")}>{s.title}</span>
                            <span className="hidden text-[11px] text-muted-foreground md:block">{s.sub}</span>
                        </button>
                        {i < STEPS.length - 1 && <span className={cn("mx-2 mt-4 h-px flex-1", done ? "bg-primary" : "bg-border")} />}
                    </li>
                );
            })}
        </ol>
    );
}

// ───────────────────────────── wizard ─────────────────────────────

export default function QuotationWizard() {
    const router = useRouter();
    const { data: clientsData, isLoading: clientsLoading } = useGetClientsQuery({});
    const [createQuotation, { isLoading: creating }] = useCreateQuotationMutation();
    const [updateQuotation, { isLoading: updating }] = useUpdateQuotationMutation();
    const [sendQuotation, { isLoading: sending }] = useSendQuotationMutation();
    const [savedId, setSavedId] = useState<string | null>(null);
    const [savedNo, setSavedNo] = useState("");
    const [pickerOpen, setPickerOpen] = useState(false);
    const [sentOnce, setSentOnce] = useState(false);
    const [zoom, setZoom] = useState(100);
    const [expanded, setExpanded] = useState(false);
    const { generate: generatePdf, stage: pdfStage, busy: pdfBusy } = useQuotationPdf();
    const { print: printDoc, host: printHost } = useQuotationPrint();
    const numberRef = useRef("");
    const previewBox = useRef<HTMLDivElement>(null);
    const [autoFit, setAutoFit] = useState(true);
    const autoFitRef = useRef(true);
    autoFitRef.current = autoFit;
    const saving = creating || updating;

    const [step, setStep] = useState(0);
    const [maxStep, setMaxStep] = useState(0);

    // step 1
    const [clientId, setClientId] = useState("");
    const [snap, setSnap] = useState({ contactName: "", companyName: "", email: "", phone: "", address: "" });
    const [clientMode, setClientMode] = useState<"new" | "existing">("new");
    const [clientName, setClientName] = useState("");
    const [emails, setEmails] = useState<string[]>([""]);
    const [creatingClient, setCreatingClient] = useState(false);
    const [createClient] = useCreateClientMutation();
    const clientOptions = (clientsData?.clients ?? []).map((c: Client) => ({ value: c._id, label: c.name, description: c.emails?.[0] }));
    const [currency, setCurrency] = useState<"BDT" | "USD">("BDT");
    const [date] = useState(todayISO());
    const [validUntil, setValidUntil] = useState(plusDaysISO(30));
    const [taxPct, setTaxPct] = useState(0);

    // step 2
    const { data: treeData, isLoading: catalogLoading } = useGetCatalogTreeQuery();
    const tree: CatalogTreeService[] = treeData ?? [];
    const [serviceId, setServiceId] = useState("");
    const [platformId, setPlatformId] = useState("");
    const [pkgId, setPkgId] = useState("");
    const [customPrice, setCustomPrice] = useState(0);
    const [features, setFeatures] = useState<CheckItem[]>([]);
    const [addonsOn, setAddonsOn] = useState<string[]>([]);
    const [duration, setDuration] = useState("");
    const [unit, setUnit] = useState<UnitService>({ qty: 1, rate: 0 });
    const [stage, setStage] = useState<"service" | "platform" | "package" | "details">("service");

    // step 3
    const [overview, setOverview] = useState("");
    const [deliverables, setDeliverables] = useState<string[]>([]);
    const [title, setTitle] = useState("");
    const [timeline, setTimeline] = useState<Milestone2[]>([]);
    const [clientResp, setClientResp] = useState<CheckItem[]>([]);
    const [exclusions, setExclusions] = useState<CheckItem[]>([]);

    // step 4
    const [lines, setLines] = useState<LineItem[]>([{ title: "", description: "", qty: 1, price: 0, discount: 0, billing: "one-time" }]);
    const [editing, setEditing] = useState<string | null>("l0");
    const [methods, setMethods] = useState<string[]>(["Bank Transfer", "bKash", "Nagad"]);
    const discountPct = 0; // discounts are per line item now
    const [presetKey, setPresetKey] = useState("50-50");
    const [milestones, setMilestones] = useState<Milestone[]>(withDue(DEFAULT_BLUEPRINT.paymentMilestones));

    // step 5
    const [supportDuration, setSupportDuration] = useState("");
    const [incl, setIncl] = useState<BlueprintInclusion[]>([]);
    const [inclusions, setInclusions] = useState<CheckItem[]>([]);
    const [supportExcl, setSupportExcl] = useState<CheckItem[]>([]);
    const [uiRev, setUiRev] = useState(String(DEFAULT_BLUEPRINT.revisions.ui));
    const [devRev, setDevRev] = useState(String(DEFAULT_BLUEPRINT.revisions.dev));
    const [extraRevFee, setExtraRevFee] = useState("0");
    const [devRevFee, setDevRevFee] = useState("0");
    const [recurring, setRecurring] = useState({ billing: false, invoice: false, upgrade: false });
    const [grace, setGrace] = useState("");
    const [suspend, setSuspend] = useState("");
    const [cancelNotice, setCancelNotice] = useState("");
    const [extraCharge, setExtraCharge] = useState<"feature" | "hourly" | "custom">("feature");
    const [extraRate, setExtraRate] = useState("0");
    const [hourlyRate, setHourlyRate] = useState("0");
    const [customExtra, setCustomExtra] = useState("");
    const [ownershipCustom, setOwnershipCustom] = useState("");
    const [ownership, setOwnership] = useState<"" | "client" | "portfolio" | "custom">("");
    const [generalTerms, setGeneralTerms] = useState<string[]>([]);

    const cur = currency;

    // Sections the user has edited by hand. Choosing another package re-applies the catalog
    // blueprint everywhere EXCEPT these, so typed-in work is never overwritten.
    const dirty = useRef(new Set<string>());
    const touch = (k: string) => void dirty.current.add(k);
    const edit = <T,>(k: string, set: (v: T) => void) => (v: T) => {
        touch(k);
        set(v);
    };
    const editMs = (v: Milestone[]) => {
        touch("milestones");
        setMilestones(v);
    };
    const hasRecurringLine = lines.some((l) => l.billing !== "one-time");

    // ── selected service → platform → package → add-ons (all from the catalog, by id) ──
    const service = tree.find((x) => x._id === serviceId);
    const flow: FlowType = flowOf(service);
    const category = service?.quotationCategory ?? null;
    const svcLabel = service?.name ?? "";
    const platform = service?.platforms.find((x) => x._id === platformId)?.name ?? "";
    const pkgs = (service?.packages ?? []).filter((x) => (x.platformId ?? "") === platformId);
    const pkg = pkgs.find((x) => x._id === pkgId);
    const isUnit = service?.pricingMode === "unit";
    const pkgPrice = pkg && !isUnit ? (pkg.price ?? (Number(customPrice) || 0)) : 0;
    const addonList = pkg?.addons ?? [];
    const chosenAddons = addonList.filter((a) => addonsOn.includes(a._id));

    // ── build the same service payload the existing API expects ──
    const builtServices = ((): IQuotationService[] => {
        if (!category || !service) return [];
        const item = (title: string, price: number, description?: string, qty = 1, billingCycle: BillingCycle = "one-time") => ({
            title, price, quantity: Math.max(1, qty), billingCycle, description,
        });
        const manual = [
            ...lines
                .filter((l) => l.title.trim())
                .map((l) => {
                    const d = Math.min(100, Math.max(0, Number(l.discount) || 0));
                    const note = [l.description.trim(), d ? `${d}% discount applied` : ""].filter(Boolean).join(" · ");
                    return item(l.title.trim(), (Number(l.price) || 0) * (1 - d / 100), note || undefined, Number(l.qty) || 1, l.billing as BillingCycle);
                }),
            ...incl
                .filter((i) => !i.included && Number(i.charge) > 0)
                .map((i) => item(`${i.label}${i.termMonths ? ` — ${i.termMonths} month${i.termMonths === 1 ? "" : "s"}` : ""}`, Number(i.charge), "Not included in the package", 1, "one-time")),
        ];
        const base: IQuotationService = {
            category,
            catalogServiceId: service._id,
            catalogPlatformId: platformId || null,
            catalogPackageId: pkg?._id ?? null,
            catalogFeatureIds: [...features.filter((f) => f.on && f.id).map((f) => f.id as string), ...chosenAddons.map((a) => a._id)],
            scopeItems: features.filter((f) => f.on).map((f) => f.text),
            basePrice: 0,
            lineItems: [],
            discount: discountPct,
            taxRate: taxPct,
        };
        if (category === "web-development" && platform) {
            base.techStack = { description: platform, frontend: [platform], backend: [], database: [], tools: [] };
        }
        if (pkg && isUnit) base.lineItems.push(item(pkg.name, Number(unit.rate) || 0, undefined, unit.qty, pkg.billingCycle));
        if (pkg && !isUnit) base.lineItems.push(item(`${svcLabel} (${pkg.name})`, pkgPrice, platform ? `Platform: ${platform}` : undefined, 1, pkg.billingCycle));
        chosenAddons.forEach((a) => base.lineItems.push(item(a.name, a.price, "Optional add-on")));
        base.lineItems.push(...manual);
        return [base];
    })();

    const calc = computeQuotationTotals(builtServices);
    const grand = calc.totals.grandTotal;
    const recurringMonthly = calc.recurringCharges.filter((r) => r.billingCycle === "monthly").reduce((a, r) => a + r.price * (r.quantity ?? 1), 0);
    const recurringYearly = calc.recurringCharges.filter((r) => r.billingCycle === "yearly").reduce((a, r) => a + r.price * (r.quantity ?? 1), 0);
    const msTotal = milestones.reduce((a, m) => a + (Number(m.percentage) || 0), 0);

    // ── validation per step ──
    const problem = (s: number): string | null => {
        if (s === 0) {
            if (clientMode === "existing" && !clientId) return "Please select a client";
            if (!clientName.trim()) return "Client name is required";
            if (!emails.some((e) => /^\S+@\S+\.\S+$/.test(e.trim()))) return "A valid email address is required";
            if (emails.some((e) => e.trim() && !/^\S+@\S+\.\S+$/.test(e.trim()))) return "One of the email addresses is invalid";
            if (!snap.phone.trim()) return "Phone number is required";
            if (!snap.address.trim()) return "Billing address is required";
        }
        if (s === 1) {
            if (!service) return "Select a service category";
            if (service.platforms.length > 0 && !platformId) return "Select a platform";
            if (pkgs.length > 0 && !pkg) return "Select a package";
        }
        if (s === 3) {
            if (grand <= 0 && recurringMonthly + recurringYearly <= 0) return "Add at least one priced item";
            if (new Date(validUntil) < new Date(date)) return "Valid-until date cannot be earlier than the quotation date";
            if (msTotal !== 100) return `Payment milestones must total 100% (now ${msTotal}%)`;
        }
        return null;
    };

    const go = async (to: number) => {
        if (to > step) {
            const p = problem(step);
            if (p) return toast.error(p);
            if (step === 0 && !clientId) {
                setCreatingClient(true);
                try {
                    const c = await createClient({
                        name: clientName.trim(),
                        emails: emails.map((e) => e.trim()).filter(Boolean),
                        phone: snap.phone.trim(),
                        address: snap.address.trim(),
                        currency,
                    } as never).unwrap();
                    setClientId(c._id);
                } catch (err) {
                    return toast.error((err as { data?: { message?: string } })?.data?.message || "Failed to create client.");
                } finally {
                    setCreatingClient(false);
                }
            }
        }
        setStep(to);
        setMaxStep((m) => Math.max(m, to));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    /**
     * Choosing a package loads everything the catalog knows about it: features, scope content
     * (sections) and its blueprint (inclusions, revisions, payment milestones, policies).
     * Sections the user already edited (`dirty`) are kept; `reset` re-applies everything.
     */
    const selectPackage = (p: CatalogTreePackage, reset = false) => {
        if (reset) dirty.current.clear();
        const put = (key: string, fn: () => void) => {
            if (!dirty.current.has(key)) fn();
        };
        const svc = tree.find((x) => x._id === p.serviceId);
        const bp = resolveBlueprint(svc, p);

        setPkgId(p._id);
        setAddonsOn([]);
        setCustomPrice(0);
        setUnit({ qty: 1, rate: p.price ?? 0 });
        setFeatures(p.features.map((f) => ({ text: f.name, on: true, id: f._id, group: f.group })));
        dirty.current.delete("features");

        // package facts (blank when the catalog does not state them)
        put("duration", () => setDuration(p.duration ?? ""));
        put("inclusions", () => setInclusions(p.supportInclusions.map((text) => ({ text, on: true }))));
        put("supportExcl", () => setSupportExcl(p.additionalCharges.map((text) => ({ text, on: true }))));
        put("generalTerms", () => setGeneralTerms([...p.notes]));

        // scope content: a package-level section overrides the service-wide one
        const sec = (kind: CatalogSectionKind) => {
            const all = (svc?.sections ?? []).filter((x) => x.kind === kind);
            return all.find((x) => String(x.packageId ?? "") === p._id) ?? all.find((x) => !x.packageId);
        };
        const titles = (kind: CatalogSectionKind) => (sec(kind)?.items ?? []).map((i) => i.title);
        const company = snap.companyName.trim();
        const t = sec("projectTitle")?.text?.trim();
        put("title", () => setTitle(t ? (company ? `${t} — ${company}` : t) : ""));
        put("overview", () => setOverview(sec("projectOverview")?.text ?? ""));
        put("deliverables", () => setDeliverables(titles("deliverables")));
        put("timeline", () => setTimeline((sec("milestones")?.items ?? []).map((i) => ({ title: i.title, duration: unitLabel(i.duration) }))));
        put("clientResp", () => setClientResp(titles("clientResponsibilities").map((text) => ({ text, on: true }))));
        put("exclusions", () => setExclusions(titles("exclusions").map((text) => ({ text, on: true }))));

        // blueprint
        const rev = bp.revisions ?? DEFAULT_BLUEPRINT.revisions;
        const pol = bp.policies;
        setUiRev(String(rev.ui ?? ""));
        setDevRev(String(rev.dev ?? ""));
        setExtraRevFee(String(rev.uiExtraFee ?? 0));
        setDevRevFee(String(rev.devExtraFee ?? 0));
        setGrace(pol?.graceDays != null ? String(pol.graceDays) : "");
        setSuspend(pol?.suspendDays != null ? String(pol.suspendDays) : "");
        setCancelNotice(pol?.cancelNoticeDays != null ? String(pol.cancelNoticeDays) : "");
        setExtraRate(String(pol?.extraFeatureRate ?? 0));
        setHourlyRate(String(pol?.hourlyRate ?? 0));
        setOwnership(pol?.ownership ?? "");
        put("validUntil", () => pol?.validityDays && setValidUntil(plusDaysISO(pol.validityDays)));
        put("incl", () => setIncl((bp.inclusions ?? []).filter((i) => i.kind !== "support").map((i) => ({ ...i }))));
        const support = (bp.inclusions ?? []).find((i) => i.kind === "support" && i.included && i.termMonths);
        const fromPkg = /^\d+ Months?$/.test(p.supportPeriod ?? "") ? (p.supportPeriod as string) : "";
        setSupportDuration(support?.termMonths ? `${support.termMonths} Month${support.termMonths === 1 ? "" : "s"}` : fromPkg);
        put("milestones", () => {
            const list = (bp.paymentMilestones ?? DEFAULT_BLUEPRINT.paymentMilestones).map((m) => ({ ...m }));
            setMilestones(withDue(list));
            setPresetKey(list.length === 2 && list.every((m) => m.percentage === 50) ? "50-50" : "custom");
        });
    };

    const pickPlatform = (id: string) => {
        setPlatformId(id);
        const first = defaultPkg((service?.packages ?? []).filter((x) => (x.platformId ?? "") === id));
        if (first) selectPackage(first);
        else { setPkgId(""); setFeatures([]); }
        setStage("package");
    };

    const pickService = (s: CatalogTreeService) => {
        setServiceId(s._id);
        const firstPlatform = s.platforms[0]?._id ?? "";
        setPlatformId(firstPlatform);
        const first = defaultPkg(s.packages.filter((x) => (x.platformId ?? "") === firstPlatform));
        if (first) selectPackage(first);
        else { setPkgId(""); setFeatures([]); }
        setStage(s.platforms.length ? "platform" : "package");
    };

    const pickClient = (id: string) => {
        const c = clientsData?.clients?.find((x: Client) => x._id === id);
        if (!c) return;
        setClientId(id);
        setClientName(c.name || "");
        setSnap({
            contactName: c.teamMembers?.[0]?.name || c.name || "Valued Client",
            companyName: c.name || "",
            email: "",
            phone: c.phone || "",
            address: c.address || c.officeAddress || "",
        });
        setEmails(c.emails?.length ? c.emails : [""]);
        if (c.currency === "USD") setCurrency("USD");
    };

    /** A new client's name doubles as company + contact name on the document. */
    const changeName = (v: string) => {
        setClientName(v);
        if (clientMode === "new") setSnap((p) => ({ ...p, companyName: v, contactName: v }));
    };

    const switchMode = (m: "new" | "existing") => {
        if (m === clientMode) return;
        setClientMode(m);
        setClientId("");
        setClientName("");
        setSnap({ contactName: "", companyName: "", email: "", phone: "", address: "" });
        setEmails([""]);
    };

    // ── save ──
    const buildPayload = () => {
        const msg = (n: string, v: string) => (v.trim() ? `${n}: ${v.trim()}` : "");
        const pos = (v: string) => Number(v) > 0;
        const inclLines = incl
            .filter((i) => i.included && i.label.trim())
            .map((i) => `${i.label.trim()}${i.termMonths ? ` — ${i.termMonths} month${i.termMonths === 1 ? "" : "s"}` : ""}${i.owner === "client" ? " (client owns & controls access)" : ""}${i.note.trim() && i.owner !== "client" ? ` — ${i.note.trim()}` : ""}`);
        const supportLines = [
            ...(supportDuration ? [`Technical support duration: ${supportDuration}`] : []),
            ...(duration ? [`Estimated delivery: ${duration}`] : []),
            ...inclLines,
            ...inclusions.filter((i) => i.on).map((i) => i.text),
        ];
        const recurringBits = [
            recurring.billing && "billing resumes after project completion",
            recurring.invoice && "invoice is sent before each billing cycle",
            recurring.upgrade && "plan upgrade/downgrade allowed anytime",
            grace && `grace period ${grace} days`,
            suspend && `services suspended after ${suspend} days of non-payment`,
            cancelNotice && `cancellation requires ${cancelNotice} days' written notice`,
        ].filter(Boolean);
        const keyTerms = [
            ...(uiRev || devRev
                ? [
                      `${uiRev ? `UI/UX revisions included: ${uiRev}${pos(extraRevFee) ? ` (additional rounds ${extraRevFee} per round)` : ""}` : ""}${uiRev && devRev ? "; " : ""}${devRev ? `development revisions included: ${devRev}${pos(devRevFee) ? ` (additional rounds ${devRevFee} per round)` : ""}` : ""}.`,
                  ]
                : []),
            extraCharge === "feature"
                ? pos(extraRate) ? `Extra features / change requests are charged per feature/module at ${extraRate}.` : ""
                : extraCharge === "hourly"
                  ? pos(hourlyRate) ? `Extra work is charged hourly at ${hourlyRate} per hour.` : ""
                  : msg("Extra work", customExtra),
            ownership === "client"
                ? "Full ownership is transferred to the client after final payment."
                : ownership === "portfolio"
                  ? "WebBriks retains the right to showcase the project in its portfolio."
                  : ownership === "custom"
                    ? msg("Ownership", ownershipCustom)
                    : "",
            hasRecurringLine && recurringBits.length ? `Recurring services: ${recurringBits.join("; ")}.` : "",
            ...(methods.length ? [`Accepted payment methods: ${methods.join(", ")}.`] : []),
            ...(milestones[0] ? [`Advance payment: ${milestones[0].percentage}% to start the project.`] : []),
            ...generalTerms.filter((t) => t.trim()),
        ].filter(Boolean);

        return {
            serviceType: (category ?? "web-development") as QuotationCategory,
            clientId,
            currency,
            company: COMPANY,
            client: { ...snap, email: emails.find((e) => e.trim())?.trim() ?? "" },
            details: { title: title.trim() || `${svcLabel || "Quotation"} — ${snap.companyName.trim() || clientName.trim()}`, date: new Date(date).toISOString(), validUntil: new Date(validUntil).toISOString() },
            overview: overview.trim(),
            services: builtServices,
            notIncluded: [...exclusions.filter((e) => e.on && e.text.trim()).map((e) => e.text), ...supportExcl.filter((s) => s.on).map((s) => s.text)],
            clientRequirements: clientResp.filter((c) => c.on).map((c) => c.text),
            includedSupport: supportLines,
            // domain / hosting terms — renewal timers start from the order date
            inclusions: incl
                .filter((i) => i.label.trim())
                .map((i) => ({ key: i.key, label: i.label.trim(), kind: i.kind, included: i.included, termMonths: i.termMonths ?? undefined, owner: i.owner || undefined, renews: i.renews, note: i.note || undefined })),
            keyTerms,
            workflow: [...deliverables.filter((d) => d.trim()).map((d) => `Deliverable: ${d}`), ...timeline.filter((t) => t.title.trim()).map((t) => (t.duration.trim() ? `${t.title.trim()} — ${t.duration.trim()}` : t.title.trim()))],
            paymentMilestones: milestones.map((m) => ({ label: m.label, percentage: Number(m.percentage) || 0, note: [m.note, m.due ? `Due ${m.due}` : ""].filter(Boolean).join(" · ") || undefined })),
            status: "draft",
        };
    };

    /** Creates the quotation on first call, updates it afterwards. Returns its id, or null on failure. */
    const persist = async (): Promise<string | null> => {
        for (let st = 0; st <= 3; st++) {
            const pr = problem(st);
            if (pr) {
                setStep(st);
                toast.error(pr);
                return null;
            }
        }
        try {
            const payload = buildPayload();
            if (savedId) {
                await updateQuotation({ id: savedId, ...payload } as never).unwrap();
                return savedId;
            }
            const res = await createQuotation(payload as never).unwrap();
            setSavedId(res._id ?? null);
            setSavedNo(res.quotationNumber ?? "");
            numberRef.current = res.quotationNumber ?? "";
            return res._id ?? null;
        } catch (err) {
            toast.error((err as { data?: { message?: string } })?.data?.message || "Failed to save quotation.");
            return null;
        }
    };

    const save = async () => {
        const id = await persist();
        if (!id) return;
        toast.success("Quotation saved as draft");
        router.push(`/quotations/${id}`);
    };

    /** The document exactly as it will be saved — the preview, the PDF and the email attachment all use it. */
    const docNow = (): QuotationDocInput => ({ ...buildPayload(), quotationNumber: numberRef.current });

    const downloadPdf = async () => {
        const id = await persist();
        if (!id) return;
        try {
            const blob = await generatePdf(docNow());
            saveBlob(blob, `${numberRef.current || title.trim() || "quotation"}.pdf`);
        } catch (err) {
            if (!isPdfCancelled(err)) toast.error((err as Error).message || "Could not create the PDF");
        }
    };

    const openSend = async () => {
        if (await persist()) setPickerOpen(true);
    };

    const confirmSend = async (selected: string[]) => {
        if (!savedId || sending) return [];
        if (!selected.length) {
            toast.warning("Please select at least one recipient");
            return [];
        }
        try {
            const pdf = await generatePdf(docNow());
            const result = await sendQuotation({ id: savedId, emails: selected, includePaymentLink: false, pdf }).unwrap();
            const recipients = result.data.recipients ?? [];
            const sent = recipients.filter((r) => r.status === "sent").length;
            const failed = recipients.length - sent;
            if (sent) setSentOnce(true);
            if (result.data.clientLink) navigator.clipboard?.writeText(result.data.clientLink).then(() => toast.success("Client link copied to clipboard!")).catch(() => {});
            if (sent && !failed) toast.success(`Quotation sent to ${sent} recipient${sent === 1 ? "" : "s"}`);
            else if (sent) toast.warning(`Sent to ${sent}, failed for ${failed}. See dialog for details.`);
            else toast.error(result.data.emailError || "Failed to send the quotation");
            return recipients;
        } catch (err) {
            if (!isPdfCancelled(err)) toast.error((err as { data?: { message?: string } })?.data?.message || (err as Error).message || "Failed to send the quotation");
            return [];
        }
    };

    // ───────────── step bodies ─────────────

    const typeCard = (m: "new" | "existing", Icon: typeof IconUser, label: string, sub: string) => (
        <button
            type="button"
            role="radio"
            aria-checked={clientMode === m}
            onClick={() => switchMode(m)}
            className={cn(
                "flex flex-1 items-center gap-3 rounded-lg border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                clientMode === m ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "bg-card hover:bg-muted/50",
            )}
        >
            <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", clientMode === m ? "border-primary" : "border-muted-foreground/50")}>
                {clientMode === m && <span className="size-2 rounded-full bg-primary" />}
            </span>
            <Icon className={cn("size-5 shrink-0", clientMode === m ? "text-primary" : "text-muted-foreground")} />
            <span className="min-w-0">
                <span className={cn("block text-sm font-semibold leading-tight", clientMode === m && "text-primary")}>{label}</span>
                <span className="block text-[11px] text-muted-foreground">{sub}</span>
            </span>
        </button>
    );

    const clientStep = (
        <section className="rounded-xl border bg-card p-4 shadow-xs md:p-6">
            <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <IconBuilding className="size-7" />
                    </span>
                    <div>
                        <h2 className="text-xl font-bold leading-tight">Client Details</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Add client information for this quotation. You can select an existing client or create a new one.</p>
                    </div>
                </div>
                <div className="w-full sm:w-auto">
                    <p className="mb-1.5 text-xs font-semibold">Client Type</p>
                    <div role="radiogroup" aria-label="Client type" className="flex gap-3">
                        {typeCard("new", IconUserPlus, "New Client", "Create a new client")}
                        {typeCard("existing", IconUsers, "Existing Client", "Select from your client list")}
                    </div>
                </div>
            </header>

            {clientMode === "existing" && (
                <Field label="Select Client" required className="mb-5">
                    <Combobox
                        options={clientOptions}
                        value={clientId}
                        onChange={pickClient}
                        isLoading={clientsLoading}
                        placeholder="Choose a client from your list"
                        searchPlaceholder="Search client by name or email…"
                        emptyText="No client found"
                        className="h-10"
                    />
                </Field>
            )}

            <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
                <Field label="Client Name" required>
                    <Input className="h-10" placeholder="e.g. ABC Fashion Ltd." value={clientName} disabled={clientMode === "existing"} onChange={(e) => changeName(e.target.value)} />
                </Field>

                <div className="space-y-2">
                    <Label className="text-xs font-medium">Email Address <span className="text-destructive">*</span></Label>
                    {emails.map((em, i) => (
                        <div key={i} className="flex gap-2">
                            <Input type="email" className="h-10" placeholder="name@company.com" value={em} onChange={(e) => setEmails(emails.map((x, j) => (j === i ? e.target.value : x)))} />
                            {emails.length > 1 && (
                                <Button type="button" variant="outline" size="icon" className="size-10 shrink-0" aria-label="Remove email" onClick={() => setEmails(emails.filter((_, j) => j !== i))}>
                                    <IconTrash className="size-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-primary" onClick={() => setEmails([...emails, ""])}>
                        <IconPlus className="size-3.5" /> Add email
                    </Button>
                </div>
                <Field label="Phone Number" required>
                    <Input type="tel" className="h-10" placeholder="+880 1XXX XXXXXX" value={snap.phone} onChange={(e) => setSnap({ ...snap, phone: e.target.value })} />
                </Field>
                <Field label="Preferred Currency" required>
                    <Select value={currency} onValueChange={(v) => setCurrency(v as "BDT" | "USD")}>
                        <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="BDT">BDT (৳) — Bangladeshi Taka</SelectItem>
                            <SelectItem value="USD">USD ($) — US Dollar</SelectItem>
                        </SelectContent>
                    </Select>
                </Field>

                <Field label="Billing Address" required className="md:col-span-2">
                    <Textarea rows={3} className="resize-none" placeholder="House, road, area, city, postal code" value={snap.address} onChange={(e) => setSnap({ ...snap, address: e.target.value })} />
                </Field>
            </div>
        </section>
    );

    const hasPlatforms = (service?.platforms.length ?? 0) > 0;
    const showPackages = !!service && (!hasPlatforms || !!platformId);
    const pkgStageNo = hasPlatforms ? 3 : 2;
    const goDetails = () => {
        setStage("details");
        requestAnimationFrame(() => document.getElementById("sec-features")?.scrollIntoView({ behavior: "smooth" }));
    };
    const servicesStep = (
        <div className="min-w-0 space-y-4">
            <StageCard
                n={1}
                title="Select Service Category"
                hint="Choose the service you want to include in this quotation."
                open={stage === "service"}
                done={!!service}
                onOpen={() => setStage("service")}
                summary={service ? <span className="font-medium text-foreground">{service.name}</span> : null}
            >
                {catalogLoading && <p className="text-sm text-muted-foreground">Loading services…</p>}
                {!catalogLoading && tree.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        No services in the catalog yet. Add them from <Link href="/catalog" className="text-primary underline">Service Catalog</Link>.
                    </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                    {tree.map((s) => {
                        const Icon = catalogIcon(s.icon);
                        const on = serviceId === s._id;
                        return (
                            <button
                                key={s._id}
                                type="button"
                                onClick={() => pickService(s)}
                                className={cn(
                                    "relative flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition hover:border-primary/50",
                                    on && "border-primary bg-primary/5 ring-1 ring-primary",
                                )}
                            >
                                {on && (
                                    <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                        <IconCheck className="size-3.5" />
                                    </span>
                                )}
                                <Icon className={cn("size-7", on ? "text-primary" : "text-foreground/80")} />
                                <span className={cn("text-sm font-semibold leading-tight", on && "text-primary")}>{s.name}</span>
                                <span className="text-[11px] leading-snug text-muted-foreground">{s.description}</span>
                            </button>
                        );
                    })}
                </div>
            </StageCard>

            {service && hasPlatforms && (
                <StageCard
                    n={2}
                    title="Select Platform / Technology"
                    hint="Choose the technology stack for your project."
                    open={stage === "platform"}
                    done={!!platformId}
                    onOpen={() => setStage("platform")}
                    summary={<span className="font-medium text-foreground">{platform}</span>}
                >
                    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                        {service.platforms.map((p) => {
                            const on = platformId === p._id;
                            return (
                                <button
                                    key={p._id}
                                    type="button"
                                    onClick={() => pickPlatform(p._id)}
                                    className={cn(
                                        "relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition hover:border-primary/50",
                                        on && "border-primary bg-primary/5 ring-1 ring-primary",
                                    )}
                                >
                                    <span className={cn("absolute right-2 top-2 flex size-4 items-center justify-center rounded-full border", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                                        {on && <IconCheck className="size-3" />}
                                    </span>
                                    <span className="flex h-8 items-center gap-1.5">
                                        {p.logo ? (
                                            <>
                                                <BrandLogo name={p.logo} color={p.color} />
                                                {p.logoSecondary && <BrandLogo name={p.logoSecondary} color="#5FA04E" />}
                                            </>
                                        ) : (
                                            <IconCode className="size-7" />
                                        )}
                                    </span>
                                    <span className="text-sm font-semibold leading-tight">{p.name}</span>
                                    <span className="text-[11px] leading-snug text-muted-foreground">{p.description}</span>
                                </button>
                            );
                        })}
                    </div>
                </StageCard>
            )}

            {showPackages && pkgs.length > 0 && (
                <StageCard
                    n={pkgStageNo}
                    title="Select Package"
                    hint={isUnit ? "Choose what you are quoting, then set quantity and rate." : "Choose a package or go with custom build."}
                    open={stage === "package"}
                    done={!!pkg}
                    onOpen={() => setStage("package")}
                    summary={pkg ? <span><span className="font-medium text-foreground">{pkg.name}</span> · {priceText(pkg, cur)}</span> : null}
                    footer={
                        <Button type="button" disabled={!pkg} onClick={goDetails}>
                            Continue to features <IconArrowRight className="size-4" />
                        </Button>
                    }
                >
                    <div className={cn("grid gap-3", pkgs.length > 2 ? "sm:grid-cols-2 2xl:grid-cols-3" : "sm:grid-cols-2")}>
                        {pkgs.map((p) => {
                            const on = pkgId === p._id;
                            return (
                                <button
                                    key={p._id}
                                    type="button"
                                    onClick={() => selectPackage(p)}
                                    className={cn(
                                        "relative flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition hover:border-primary/50",
                                        on && "border-primary bg-primary/5 ring-1 ring-primary",
                                    )}
                                >
                                    <span className="flex w-full items-center justify-between gap-2">
                                        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                                            {p.name}
                                            {p.badge && (
                                                <span className="flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                                    <IconStarFilled className="size-2.5" /> {p.badge}
                                                </span>
                                            )}
                                        </span>
                                        <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                                            {on && <IconCheck className="size-3" />}
                                        </span>
                                    </span>
                                    <span className="text-[11px] leading-snug text-muted-foreground">{p.description}</span>
                                    <span className="text-xl font-bold">{priceText(p, cur)}</span>
                                    <ul className="space-y-1 text-[11px]">
                                        {p.bullets.map((b) => (
                                            <li key={b} className="flex items-start gap-1.5">
                                                <IconCheck className="mt-0.5 size-3 shrink-0 text-primary" /> {b}
                                            </li>
                                        ))}
                                    </ul>
                                </button>
                            );
                        })}
                    </div>
                    {pkg && isUnit && (
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <Field label={`Quantity (${pkg.unitLabel || "units"})`}>
                                <Input type="number" min={1} value={unit.qty} onChange={(e) => setUnit({ ...unit, qty: Number(e.target.value) || 1 })} />
                            </Field>
                            <Field label={`Rate per ${pkg.unitLabel || "unit"} (${cur})`}>
                                <Input type="number" min={0} value={unit.rate} onChange={(e) => setUnit({ ...unit, rate: Number(e.target.value) || 0 })} />
                                {pkg.priceMax ? <p className="text-[11px] text-muted-foreground">Standard range {money(pkg.price ?? 0, cur)} – {money(pkg.priceMax, cur)}; final rate depends on scope.</p> : null}
                            </Field>
                        </div>
                    )}
                    {pkg && !isUnit && pkg.price === null && (
                        <div className="mt-3 max-w-[260px]">
                            <Field label={`Custom price (${cur})`}>
                                <Input type="number" min={0} value={customPrice} onChange={(e) => setCustomPrice(Number(e.target.value) || 0)} />
                            </Field>
                        </div>
                    )}
                </StageCard>
            )}
            {showPackages && pkgs.length === 0 && (
                <Panel plain icon={IconInfoCircle} title="Packages" hint="No packages defined for this selection.">
                    <p className="text-sm text-muted-foreground">
                        Add packages in <Link href="/catalog" className="text-primary underline">Service Catalog</Link>, or price this service with line items on the Pricing step.
                    </p>
                </Panel>
            )}

            {service && pkg && (
                <StageCard
                    n={pkgStageNo + 1}
                    title="Features & Add-ons"
                    hint="Edit the included features and pick optional add-ons."
                    open={stage === "details"}
                    done
                    onOpen={goDetails}
                    summary={<span>{features.filter((f) => f.on).length} features · {chosenAddons.length} add-ons</span>}
                >
                    <div className={cn("grid items-start gap-4", addonList.length > 0 && "lg:grid-cols-2")}>
                        <Panel
                            id="sec-features"
                            icon={IconSettings}
                            title="Included Features"
                            hint="Edit, add or remove features for this quotation."
                            right={
                                <Button type="button" variant="outline" size="sm" className="h-7 text-primary" onClick={() => selectPackage(pkg, true)}>
                                    Reset to Package
                                </Button>
                            }
                        >
                            <FeatureEditor items={features} onChange={edit("features", setFeatures)} />
                        </Panel>
                        {addonList.length > 0 && (
                            <Panel fixed="h-[28rem]" id="sec-addons" icon={IconPlus} title="Optional Add-on Features" hint="Add features to enhance the package.">
                                <ul className="divide-y">
                                    {addonList.map((a) => (
                                        <li key={a._id}>
                                            <label className="flex cursor-pointer items-center gap-3 py-2 text-sm">
                                                <Checkbox
                                                    checked={addonsOn.includes(a._id)}
                                                    onCheckedChange={(v) => setAddonsOn(v ? [...addonsOn, a._id] : addonsOn.filter((n) => n !== a._id))}
                                                />
                                                <span className="flex-1">{a.name}</span>
                                                <span className="w-20 text-right font-medium">{money(a.price, cur)}</span>
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                            </Panel>
                        )}
                    </div>
                </StageCard>
            )}
        </div>
    );

    const durTotal = totalDuration(timeline);
    const SCOPE_H = "h-[22rem]";
    const scopeText3 = {
        deliverables: flow === "retainer" ? ["Monthly Deliverables", "What is delivered every month."] : flow === "production" ? ["Deliverables per Item", "What the client receives for each product / video."] : ["Deliverables", "List the key deliverables for this project."],
        milestones: flow === "production" ? ["Production Workflow", "How the work moves from brief to delivery."] : ["Project Milestones & Timeline", "Define major milestones and estimated timeline."],
        exclusions: flow === "retainer" ? ["Not Included", "Clearly mention what is not included."] : ["Exclusions", "Clearly mention what is not included in this quotation."],
    };
    const scopeHidden: string[] = flow === "retainer" ? ["milestones"] : [];
    const scopeBlocks: { key: string; node: React.ReactNode }[] = [
        {
            key: "milestones",
            node: (
                <Panel fixed={SCOPE_H} icon={IconCalendar} title={scopeText3.milestones[0]} hint={scopeText3.milestones[1]}>
                    <MilestoneList items={timeline} onChange={edit("timeline", setTimeline)} />
                    {durTotal && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg bg-primary/5 p-3">
                            <IconClock className="mt-0.5 size-5 shrink-0 text-primary" />
                            <div>
                                <p className="text-xs font-semibold text-primary">Estimated Project Duration: {durTotal}</p>
                                <p className="text-[11px] text-muted-foreground">Timeline may vary based on client feedback and content availability.</p>
                            </div>
                        </div>
                    )}
                </Panel>
            ),
        },
        {
            key: "clientResp",
            node: (
                <Panel fixed={SCOPE_H} icon={IconUser} title="Client Responsibilities" hint="What we expect from the client during the project.">
                    <CheckList items={clientResp} onChange={edit("clientResp", setClientResp)} addLabel="Add responsibility…" />
                </Panel>
            ),
        },
        {
            key: "exclusions",
            node: (
                <Panel fixed={SCOPE_H} icon={IconX} title={scopeText3.exclusions[0]} hint={scopeText3.exclusions[1]}>
                    <CheckList items={exclusions} onChange={edit("exclusions", setExclusions)} addLabel="Add exclusion…" tone="danger" />
                </Panel>
            ),
        },
    ].filter((b) => !scopeHidden.includes(b.key));

    const scopeStep = (
        <div className="space-y-4">
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="grid gap-4 lg:grid-cols-2">
                    <Panel fixed={SCOPE_H} icon={IconFileText} title="Project Overview" hint="Provide a brief overview of the project and its objectives.">
                        <div className="space-y-3">
                            <Field label="Project Title" required>
                                <Input value={title} onChange={(e) => { touch("title"); setTitle(e.target.value); }} placeholder={`${svcLabel || "Quotation"} — ${snap.companyName || clientName || "Client"}`} />
                            </Field>
                            <Field label="Project Overview" required>
                                <Textarea rows={6} maxLength={1000} className="resize-none" value={overview} onChange={(e) => { touch("overview"); setOverview(e.target.value); }} placeholder="Describe the project…" />
                                <p className="text-right text-[11px] text-muted-foreground">{overview.length}/1000</p>
                            </Field>
                        </div>
                    </Panel>
                    <Panel fixed={SCOPE_H} icon={IconBox} title={scopeText3.deliverables[0]} hint={scopeText3.deliverables[1]}>
                        <TextList items={deliverables} onChange={edit("deliverables", setDeliverables)} addLabel="Add Deliverable" />
                    </Panel>
                </div>
                <Panel plain icon={IconFileText} title="Quotation Summary" right={<button type="button" onClick={() => go(0)} className="text-xs font-medium text-primary hover:underline">Edit client</button>}>
                    <div className="mb-4 flex items-center gap-3">
                        <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
                            {(snap.companyName || clientName || "?").trim().slice(0, 3).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                            <p className="truncate font-semibold leading-tight">{snap.companyName || clientName || "—"}</p>
                            <p className="line-clamp-2 text-xs text-muted-foreground">{snap.address || "—"}</p>
                        </div>
                    </div>
                    <dl className="space-y-2 text-xs">
                        <Row k="Quotation No" v="Auto-generated on save" />
                        <Row k="Date" v={date} />
                        <Row k="Valid Until" v={validUntil} />
                        <Row k="Client Contact" v={snap.contactName || "—"} />
                        <Row k="Email" v={emails.find((e) => e.trim()) || "—"} />
                        <Row k="Phone" v={snap.phone || "—"} />
                    </dl>
                </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {scopeBlocks.map((b) => (
                    <div key={b.key} className="min-w-0">{b.node}</div>
                ))}
            </div>
        </div>
    );

    const setLine = (i: number, patch: Partial<LineItem>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
    const fmtDate = (v?: string) => (v ? (parseISO(v) as Date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
    const DISCOUNTS = [0, 5, 10, 15, 20, 25, 30, 40, 50];
    const pkgRows = [
        ...(pkg ? [isUnit ? { title: pkg.name, desc: pkg.description ?? "", price: Number(unit.rate) || 0, qty: unit.qty, cycle: pkg.billingCycle as string } : { title: `${svcLabel} (${pkg.name})`, desc: pkg.description ?? "", price: pkgPrice, qty: 1, cycle: pkg.billingCycle as string }] : []),
        ...chosenAddons.map((a) => ({ title: a.name, desc: "Optional add-on", price: a.price, qty: 1, cycle: "one-time" as string })),
    ];
    const lineAmt = (l: LineItem) => (Number(l.price) || 0) * (Number(l.qty) || 1) * (1 - Math.min(100, Math.max(0, Number(l.discount) || 0)) / 100);
    const itemsSubtotal = pkgRows.reduce((a, r) => a + r.price * r.qty, 0) + lines.reduce((a, l) => a + (l.billing === "one-time" ? lineAmt(l) : 0), 0);
    const validDays = Math.max(0, Math.round(((parseISO(validUntil)?.getTime() ?? 0) - (parseISO(date)?.getTime() ?? 0)) / 86400000));
    const recYearEq = recurringMonthly * 12 + recurringYearly;
    const thCls = "border-b bg-muted/50 px-2 py-2 text-left text-xs font-semibold";

    const pricingStep = (
        <div className="space-y-4">
            {flow !== "project" && (pkg?.notes?.length ?? 0) > 0 && (
                <div className="flex items-start gap-2 rounded-xl border bg-primary/5 p-3 text-xs text-muted-foreground">
                    <IconInfoCircle className="mt-0.5 size-4 shrink-0 text-primary" />
                    <ul className="space-y-1">{pkg?.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                </div>
            )}
            <Panel
                icon={IconReceipt}
                title="Pricing & Line Items"
                hint="Configure your service pricing, quantities, discounts and additional charges."
                right={
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Validity Period">
                            <DatePicker value={validUntil} onChange={edit("validUntil", setValidUntil)} min={date} className="h-9" />
                            <p className="text-[11px] text-muted-foreground">Valid for {validDays} days.</p>
                        </Field>
                        <Field label="Tax / VAT">
                            <Select value={String(taxPct)} onValueChange={(v) => setTaxPct(Number(v))}>
                                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {TAX_OPTIONS.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>{t.label} <span className="text-muted-foreground">{t.sub}</span></SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                    </div>
                }
            >
                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead>
                            <tr>
                                <th className={cn(thCls, "w-10")}>#</th>
                                <th className={thCls}>Item / Service</th>
                                <th className={thCls}>Description</th>
                                <th className={cn(thCls, "w-20")}>Qty</th>
                                <th className={cn(thCls, "w-32")}>Unit Price ({cur})</th>
                                <th className={cn(thCls, "w-24")}>Discount</th>
                                <th className={cn(thCls, "w-28")}>Billing</th>
                                <th className={cn(thCls, "w-28 text-right")}>Amount ({cur})</th>
                                <th className={cn(thCls, "w-20 text-center")}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pkgRows.map((r, i) => (
                                <tr key={`pkg-${i}`} className="border-b align-middle bg-muted/20">
                                    <td className="px-2 py-2 text-muted-foreground">{i + 1}</td>
                                    <td className="px-2 py-2 font-medium">{r.title}</td>
                                    <td className="px-2 py-2 text-xs text-muted-foreground">{r.desc}</td>
                                    <td className="px-2 py-2">{r.qty}</td>
                                    <td className="px-2 py-2">{r.price.toLocaleString("en-US")}</td>
                                    <td className="px-2 py-2 text-muted-foreground">—</td>
                                    <td className="px-2 py-2 text-xs text-muted-foreground">{r.cycle === "one-time" ? "One-time" : r.cycle.replace("per-", "")}</td>
                                    <td className="px-2 py-2 text-right font-medium">{(r.price * r.qty).toLocaleString("en-US")}</td>
                                    <td className="px-2 py-2 text-center">
                                        <button type="button" aria-label="Edit on Services step" onClick={() => go(1)} className="text-muted-foreground hover:text-primary"><IconPencil className="size-4" /></button>
                                    </td>
                                </tr>
                            ))}
                            {lines.map((l, i) => {
                                const key = `l${i}`;
                                const ed = editing === key;
                                return (
                                    <tr key={key} className="border-b align-middle last:border-0">
                                        <td className="px-2 py-2 text-muted-foreground">{pkgRows.length + i + 1}</td>
                                        <td className="px-2 py-2">{ed ? <Input className="h-9" value={l.title} onChange={(e) => setLine(i, { title: e.target.value })} placeholder="Item / service" /> : <span className="font-medium">{l.title || "—"}</span>}</td>
                                        <td className="px-2 py-2">{ed ? <Input className="h-9" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Description" /> : <span className="text-xs text-muted-foreground">{l.description}</span>}</td>
                                        <td className="px-2 py-2"><Input className="h-9 w-16 text-center" type="number" min={1} value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) || 1 })} /></td>
                                        <td className="px-2 py-2"><Input className="h-9 w-28" type="number" min={0} value={l.price} onChange={(e) => setLine(i, { price: Number(e.target.value) || 0 })} /></td>
                                        <td className="px-2 py-2">
                                            <Select value={String(l.discount)} onValueChange={(v) => setLine(i, { discount: Number(v) })}>
                                                <SelectTrigger className="h-9 w-20"><SelectValue /></SelectTrigger>
                                                <SelectContent>{DISCOUNTS.map((d) => <SelectItem key={d} value={String(d)}>{d}%</SelectItem>)}</SelectContent>
                                            </Select>
                                        </td>
                                        <td className="px-2 py-2">
                                            <Select value={l.billing} onValueChange={(v) => setLine(i, { billing: v as LineItem["billing"] })}>
                                                <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="one-time">One-time</SelectItem>
                                                    <SelectItem value="monthly">Monthly</SelectItem>
                                                    <SelectItem value="yearly">Yearly</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="px-2 py-2 text-right font-medium">{Math.round(lineAmt(l)).toLocaleString("en-US")}</td>
                                        <td className="px-2 py-2">
                                            <div className="flex items-center justify-center gap-2">
                                                <button type="button" aria-label="Edit line" onClick={() => setEditing(ed ? null : key)} className="text-muted-foreground hover:text-primary"><IconPencil className="size-4" /></button>
                                                <button type="button" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-destructive/80 hover:text-destructive"><IconTrash className="size-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-3 w-full border-dashed bg-primary/5 text-primary" onClick={() => { setLines([...lines, { title: "", description: "", qty: 1, price: 0, discount: 0, billing: "one-time" }]); setEditing(`l${lines.length}`); }}>
                    <IconPlus className="size-4" /> Add Another Item
                </Button>
            </Panel>

            <Panel
                icon={IconDeviceFloppy}
                title="Payment Terms & Schedule"
                hint="Define how and when the client will make payments."
                right={
                    <Select
                        value={presetKey}
                        onValueChange={(v) => {
                            setPresetKey(v);
                            if (PAYMENT_PRESETS[v]) editMs(withDue(PAYMENT_PRESETS[v]));
                        }}
                    >
                        <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="50-50">50 / 50</SelectItem>
                            <SelectItem value="40-30-30">40 / 30 / 30</SelectItem>
                            <SelectItem value="100">100% upfront</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                    </Select>
                }
            >
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                    <div>
                        <p className="mb-2 text-sm font-semibold">Payment Milestones</p>
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full min-w-[560px] text-sm">
                                <thead>
                                    <tr>
                                        <th className={cn(thCls, "w-8")}>#</th>
                                        <th className={thCls}>Milestone</th>
                                        <th className={thCls}>Description</th>
                                        <th className={cn(thCls, "w-24")}>Payment %</th>
                                        <th className={cn(thCls, "w-24 text-right")}>Amount ({cur})</th>
                                        <th className={cn(thCls, "w-40")}>Due Date</th>
                                        <th className="w-8 border-b bg-muted/50" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {milestones.map((m, i) => (
                                        <tr key={i} className="border-b align-middle last:border-0">
                                            <td className="px-2 py-2 text-muted-foreground">{i + 1}</td>
                                            <td className="px-2 py-2"><Input className="h-9" value={m.label} onChange={(e) => { setPresetKey("custom"); editMs(milestones.map((x, j) => (j === i ? { ...x, label: e.target.value } : x))); }} /></td>
                                            <td className="px-2 py-2"><Input className="h-9" value={m.note} placeholder="When is it due?" onChange={(e) => editMs(milestones.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} /></td>
                                            <td className="px-2 py-2">
                                                <div className="relative">
                                                    <Input className="h-9 pr-6" type="number" min={0} max={100} value={m.percentage} onChange={(e) => { setPresetKey("custom"); editMs(milestones.map((x, j) => (j === i ? { ...x, percentage: Number(e.target.value) || 0 } : x))); }} />
                                                    <span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span>
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 text-right font-medium">{Math.round((grand * m.percentage) / 100).toLocaleString("en-US")}</td>
                                            <td className="px-2 py-2"><DatePicker className="h-9 text-xs" value={m.due ?? ""} onChange={(v) => editMs(milestones.map((x, j) => (j === i ? { ...x, due: v } : x)))} /></td>
                                            <td className="px-1">
                                                <button type="button" aria-label="Remove milestone" onClick={() => { setPresetKey("custom"); editMs(milestones.filter((_, j) => j !== i)); }} className="text-destructive/80 hover:text-destructive"><IconTrash className="size-4" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                            <Button type="button" variant="outline" size="sm" className="text-primary" onClick={() => { setPresetKey("custom"); editMs([...milestones, { label: "Milestone", percentage: 0, note: "", due: plusDaysISO(30 * milestones.length) }]); }}>
                                <IconPlus className="size-4" /> Add Milestone
                            </Button>
                            <span className="text-sm">
                                Total <span className={cn("ml-3 font-semibold", msTotal === 100 ? "text-emerald-600" : "text-destructive")}>{msTotal}%</span>
                                <span className="ml-4 font-semibold">{Math.round((grand * msTotal) / 100).toLocaleString("en-US")}</span>
                            </span>
                        </div>
                    </div>

                    <div className="space-y-3 rounded-lg border p-4 text-sm">
                        <p className="font-semibold">Payment Settings</p>
                        <div>
                            <Label className="text-xs">Payment Method(s)</Label>
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2">
                                {["Bank Transfer", "bKash", "Nagad", "Stripe (Card)"].map((mt) => (
                                    <label key={mt} className="flex items-center gap-2 text-xs">
                                        <Checkbox checked={methods.includes(mt)} onCheckedChange={(v) => setMethods(v ? [...methods, mt] : methods.filter((x) => x !== mt))} />
                                        {mt}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                            <Label className="text-xs">Advance Payment</Label>
                            <div className="flex items-center gap-2">
                                <div className="relative w-20">
                                    <Input className="h-9 pr-6" type="number" min={0} max={100} value={milestones[0]?.percentage ?? 0} disabled={!milestones[0]} onChange={(e) => { setPresetKey("custom"); editMs(milestones.map((x, j) => (j === 0 ? { ...x, percentage: Number(e.target.value) || 0 } : x))); }} />
                                    <span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span>
                                </div>
                                <Input className="h-9 w-28 bg-muted/50" readOnly value={Math.round((grand * (milestones[0]?.percentage ?? 0)) / 100).toLocaleString("en-US")} />
                            </div>
                        </div>
                    </div>
                </div>
            </Panel>
        </div>
    );

    const pricingAside = (
        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4">
            <Panel icon={IconFileText} title="Quotation Summary" hint="A detailed breakdown of costs and payment information.">
                <dl className="space-y-2 text-sm">
                    <Row k="Subtotal (Items)" v={money(itemsSubtotal, cur)} />
                    <div className="flex justify-between border-t pt-2 font-semibold"><dt>Subtotal</dt><dd>{money(calc.totals.subtotal, cur)}</dd></div>
                    <Row k={`VAT / Tax (${taxPct}%)`} v={money(calc.totals.taxAmount, cur)} />
                </dl>
                <div className="mt-3 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-3">
                    <span className="text-sm font-bold">Grand Total</span>
                    <span className="text-2xl font-bold text-primary">{money(grand, cur)}</span>
                </div>
            </Panel>
            {(recurringMonthly > 0 || recurringYearly > 0) && (
                <Panel icon={IconReceipt} title="Recurring Charges (Monthly)">
                    <dl className="space-y-2 text-sm">
                        <Row k="Monthly Recurring Fee" v={money(recurringMonthly, cur)} />
                        <Row k="Yearly Equivalent" v={money(recYearEq, cur)} />
                    </dl>
                    <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground"><IconInfoCircle className="mt-0.5 size-3.5 shrink-0" />Recurring charges will continue as per the selected payment terms.</p>
                </Panel>
            )}
            <Panel icon={IconDeviceFloppy} title="Payment Schedule Summary">
                <ol className="space-y-3">
                    {milestones.map((m, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium leading-tight">{m.label} ({m.percentage}%)</p>
                                <p className="text-[11px] text-muted-foreground">Due: {fmtDate(m.due)}</p>
                            </div>
                            <span className="font-medium">{money((grand * m.percentage) / 100, cur)}</span>
                        </li>
                    ))}
                </ol>
            </Panel>
            <section className="rounded-xl border bg-primary/5 p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><IconInfoCircle className="size-4" /> Important Notes</h3>
                <ul className="list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
                    <li>This quotation is valid for {validDays} days from the date of issue.</li>
                    <li>Prices are in {cur} and {taxPct > 0 ? `include ${taxPct}% VAT` : "exclusive of VAT"} as mentioned.</li>
                    {hasRecurringLine && <li>Recurring charges will be billed automatically.</li>}
                    <li>Payment is required as per the milestone schedule.</li>
                    <li>Project will commence after receiving the advance payment.</li>
                </ul>
            </section>
        </aside>
    );

    const TERMS_H = "h-[20rem]";
    const sel = (value: string, onChange: (v: string) => void, options: string[], suffix = "") => (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Not set" /></SelectTrigger>
            <SelectContent>
                {options.map((o) => (
                    <SelectItem key={o} value={o}>{o}{suffix}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
    const toggle = (label: string, key: keyof typeof recurring) => (
        <label className="flex items-center gap-3 text-sm">
            <Switch checked={recurring[key]} onCheckedChange={(v) => setRecurring({ ...recurring, [key]: v })} />
            {label}
        </label>
    );

    const optsWith = (cur0: string, list: string[]) => (!cur0 || list.includes(cur0) ? list : [...list, cur0].sort((x, y) => Number(x) - Number(y)));
    const rev = (label: string, hint: string, value: string, onChange: (v: string) => void, opts: string[], fee: string, onFee: (v: string) => void, icon: typeof IconUser) => (
        <Panel fixed={TERMS_H} icon={icon} title={label} hint={hint}>
            <div className="space-y-3">
                {sel(value, onChange, opts, " Revisions")}
                <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-[11px] text-muted-foreground">
                    <IconInfoCircle className="mt-1 size-4 shrink-0 text-primary" />
                    <div className="space-y-1.5">
                        <p>Fee per additional revision round ({cur}). Leave 0 for no extra charge.</p>
                        <Input className="h-8 w-28 bg-background" type="number" min={0} value={fee} onChange={(e) => onFee(e.target.value)} aria-label={`${label} extra round fee`} />
                    </div>
                </div>
            </div>
        </Panel>
    );
    const info = (text: string) => (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-[11px] text-muted-foreground">
            <IconInfoCircle className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>{text}</p>
        </div>
    );
    const radio = (name: string, checked: boolean, onSelect: () => void, children: React.ReactNode) => (
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="radio" name={name} checked={checked} onChange={onSelect} className="size-4 accent-primary" />
            {children}
        </label>
    );
    const setInclItem = (i: number, patch: Partial<BlueprintInclusion>) => edit("incl", setIncl)(incl.map((x, j) => (j === i ? { ...x, ...patch } : x)));

    const showRecurring = flow === "retainer" || (flow === "project" && hasRecurringLine);
    const supportOpts = ["1 Month", "3 Months", "6 Months", "12 Months", "24 Months"];
    const termsBlocks: { key: string; span?: boolean; node: React.ReactNode }[] = [
        {
            key: "support",
            node: (
                <Panel fixed={TERMS_H} icon={IconSettings} title="Support & Delivery" hint="Delivery estimate and free technical support after delivery.">
                    <div className="space-y-3">
                        <Field label="Estimated Delivery">
                            <Input className="h-10" value={duration} placeholder="e.g. 4–6 weeks" onChange={(e) => { touch("duration"); setDuration(e.target.value); }} />
                        </Field>
                        {flow === "project" && (
                            <Field label="Support Duration">
                                <Select value={supportDuration} onValueChange={setSupportDuration}>
                                    <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Not set" /></SelectTrigger>
                                    <SelectContent>
                                        {(supportDuration && !supportOpts.includes(supportDuration) ? [...supportOpts, supportDuration] : supportOpts).map((o) => (
                                            <SelectItem key={o} value={o}>{o}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        )}
                        {flow === "project" && supportDuration && (
                            <div className="flex items-center gap-3 rounded-lg bg-primary/10 px-4 py-2.5">
                                <IconCrown className="size-6 shrink-0 text-primary" />
                                <div>
                                    <p className="text-sm font-semibold text-primary">{supportDuration}</p>
                                    <p className="text-[11px] text-muted-foreground">Free technical support after delivery</p>
                                </div>
                            </div>
                        )}
                    </div>
                </Panel>
            ),
        },
        {
            key: "inclusions",
            span: true,
            node: (
                <Panel fixed={TERMS_H} icon={IconCircleCheck} title="Support Inclusions" hint="What is included in the technical support.">
                    <CheckList twoCol items={inclusions} onChange={edit("inclusions", setInclusions)} addLabel="Add custom support inclusion…" />
                </Panel>
            ),
        },
        {
            key: "domainHosting",
            node: (
                <Panel
                    fixed={TERMS_H}
                    icon={IconWorld}
                    title="Domain, Hosting & Inclusions"
                    hint="Renewal timers start from the order date."
                    right={
                        <Button type="button" variant="outline" size="sm" className="h-7 text-primary" onClick={() => edit("incl", setIncl)([...incl, { key: crypto.randomUUID(), label: "", kind: "other", included: true, termMonths: null, owner: "", renews: false, charge: 0, note: "" }])}>
                            <IconPlus className="size-3.5" /> Add
                        </Button>
                    }
                >
                    {incl.length === 0 && <p className="text-sm text-muted-foreground">Nothing defined for this package. Add domain, hosting or other inclusions if the package covers them.</p>}
                    <div className="space-y-3">
                        {incl.map((it, i) => (
                            <div key={it.key} className="space-y-2 rounded-lg border p-3">
                                <div className="flex items-center gap-2">
                                    <Input className="h-8 flex-1" value={it.label} placeholder="e.g. Domain" onChange={(e) => setInclItem(i, { label: e.target.value })} aria-label="Inclusion name" />
                                    <Switch checked={it.included} onCheckedChange={(v) => setInclItem(i, { included: v })} aria-label={`${it.label || "Inclusion"} included`} />
                                    <button type="button" aria-label="Remove inclusion" onClick={() => edit("incl", setIncl)(incl.filter((_, j) => j !== i))} className="text-destructive/80 hover:text-destructive"><IconTrash className="size-4" /></button>
                                </div>
                                {it.included ? (
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1.5">
                                            <Input className="h-8 w-16" type="number" min={0} value={it.termMonths ?? ""} onChange={(e) => setInclItem(i, { termMonths: e.target.value === "" ? null : Number(e.target.value) })} aria-label="Term in months" /> months
                                        </span>
                                        <label className="flex items-center gap-1.5">
                                            <Checkbox checked={it.renews} onCheckedChange={(v) => setInclItem(i, { renews: !!v })} /> Renewal timer
                                        </label>
                                        {it.owner === "client" && <span className="rounded bg-muted px-1.5 py-0.5">Client owns</span>}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        Charge if not included ({cur})
                                        <Input className="h-8 w-24" type="number" min={0} value={it.charge} onChange={(e) => setInclItem(i, { charge: Number(e.target.value) || 0 })} aria-label="Charge when not included" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </Panel>
            ),
        },
        {
            key: "exclusions",
            node: (
                <Panel fixed={TERMS_H} icon={IconX} title={flow === "production" ? "Exclusions & Additional Charges" : "Support Exclusions"} hint={flow === "production" ? "Not covered by the quoted rate." : "What is not included in the technical support."}>
                    <CheckList items={supportExcl} onChange={edit("supportExcl", setSupportExcl)} addLabel="Add custom exclusion…" tone="danger" />
                </Panel>
            ),
        },
        { key: "uiRev", node: rev("UI/UX Revisions", "Number of design revisions included in this package.", uiRev, setUiRev, optsWith(uiRev, ["1", "2", "3", "5", "10"]), extraRevFee, setExtraRevFee, IconPencil) },
        { key: "devRev", node: rev("Development Revisions", "Number of development revisions included after delivery.", devRev, setDevRev, optsWith(devRev, ["1", "3", "5", "10"]), devRevFee, setDevRevFee, IconCode) },
        {
            key: "recurring",
            node: (
                <Panel fixed={TERMS_H} icon={IconReceipt} title="Recurring Service Policy" hint="Applicable for recurring services (e.g., maintenance, SEO, hosting).">
                    <div className="space-y-3">
                        {toggle("Enable recurring billing after project completion", "billing")}
                        {toggle("Send automated invoice before each billing cycle", "invoice")}
                        {toggle("Allow service plan upgrade/downgrade anytime", "upgrade")}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <Field label="Grace Period">{sel(grace, setGrace, optsWith(grace, ["3", "7", "10", "15"]), " Days")}</Field>
                        <Field label="Suspension After">{sel(suspend, setSuspend, optsWith(suspend, ["7", "15", "30"]), " Days")}</Field>
                        <Field label="Cancellation Notice" className="col-span-2">{sel(cancelNotice, setCancelNotice, optsWith(cancelNotice, ["7", "15", "30", "60"]), " Days' Notice")}</Field>
                    </div>
                    {info("If payment is not received within the grace period, services will be temporarily suspended after the specified period.")}
                </Panel>
            ),
        },
        {
            key: "extra",
            node: (
                <Panel fixed={TERMS_H} icon={IconReceipt} title="Extra Feature Charges" hint="How additional features or change requests are charged.">
                    <div className="space-y-3">
                        {radio("extra", extraCharge === "feature", () => setExtraCharge("feature"), (
                            <>
                                <span className="w-36">Charge per feature/module</span>
                                <Input className="h-8 w-24" type="number" min={0} value={extraRate} onChange={(e) => setExtraRate(e.target.value)} aria-label="Rate per feature" />
                            </>
                        ))}
                        {radio("extra", extraCharge === "hourly", () => setExtraCharge("hourly"), (
                            <>
                                <span className="w-36">Hourly rate</span>
                                <Input className="h-8 w-24" type="number" min={0} value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} aria-label="Hourly rate" />
                            </>
                        ))}
                        {radio("extra", extraCharge === "custom", () => setExtraCharge("custom"), (
                            <>
                                <span className="w-36">Custom (Specify in terms)</span>
                                <Input className="h-8 flex-1" value={customExtra} onChange={(e) => setCustomExtra(e.target.value)} placeholder="Describe the terms" aria-label="Custom extra charge terms" />
                            </>
                        ))}
                    </div>
                </Panel>
            ),
        },
        {
            key: "ownership",
            node: (
                <Panel fixed={TERMS_H} icon={IconShieldCheck} title="Ownership & Intellectual Property" hint="Define the ownership rights after project completion.">
                    <div className="space-y-3">
                        {radio("owner", ownership === "client", () => setOwnership("client"), "Full ownership transferred to client after final payment")}
                        {radio("owner", ownership === "portfolio", () => setOwnership("portfolio"), "Webbriks retains right to showcase in portfolio")}
                        {radio("owner", ownership === "custom", () => setOwnership("custom"), "Custom terms (Specify below)")}
                        {ownership === "custom" && <Textarea rows={2} className="resize-none" value={ownershipCustom} onChange={(e) => setOwnershipCustom(e.target.value)} placeholder="Describe the ownership terms" />}
                    </div>
                </Panel>
            ),
        },
        {
            key: "general",
            node: (
                <Panel fixed={TERMS_H} icon={IconFileText} title="General Terms & Conditions" hint="Additional terms and conditions for this quotation.">
                    <TextList items={generalTerms} onChange={edit("generalTerms", setGeneralTerms)} addLabel="Add term" />
                </Panel>
            ),
        },
    ].filter((b) => {
        const hide: string[] =
            flow === "retainer"
                ? ["inclusions", "domainHosting", "exclusions"]
                : flow === "production"
                  ? ["inclusions", "domainHosting", "recurring"]
                  : [];
        if (hide.includes(b.key)) return false;
        if (b.key === "recurring") return showRecurring;
        return true;
    });

    const termsStep = (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {termsBlocks.map((b) => (
                <div key={b.key} className={cn("min-w-0", b.span && "xl:col-span-2")}>{b.node}</div>
            ))}
        </div>
    );

    const termsAside = (
        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4">
            <Panel icon={IconFileText} title="Quotation Summary">
                <dl className="space-y-2 text-sm">
                    <Row k="Quotation No" v="Auto-generated on save" />
                    <Row k="Client" v={snap.companyName || clientName || "—"} />
                    <Row k="Package" v={pkg?.name ?? "—"} />
                    <Row k="Total Amount" v={money(grand, cur)} />
                    <Row k="Validity" v={fmtDate(validUntil)} />
                </dl>
            </Panel>
            <div className="rounded-xl border bg-card p-4 shadow-xs">
                <div className="flex items-center justify-between text-sm font-semibold"><span>Step 5 of 6</span><span className="text-xs text-muted-foreground">83%</span></div>
                <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-full w-[83%] rounded-full bg-primary" /></div>
                <p className="mt-3 text-sm font-semibold">Terms, Support & Revision Policy</p>
                <p className="mt-1 text-xs text-muted-foreground">Define the support duration, revision limits, policies and general terms for this quotation.</p>
            </div>
            <section className="rounded-xl border bg-primary/5 p-4">
                <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-primary"><IconBulb className="size-4" /> Pro Tip</h3>
                <p className="text-xs text-muted-foreground">Clear terms and support policies help avoid misunderstandings and ensure a smooth project delivery.</p>
            </section>
        </aside>
    );

    // ── step 6: summary + document preview ──
    const checklist: [string, boolean][] = [
        ["Client", !!clientId],
        ["Services", !!service && (pkgs.length === 0 || !!pkg)],
        ["Scope", !!overview.trim() || deliverables.some((d) => d.trim()) || features.some((f) => f.on)],
        ["Pricing", !problem(3)],
        ["Terms", true],
        ["Preview", true],
    ];
    const ready = checklist.every(([, ok]) => ok);
    const baseTotal = isUnit ? (Number(unit.rate) || 0) * unit.qty : pkgPrice;
    const addonTotal = chosenAddons.reduce((a, x) => a + x.price, 0);
    const otherTotal = Math.max(0, itemsSubtotal - baseTotal - addonTotal);
    const primaryEmail = emails.find((e) => e.trim()) ?? "";
    const cardCls = "rounded-xl border p-4";
    const docInput = docNow();

    /** Zoom so a whole A4 page fits the preview column. */
    const fitZoom = () => {
        const w = previewBox.current?.clientWidth ?? 0;
        if (w) setZoom(Math.max(30, Math.min(100, Math.floor(((w - 32) / 794) * 20) * 5)));
    };
    // Keep the page fitted to the column (also on resize / phones) until the user picks a zoom by hand.
    useEffect(() => {
        const el = previewBox.current;
        if (step !== 5 || !el) return;
        setAutoFit(true);
        const ro = new ResizeObserver(() => autoFitRef.current && fitZoom());
        ro.observe(el);
        requestAnimationFrame(fitZoom);
        return () => ro.disconnect();
    }, [step, expanded]);

    const previewStep = (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
            <Panel
                plain
                icon={IconFileText}
                title="Quotation Summary"
                hint="Final details for developer handoff and client review."
                right={
                    <div className={cn("rounded-lg px-3 py-1.5 text-right", ready ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
                        <p className="text-xs font-semibold">{ready ? "Ready to Send" : "Incomplete"}</p>
                        <p className="text-[10px]">{ready ? "All sections completed" : "Some sections need attention"}</p>
                    </div>
                }
            >
                <div className="space-y-3">
                    <div className={cardCls}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><IconBuilding className="size-5" /></span>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold">Client</p>
                                    <p className="font-bold">{snap.companyName || clientName}</p>
                                </div>
                            </div>
                            <Button type="button" variant="outline" size="sm" className="h-7 text-primary" onClick={() => go(0)}><IconPencil className="size-3.5" /> Edit</Button>
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            <p className="flex gap-1.5"><IconMapPin className="size-3.5 shrink-0 text-primary" />{snap.address}</p>
                            <p className="flex flex-wrap gap-x-4 gap-y-1">
                                <span className="flex gap-1.5"><IconUser className="size-3.5 text-primary" />{snap.contactName}</span>
                                <span className="flex gap-1.5"><IconMail className="size-3.5 text-primary" />{primaryEmail}</span>
                                <span className="flex gap-1.5"><IconPhone className="size-3.5 text-primary" />{snap.phone}</span>
                            </p>
                        </div>
                    </div>

                    <div className={cardCls}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    {(() => { const SIcon = catalogIcon(service?.icon); return <SIcon className="size-5" />; })()}
                                </span>
                                <p className="text-sm font-semibold">Service & Package</p>
                            </div>
                            <Button type="button" variant="outline" size="sm" className="h-7 text-primary" onClick={() => go(1)}><IconPencil className="size-3.5" /> Edit</Button>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-semibold">{svcLabel || "—"}</span>
                            {platform && <span className="rounded border px-2 py-0.5 text-xs">{platform}</span>}
                            {pkg && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{pkg.name}</span>}
                        </div>
                        {service?.description && <p className="mt-1.5 text-xs text-muted-foreground">{service.description}</p>}
                    </div>

                    <div className={cardCls}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">{cur === "USD" ? "$" : "৳"}</span>
                                <p className="text-sm font-semibold">Pricing</p>
                            </div>
                            <Button type="button" variant="outline" size="sm" className="h-7 text-primary" onClick={() => go(3)}><IconPencil className="size-3.5" /> Edit</Button>
                        </div>
                        <dl className="mt-3 space-y-1.5 text-sm">
                            <Row k="Base Package Price" v={money(baseTotal, cur)} />
                            <Row k="Additional Features" v={money(addonTotal, cur)} />
                            {otherTotal > 0 && <Row k="Additional Items & Charges" v={money(otherTotal, cur)} />}
                            {calc.totals.taxAmount > 0 && <Row k={`VAT / Tax (${taxPct}%)`} v={money(calc.totals.taxAmount, cur)} />}
                            <Row k="Discount" v={money(calc.totals.discountAmount, cur)} />
                        </dl>
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2.5">
                            <span className="text-sm font-semibold">Total Amount ({cur})</span>
                            <span className="text-xl font-bold text-primary">{money(grand, cur)}</span>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className={cardCls}>
                            <p className="text-sm font-semibold">Validity Period</p>
                            <p className="mt-1 flex items-center gap-1.5 text-sm"><IconCalendar className="size-4 text-primary" />{fmtDate(validUntil)}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">This quotation will be valid for {validDays} days.</p>
                        </div>
                        <div className={cardCls}>
                            <p className="text-sm font-semibold">Prepared By</p>
                            <p className="mt-1 text-sm font-medium">{COMPANY.name}</p>
                            <p className="text-[11px] text-muted-foreground">{COMPANY.email}</p>
                        </div>
                    </div>

                    <div className={cardCls}>
                        <p className="flex items-center gap-2 text-sm font-semibold"><IconCircleCheck className="size-5 fill-primary text-primary-foreground" /> Completion Checklist</p>
                        <p className="mb-3 text-[11px] text-muted-foreground">{ready ? "All sections completed. This quotation is ready to be sent." : "Complete the highlighted sections before sending."}</p>
                        <ul className="grid grid-cols-3 gap-2">
                            {checklist.map(([l, ok]) => (
                                <li key={l} className="flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-center">
                                    <IconCircleCheck className={cn("size-5", ok ? "fill-emerald-500 text-white" : "text-muted-foreground")} />
                                    <span className="text-xs font-medium">{l}</span>
                                    <span className="text-[10px] text-muted-foreground">{ok ? "Completed" : "Incomplete"}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </Panel>

            <section className={cn("rounded-xl border bg-card p-4 shadow-xs md:p-5", expanded && "fixed inset-4 z-50 overflow-hidden shadow-2xl")}>
                <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-semibold">Quotation Preview</h3>
                        <p className="text-xs text-muted-foreground">This is how the quotation will appear to your client.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="icon" className="size-8" aria-label={expanded ? "Exit full screen" : "Full screen"} onClick={() => setExpanded(!expanded)}>
                            {expanded ? <IconArrowsMinimize className="size-4" /> : <IconArrowsMaximize className="size-4" />}
                        </Button>
                        <div className="flex items-center rounded-md border">
                            <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Zoom out" disabled={zoom <= 30} onClick={() => { setAutoFit(false); setZoom(zoom - 10); }}><IconMinus className="size-4" /></Button>
                            <span className="w-12 text-center text-xs">{zoom}%</span>
                            <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Zoom in" disabled={zoom >= 150} onClick={() => { setAutoFit(false); setZoom(zoom + 10); }}><IconPlus className="size-4" /></Button>
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => { setAutoFit(true); fitZoom(); }}>Fit</Button>
                        <Button type="button" variant="ghost" size="sm" className="h-8" disabled={pdfBusy} onClick={() => printDoc(docNow())}>Print</Button>
                        <Button type="button" variant="outline" size="sm" className="h-8" disabled={pdfBusy || saving} onClick={downloadPdf}>
                            <IconDownload className="size-4" /> Download PDF
                        </Button>
                    </div>
                </header>
                <div ref={previewBox} className="rounded-lg bg-[#e7e7eb] dark:bg-[#26262c]">
                    <ScrollArea className={cn(expanded ? "h-[calc(100vh-10rem)]" : "h-[68vh]")}>
                        <div className="mx-auto w-fit p-4">
                            <QuotationDocument data={docInput} zoom={zoom / 100} />
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
            </section>
        </div>
    );

    const bodies = [clientStep, servicesStep, scopeStep, pricingStep, termsStep, previewStep];

    return (
        <div className={"space-y-5 pb-24"}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Create New Quotation</h1>
                    <p className="text-sm text-muted-foreground">{step === 5 ? "Review the complete quotation details and send it to the client." : "Select client, service, package and customise the details for this quotation."}</p>
                </div>
                <div className="flex items-center gap-2">
                    {step === 5 && <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"><span className="size-2 rounded-full bg-muted-foreground" />Draft</span>}
                    <Button type="button" variant="outline" disabled={saving} onClick={save}>
                        <IconDeviceFloppy className="size-4" /> {saving ? "Saving…" : "Save Draft"}
                    </Button>
                    {step < 5 ? (
                        <Button type="button" disabled={creatingClient} onClick={() => go(step + 1)}>
                            {creatingClient ? "Creating client…" : `Continue to ${STEPS[step + 1].title}`} <IconArrowRight className="size-4" />
                        </Button>
                    ) : (
                        <>
                            <Button type="button" variant="outline" disabled={pdfBusy || saving} onClick={downloadPdf}>Preview PDF</Button>
                            <Button type="button" disabled={saving || sending || !ready} onClick={openSend}>
                                <IconSend className="size-4" /> Send to Client
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <Stepper step={step} maxStep={maxStep} onGo={go} />

            <div className={cn("grid items-start gap-5", step !== 5 && step !== 0 && step !== 2 && (step === 1 ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "xl:grid-cols-[minmax(0,1fr)_300px]"))}>
                <div className="min-w-0">{bodies[step]}</div>

                {step === 1 && (
                    <aside className="min-w-0 space-y-4 xl:sticky xl:top-4">
                        <Panel plain icon={IconFileText} title="Package Summary" right={pkg ? <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{pkg.name}</span> : undefined}>
                            {service ? (
                                <div className="space-y-4 text-sm">
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                            {(() => { const SIcon = catalogIcon(service.icon); return <SIcon className="size-6" />; })()}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="font-semibold leading-tight">{svcLabel}</p>
                                            <p className="text-xs text-muted-foreground">{service.description}</p>
                                        </div>
                                    </div>
                                    <dl className="space-y-2 border-t pt-3">
                                        {platform && (
                                            <div className="flex items-center justify-between gap-3 text-xs">
                                                <dt className="text-muted-foreground">Platform / Technology</dt>
                                                <dd className="flex items-center gap-1.5 font-medium">
                                                    {(() => { const pf = service.platforms.find((x) => x._id === platformId); return pf?.logo ? <BrandLogo name={pf.logo} color={pf.color} className="size-4" /> : null; })()}
                                                    {platform}
                                                </dd>
                                            </div>
                                        )}
                                        {pkg && <Row k="Selected Package" v={pkg.name} />}
                                        {pkg && <Row k="Base Package Price" v={money(isUnit ? (Number(unit.rate) || 0) * unit.qty : pkgPrice, cur)} />}
                                    </dl>
                                    {features.length > 0 && (
                                        <div className="border-t pt-3">
                                            <div className="mb-2 flex items-center justify-between">
                                                <p className="text-xs font-semibold">Included Features ({features.filter((f) => f.on).length})</p>
                                                <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px] text-primary" onClick={goDetails}>Edit</Button>
                                            </div>
                                            <ul className="space-y-1.5 text-xs">
                                                {features.filter((f) => f.on).slice(0, 5).map((f) => (
                                                    <li key={f.text} className="flex items-start gap-2"><IconCircleCheck className="mt-0.5 size-4 shrink-0 fill-primary text-primary-foreground" />{f.text}</li>
                                                ))}
                                            </ul>
                                            {features.filter((f) => f.on).length > 5 && <p className="mt-1.5 text-xs text-primary">+ {features.filter((f) => f.on).length - 5} more features…</p>}
                                        </div>
                                    )}
                                    {chosenAddons.length > 0 && (
                                        <div className="border-t pt-3">
                                            <div className="mb-2 flex items-center justify-between">
                                                <p className="text-xs font-semibold">Add-on Features ({chosenAddons.length})</p>
                                                <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px] text-primary" onClick={goDetails}>Edit</Button>
                                            </div>
                                            <ul className="space-y-1.5 text-xs">
                                                {chosenAddons.map((a) => (
                                                    <li key={a._id} className="flex items-start justify-between gap-2"><span className="flex gap-2"><IconCircleCheck className="mt-0.5 size-4 shrink-0 fill-primary text-primary-foreground" />{a.name}</span><span className="shrink-0">{money(a.price, cur)}</span></li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    <dl className="space-y-1.5 border-t pt-3">
                                        <Row k="Base Package Price" v={money(isUnit ? (Number(unit.rate) || 0) * unit.qty : pkgPrice, cur)} />
                                        <Row k={`Add-on Features (${chosenAddons.length})`} v={money(chosenAddons.reduce((a, x) => a + x.price, 0), cur)} />
                                        <Row k="Discount" v={money(calc.totals.discountAmount, cur)} />
                                    </dl>
                                    <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-3">
                                        <span className="text-xs font-semibold text-primary">Total Amount ({cur})</span>
                                        <span className="text-xl font-bold text-primary">{money(grand, cur)}</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Select a service category to see the package summary.</p>
                            )}
                        </Panel>
                    </aside>
                )}
                {step === 3 && pricingAside}
                {step === 4 && termsAside}
                {step !== 5 && step !== 1 && step !== 0 && step !== 2 && step !== 3 && step !== 4 && (
                    <aside className="space-y-4 xl:sticky xl:top-4">
                        <Panel icon={IconFileText} title="Quotation Summary">
                            <dl className="space-y-2 text-sm">
                                <Row k="Client" v={snap.companyName || snap.contactName || "—"} />
                                <Row k="Services" v={svcLabel || "—"} />
                                <Row k="Valid until" v={validUntil} />
                                <Row k="Currency" v={cur} />
                            </dl>
                            <div className="mt-3 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
                                <span className="text-xs font-semibold">Total ({cur})</span>
                                <span className="font-bold text-primary">{money(grand, cur)}</span>
                            </div>
                            {(recurringMonthly > 0 || recurringYearly > 0) && (
                                <p className="mt-2 text-[11px] text-muted-foreground">
                                    + {recurringMonthly > 0 && `${money(recurringMonthly, cur)}/mo`} {recurringYearly > 0 && `${money(recurringYearly, cur)}/yr`} recurring
                                </p>
                            )}
                        </Panel>
                        <div className="rounded-xl border bg-card p-4 shadow-xs">
                            <p className="text-xs font-semibold">Step {step + 1} of 6</p>
                            <div className="mt-2 h-1.5 rounded-full bg-muted">
                                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((step + 1) / 6) * 100}%` }} />
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">{STEPS[step].sub}</p>
                        </div>
                    </aside>
                )}
            </div>

            <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur md:left-[var(--sidebar-width,0px)]">
                <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
                    <Button type="button" variant="outline" onClick={() => (step === 0 ? router.push("/quotations") : go(step - 1))}>
                        <IconArrowLeft className="size-4" /> {step === 0 ? "Back to Quotations" : `Previous: ${STEPS[step - 1].title}`}
                    </Button>
                    {step < 5 ? (
                        <Button type="button" disabled={creatingClient} onClick={() => go(step + 1)}>
                            {creatingClient ? "Creating client…" : `Continue to ${STEPS[step + 1].title}`} <IconArrowRight className="size-4" />
                        </Button>
                    ) : (
                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="outline" disabled={pdfBusy || saving} onClick={downloadPdf}>
                                <IconDownload className="size-4" /> {pdfBusy ? "Preparing…" : "Download PDF"}
                            </Button>
                            <Button type="button" disabled={saving || sending || !ready} onClick={openSend}>
                                <IconSend className="size-4" /> Send to Client
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {pdfStage}
            {printHost}
            <QuotationEmailDialog
                open={pickerOpen}
                clientId={clientId}
                quotationLabel={`${savedNo || "Quotation"} • ${title.trim() || svcLabel}`}
                extraEmails={emails.filter((e) => e.trim())}
                onClose={() => {
                    if (sending) return;
                    setPickerOpen(false);
                    if (sentOnce && savedId) router.push(`/quotations/${savedId}`);
                }}
                onSend={confirmSend}
                isSending={sending}
            />
        </div>
    );
}

function Row({ k, v }: { k: string; v: string }) {
    return (
        <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="truncate text-right font-medium">{v}</dd>
        </div>
    );
}

/** Feature checklist with per-row edit / delete and an inline "Add Custom Feature" (Cancel / Add). */
function FeatureEditor({ items, onChange }: { items: CheckItem[]; onChange: (n: CheckItem[]) => void }) {
    const [editing, setEditing] = useState<number | null>(null);
    return (
        // the p-1 inside the -mx-1 viewport leaves room for focus rings, so they are never clipped
        <ScrollArea className="-mx-1 h-[26rem]">
            <div className="space-y-1 p-1 pr-4">
                {items.map((it, i) => (
                    <div key={i}>
                        {it.group && it.group !== items[i - 1]?.group && (
                            <p className="px-1 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground first:pt-0">{it.group}</p>
                        )}
                        <div className="flex items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-muted/50">
                            <IconGripVertical className="size-4 shrink-0 text-muted-foreground/60" />
                            <Checkbox checked={it.on} onCheckedChange={(v) => onChange(items.map((x, j) => (j === i ? { ...x, on: !!v } : x)))} />
                            {editing === i ? (
                                <Input
                                    autoFocus
                                    className="h-8 flex-1"
                                    value={it.text}
                                    onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                                    onBlur={() => setEditing(null)}
                                    onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && setEditing(null)}
                                />
                            ) : (
                                <span className={cn("flex-1 text-sm", !it.on && "text-muted-foreground line-through")}>{it.text}</span>
                            )}
                            <button type="button" aria-label="Edit feature" onClick={() => setEditing(i)} className="text-muted-foreground hover:text-primary"><IconPencil className="size-4" /></button>
                            <button type="button" aria-label="Remove feature" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-destructive/80 hover:text-destructive"><IconTrash className="size-4" /></button>
                        </div>
                    </div>
                ))}
                <div className="pt-2">
                    <AddInline label="Add Custom Feature" placeholder="Feature name…" onAdd={(text) => onChange([...items, { text, on: true }])} />
                </div>
            </div>
        </ScrollArea>
    );
}
