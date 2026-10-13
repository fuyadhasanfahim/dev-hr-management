'use client';

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    IconArrowLeft,
    IconArrowRight,
    IconBuilding,
    IconCheck,
    IconCircleCheck,
    IconCode,
    IconDeviceFloppy,
    IconGripVertical,
    IconInfoCircle,
    IconPencil,
    IconStarFilled,
    IconFileText,
    IconListCheck,
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
import { cn } from "@/lib/utils";

import { useGetClientsQuery } from "@/redux/features/client/clientApi";
import { useCreateQuotationMutation } from "@/redux/features/quotation/quotationApi";
import { useGetCatalogTreeQuery } from "@/redux/features/catalog/catalogApi";
import { catalogIcon } from "@/lib/catalog-icons";
import { BrandLogo } from "@/components/catalog/BrandLogo";
import type { CatalogTreePackage, CatalogTreeService } from "@/types/catalog.type";
import { Client } from "@/types/client.type";
import type { BillingCycle, IQuotationService, QuotationCategory } from "@/types/quotation.type";
import { computeQuotationTotals } from "@/lib/quotation-totals";

// ───────────────────────────── types & constants ─────────────────────────────

type CheckItem = { text: string; on: boolean; price?: number; id?: string; group?: string };
type LineItem = { title: string; description: string; qty: number; price: number; billing: "one-time" | "monthly" | "yearly" };
type Milestone = { label: string; percentage: number; note: string };
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

const SUPPORT_INCLUSIONS = [
    "Bug fixes and error resolution",
    "Minor content updates (text, images)",
    "Server and deployment support",
    "Performance monitoring assistance",
    "CMS usage guidance and basic training",
];
const SUPPORT_EXCLUSIONS = [
    "Major feature additions or new modules",
    "Design changes or layout modifications",
    "Third-party plugin or software license costs",
    "Content creation (text, images, videos)",
    "Server, hosting or domain renewal fees",
];
const HANDOVER = [
    "All approved features are developed",
    "Client review and final approval received",
    "Full payment has been completed",
    "Source code, assets and documentation delivered",
];
const GENERAL_TERMS = [
    "This quotation is valid for 30 days from the date of issue.",
    "The project timeline may vary based on client responsiveness.",
    "All third-party costs (plugins, licenses, hosting, domain etc.) will be borne by the client.",
];

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
}: {
    icon: typeof IconUser;
    title: string;
    hint?: string;
    children: React.ReactNode;
    className?: string;
    right?: React.ReactNode;
}) {
    return (
        <section className={cn("rounded-xl border bg-card p-4 shadow-xs md:p-5", className)}>
            <header className="mb-4 flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold leading-tight">{title}</h3>
                    {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
                </div>
                {right}
            </header>
            {children}
        </section>
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

/** Checkbox list with inline "add custom" row; used for features, inclusions, exclusions, responsibilities. */
function CheckList({
    items,
    onChange,
    addLabel,
    tone = "primary",
}: {
    items: CheckItem[];
    onChange: (next: CheckItem[]) => void;
    addLabel: string;
    tone?: "primary" | "danger";
}) {
    const [draft, setDraft] = useState("");
    const add = () => {
        const text = draft.trim();
        if (!text) return;
        onChange([...items, { text, on: true }]);
        setDraft("");
    };
    return (
        <div className="space-y-1.5">
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
            <div className="flex gap-2 pt-1">
                <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
                    placeholder={addLabel}
                    className="h-9"
                />
                <Button type="button" variant="outline" size="sm" className="h-9 text-primary" onClick={add}>
                    <IconPlus className="size-4" /> Add
                </Button>
            </div>
        </div>
    );
}

/** Plain editable string list (deliverables, milestones etc.). */
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
            <Button type="button" variant="outline" size="sm" className="w-full border-dashed text-primary" onClick={() => onChange([...items, ""])}>
                <IconPlus className="size-4" /> {addLabel}
            </Button>
        </div>
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
    const [createQuotation, { isLoading: saving }] = useCreateQuotationMutation();

    const [step, setStep] = useState(0);
    const [maxStep, setMaxStep] = useState(0);

    // step 1
    const [clientId, setClientId] = useState("");
    const [snap, setSnap] = useState({ contactName: "", companyName: "", email: "", phone: "", address: "" });
    const [title, setTitle] = useState("");
    const [currency, setCurrency] = useState<"BDT" | "USD">("BDT");
    const [date, setDate] = useState(todayISO());
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
    const [duration, setDuration] = useState("3 – 4 Weeks");
    const [supportPeriod, setSupportPeriod] = useState("6 Months (Free Support)");
    const [unit, setUnit] = useState<UnitService>({ qty: 1, rate: 0 });

    // step 3
    const [overview, setOverview] = useState("");
    const [scopeText, setScopeText] = useState("");
    const [deliverables, setDeliverables] = useState<string[]>([]);
    const [timeline, setTimeline] = useState<string[]>([]);
    const [clientResp, setClientResp] = useState<CheckItem[]>([
        { text: "Provide all required content (text, images, product details)", on: true },
        { text: "Timely feedback on design and development deliverables", on: true },
        { text: "Provide access to domain, hosting and third-party accounts", on: true },
    ]);
    const [exclusions, setExclusions] = useState<string[]>([]);

    // step 4
    const [lines, setLines] = useState<LineItem[]>([{ title: "", description: "", qty: 1, price: 0, billing: "one-time" }]);
    const [discountPct, setDiscountPct] = useState(0);
    const [presetKey, setPresetKey] = useState("50-50");
    const [milestones, setMilestones] = useState<Milestone[]>(PAYMENT_PRESETS["50-50"]);

    // step 5
    const [supportDuration, setSupportDuration] = useState("12 Months");
    const [inclusions, setInclusions] = useState<CheckItem[]>(SUPPORT_INCLUSIONS.map((text) => ({ text, on: true })));
    const [supportExcl, setSupportExcl] = useState<CheckItem[]>(SUPPORT_EXCLUSIONS.map((text) => ({ text, on: true })));
    const [uiRev, setUiRev] = useState("3");
    const [devRev, setDevRev] = useState("5");
    const [extraRevFee, setExtraRevFee] = useState("");
    const [handover, setHandover] = useState<CheckItem[]>(HANDOVER.map((text) => ({ text, on: true })));
    const [recurring, setRecurring] = useState({ billing: true, invoice: true, report: false, upgrade: false });
    const [grace, setGrace] = useState("7");
    const [suspend, setSuspend] = useState("15");
    const [cancelNotice, setCancelNotice] = useState("30");
    const [extraCharge, setExtraCharge] = useState<"feature" | "hourly" | "custom">("feature");
    const [extraRate, setExtraRate] = useState("");
    const [ownership, setOwnership] = useState<"client" | "portfolio" | "custom">("client");
    const [generalTerms, setGeneralTerms] = useState<string[]>(GENERAL_TERMS);

    const cur = currency;
    const hasRecurringLine = lines.some((l) => l.billing !== "one-time");

    // ── selected service → platform → package → add-ons (all from the catalog, by id) ──
    const service = tree.find((x) => x._id === serviceId);
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
        const manual = lines
            .filter((l) => l.title.trim())
            .map((l) => item(l.title.trim(), Number(l.price) || 0, l.description.trim() || undefined, Number(l.qty) || 1, l.billing as BillingCycle));
        const base: IQuotationService = {
            category,
            catalogServiceId: service._id,
            catalogPlatformId: platformId || null,
            catalogPackageId: pkg?._id ?? null,
            catalogFeatureIds: [...features.filter((f) => f.on && f.id).map((f) => f.id as string), ...chosenAddons.map((a) => a._id)],
            scopeDescription: scopeText.trim() || undefined,
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
            if (!clientId) return "Please select a client";
            if (!title.trim()) return "Project title is required";
            if (new Date(validUntil) < new Date(date)) return "Valid-until date cannot be earlier than the quotation date";
        }
        if (s === 1) {
            if (!service) return "Select a service category";
            if (service.platforms.length > 0 && !platformId) return "Select a platform";
            if (pkgs.length > 0 && !pkg) return "Select a package";
        }
        if (s === 3) {
            if (grand <= 0 && recurringMonthly + recurringYearly <= 0) return "Add at least one priced item";
            if (msTotal !== 100) return `Payment milestones must total 100% (now ${msTotal}%)`;
        }
        return null;
    };

    const go = (to: number) => {
        if (to > step) {
            const p = problem(step);
            if (p) return toast.error(p);
        }
        setStep(to);
        setMaxStep((m) => Math.max(m, to));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    /** Choosing a package loads its features and pre-fills the package-specific Terms content. */
    const selectPackage = (p: CatalogTreePackage) => {
        setPkgId(p._id);
        setAddonsOn([]);
        setCustomPrice(0);
        setUnit({ qty: 1, rate: p.price ?? 0 });
        setFeatures(p.features.map((f) => ({ text: f.name, on: true, id: f._id, group: f.group })));
        if (p.duration) setDuration(p.duration);
        if (p.supportPeriod) setSupportPeriod(`${p.supportPeriod} (Free Support)`);
        if (p.supportInclusions.length) setInclusions(p.supportInclusions.map((text) => ({ text, on: true })));
        if (p.additionalCharges.length) setSupportExcl(p.additionalCharges.map((text) => ({ text, on: true })));
        setGeneralTerms([...GENERAL_TERMS, ...p.notes]);
    };

    const pickPlatform = (id: string) => {
        setPlatformId(id);
        const first = defaultPkg((service?.packages ?? []).filter((x) => (x.platformId ?? "") === id));
        if (first) selectPackage(first);
        else { setPkgId(""); setFeatures([]); }
    };

    const pickService = (s: CatalogTreeService) => {
        setServiceId(s._id);
        const firstPlatform = s.platforms[0]?._id ?? "";
        setPlatformId(firstPlatform);
        const first = defaultPkg(s.packages.filter((x) => (x.platformId ?? "") === firstPlatform));
        if (first) selectPackage(first);
        else { setPkgId(""); setFeatures([]); }
    };

    const pickClient = (id: string) => {
        const c = clientsData?.clients?.find((x: Client) => x._id === id);
        if (!c) return;
        setClientId(id);
        setSnap({
            contactName: c.name || "Valued Client",
            companyName: c.name || "",
            email: c.emails?.[0] || "",
            phone: c.phone || "",
            address: c.address || c.officeAddress || "",
        });
        if (c.currency === "USD") setCurrency("USD");
    };

    // ── save ──
    const buildPayload = () => {
        const msg = (n: string, v: string) => (v.trim() ? `${n}: ${v.trim()}` : "");
        const supportLines = [
            `Technical support duration: ${supportDuration}`,
            ...(duration ? [`Estimated delivery: ${duration}`] : []),
            ...(supportPeriod ? [`Support period: ${supportPeriod}`] : []),
            ...inclusions.filter((i) => i.on).map((i) => i.text),
        ];
        const keyTerms = [
            `UI/UX revisions included: ${uiRev}; development revisions included: ${devRev}.${extraRevFee ? ` Additional revisions are charged at ${extraRevFee} per round.` : ""}`,
            extraCharge === "feature"
                ? `Extra features / change requests are charged per feature${extraRate ? ` at ${extraRate}` : ""}.`
                : extraCharge === "hourly"
                  ? `Extra work is charged hourly${extraRate ? ` at ${extraRate} per hour` : ""}.`
                  : msg("Extra work", extraRate),
            ownership === "client"
                ? "Full ownership is transferred to the client after final payment."
                : ownership === "portfolio"
                  ? "WebBriks retains the right to showcase the project in its portfolio."
                  : "",
            hasRecurringLine
                ? `Recurring services: ${[
                      recurring.billing && "billing resumes after project completion",
                      recurring.invoice && "invoice is sent before each billing cycle",
                      recurring.report && "monthly performance report included",
                      recurring.upgrade && "plan upgrade/downgrade allowed anytime",
                  ]
                      .filter(Boolean)
                      .join("; ")}. Grace period ${grace} days, services suspended after ${suspend} days of non-payment. Cancellation requires ${cancelNotice} days' written notice.`
                : "",
            ...handover.filter((h) => h.on).map((h) => `Handover condition: ${h.text}`),
            ...generalTerms.filter((t) => t.trim()),
        ].filter(Boolean);

        const overviewFull = [overview.trim()].filter(Boolean).join("\n\n");

        return {
            serviceType: (category ?? "web-development") as QuotationCategory,
            clientId,
            currency,
            company: {
                name: "WebBriks",
                address: "115 Senpara Parbata, Mirpur, Dhaka 1216, Bangladesh.",
                email: "info@webbriks.com",
                phone: "+8801977201923",
                website: "www.webbriks.com",
                logo: "/assets/image/logo.svg",
            },
            client: snap,
            details: { title: title.trim() || "Untitled Project", date: new Date(date).toISOString(), validUntil: new Date(validUntil).toISOString() },
            overview: overviewFull,
            services: builtServices,
            notIncluded: [...exclusions.filter((e) => e.trim()), ...supportExcl.filter((s) => s.on).map((s) => s.text)],
            clientRequirements: clientResp.filter((c) => c.on).map((c) => c.text),
            includedSupport: supportLines,
            keyTerms,
            workflow: [...deliverables.filter((d) => d.trim()).map((d) => `Deliverable: ${d}`), ...timeline.filter((t) => t.trim())],
            paymentMilestones: milestones.map((m) => ({ label: m.label, percentage: Number(m.percentage) || 0, note: m.note || undefined })),
            status: "draft",
        };
    };

    const save = async () => {
        for (let s = 0; s <= 3; s++) {
            const p = problem(s);
            if (p) {
                setStep(s);
                return toast.error(p);
            }
        }
        try {
            const res = await createQuotation(buildPayload() as never).unwrap();
            toast.success("Quotation saved as draft");
            router.push(`/quotations/${res._id}`);
        } catch (err) {
            toast.error((err as { data?: { message?: string } })?.data?.message || "Failed to save quotation.");
        }
    };

    // ───────────── step bodies ─────────────

    const clientStep = (
        <Panel icon={IconBuilding} title="Client Details" hint="Pick the client this quotation is for, then name the project.">
            <div className="grid gap-4 md:grid-cols-3">
                <Field label="Client" required className="md:col-span-2">
                    <Select value={clientId} onValueChange={pickClient}>
                        <SelectTrigger className="h-10 w-full">
                            <SelectValue placeholder={clientsLoading ? "Loading clients…" : "Select a client"} />
                        </SelectTrigger>
                        <SelectContent>
                            {clientsData?.clients?.map((c: Client) => (
                                <SelectItem key={c._id} value={c._id}>
                                    {c.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                <Field label="Currency" required>
                    <Select value={currency} onValueChange={(v) => setCurrency(v as "BDT" | "USD")}>
                        <SelectTrigger className="h-10 w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="BDT">BDT (৳) — Bangladeshi Taka</SelectItem>
                            <SelectItem value="USD">USD ($) — US Dollar</SelectItem>
                        </SelectContent>
                    </Select>
                </Field>
                <Field label="Contact Person">
                    <Input value={snap.contactName} onChange={(e) => setSnap({ ...snap, contactName: e.target.value })} />
                </Field>
                <Field label="Company Name">
                    <Input value={snap.companyName} onChange={(e) => setSnap({ ...snap, companyName: e.target.value })} />
                </Field>
                <Field label="Email Address">
                    <Input type="email" value={snap.email} onChange={(e) => setSnap({ ...snap, email: e.target.value })} />
                </Field>
                <Field label="Phone Number">
                    <Input value={snap.phone} onChange={(e) => setSnap({ ...snap, phone: e.target.value })} />
                </Field>
                <Field label="Billing Address" className="md:col-span-2">
                    <Input value={snap.address} onChange={(e) => setSnap({ ...snap, address: e.target.value })} />
                </Field>
                <Field label="Project Title" required className="md:col-span-3">
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. E-Commerce Website Development — ABC Fashion Ltd." />
                </Field>
                <Field label="Quotation Date" required>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <Field label="Valid Until" required>
                    <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </Field>
                <Field label="VAT / Tax (%)">
                    <Input type="number" min={0} max={100} value={taxPct} onChange={(e) => setTaxPct(Number(e.target.value) || 0)} />
                </Field>
            </div>
        </Panel>
    );

    const servicesStep = (
        <div className="space-y-4">
            <div className="grid items-start gap-4 2xl:grid-cols-2">
                <div className="space-y-4">
                    <Panel icon={IconListCheck} title="1. Select Service Category" hint="Choose the service you want to include in this quotation.">
                        {catalogLoading && <p className="text-sm text-muted-foreground">Loading services…</p>}
                        {!catalogLoading && tree.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                No services in the catalog yet. Add them from <Link href="/catalog" className="text-primary underline">Service Catalog</Link>.
                            </p>
                        )}
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                    </Panel>

                    {service && service.platforms.length > 0 && (
                        <Panel icon={IconCode} title="2. Select Platform / Technology" hint="Choose the technology stack for your project.">
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                        </Panel>
                    )}

                    {service && pkgs.length > 0 && (
                        <Panel icon={IconListCheck} title={`${service.platforms.length > 0 ? "3" : "2"}. Select Package`} hint={isUnit ? "Choose what you are quoting, then set quantity and rate." : "Choose a package or go with custom build."}>
                            <div className={cn("grid gap-3", pkgs.length > 2 ? "md:grid-cols-3" : "md:grid-cols-2")}>
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
                        </Panel>
                    )}
                    {service && pkgs.length === 0 && (
                        <Panel icon={IconInfoCircle} title="Packages" hint="No packages defined for this selection.">
                            <p className="text-sm text-muted-foreground">
                                Add packages in <Link href="/catalog" className="text-primary underline">Service Catalog</Link>, or price this service with line items on the Pricing step.
                            </p>
                        </Panel>
                    )}
                </div>

                {service && pkg && (
                    <div className="space-y-4">
                        <Panel
                            icon={IconSettings}
                            title={`${service.platforms.length > 0 ? "4" : "3"}. Included Features`}
                            hint="Edit, add or remove features for this quotation."
                            right={
                                <Button type="button" variant="outline" size="sm" className="h-7 text-primary" onClick={() => selectPackage(pkg)}>
                                    Reset to Package
                                </Button>
                            }
                        >
                            <FeatureEditor items={features} onChange={setFeatures} />
                        </Panel>
                        {addonList.length > 0 && (
                            <Panel icon={IconPlus} title={`${service.platforms.length > 0 ? "5" : "4"}. Optional Add-on Features`} hint="Add features to enhance the package.">
                                <ul className="divide-y">
                                    {addonList.map((a) => (
                                        <li key={a._id}>
                                            <label className="flex cursor-pointer items-center gap-3 py-2 text-sm">
                                                <Checkbox
                                                    checked={addonsOn.includes(a._id)}
                                                    onCheckedChange={(v) => setAddonsOn(v ? [...addonsOn, a._id] : addonsOn.filter((n) => n !== a._id))}
                                                />
                                                <span className="flex-1">{a.name}</span>
                                                <IconInfoCircle className="size-4 text-muted-foreground" />
                                                <span className="w-20 text-right font-medium">{money(a.price, cur)}</span>
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                            </Panel>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    const scopeStep = (
        <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
                <Panel icon={IconFileText} title="Project Overview" hint="A brief overview of the project and its objectives.">
                    <Textarea rows={7} value={overview} onChange={(e) => setOverview(e.target.value)} placeholder="Design and develop a modern, scalable…" />
                    <p className="mt-1 text-right text-[11px] text-muted-foreground">{overview.length}/1000</p>
                </Panel>
                <Panel icon={IconFileText} title="Scope of Work" hint="Define the overall scope of work for this project.">
                    <Textarea rows={7} value={scopeText} onChange={(e) => setScopeText(e.target.value)} placeholder="The scope includes UI/UX design, frontend & backend development…" />
                    <p className="mt-1 text-right text-[11px] text-muted-foreground">{scopeText.length}/1000</p>
                </Panel>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                <Panel icon={IconListCheck} title="Deliverables" hint="List the key deliverables for this project.">
                    <TextList items={deliverables} onChange={setDeliverables} addLabel="Add deliverable" />
                </Panel>
                <Panel icon={IconReceipt} title="Project Milestones & Timeline" hint="Major milestones and estimated time, e.g. “UI/UX Design & Approval — 1 week”.">
                    <TextList items={timeline} onChange={setTimeline} addLabel="Add milestone" />
                </Panel>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                <Panel icon={IconUser} title="Client Responsibilities" hint="What we expect from the client during the project.">
                    <CheckList items={clientResp} onChange={setClientResp} addLabel="Add responsibility…" />
                </Panel>
                <Panel icon={IconX} title="Exclusions" hint="Clearly mention what is not included in this quotation.">
                    <TextList items={exclusions} onChange={setExclusions} addLabel="Add exclusion" />
                </Panel>
            </div>
        </div>
    );

    const setLine = (i: number, patch: Partial<LineItem>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
    const pricingStep = (
        <div className="space-y-4">
            <Panel icon={IconReceipt} title="Pricing & Line Items" hint="Configure your service pricing, quantities and recurring charges.">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead>
                            <tr className="border-b text-left text-xs text-muted-foreground">
                                <th className="w-8 pb-2">#</th>
                                <th className="pb-2">Item / Service</th>
                                <th className="pb-2">Description</th>
                                <th className="w-20 pb-2">Qty</th>
                                <th className="w-32 pb-2">Unit Price ({cur})</th>
                                <th className="w-32 pb-2">Billing</th>
                                <th className="w-28 pb-2 text-right">Amount</th>
                                <th className="w-8" />
                            </tr>
                        </thead>
                        <tbody>
                            {[...(pkg ? [isUnit ? { title: pkg.name, price: Number(unit.rate) || 0, qty: unit.qty, billing: pkg.billingCycle } : { title: `${svcLabel} (${pkg.name})`, price: pkgPrice, qty: 1, billing: pkg.billingCycle }] : []), ...chosenAddons.map((a) => ({ title: a.name, price: a.price, qty: 1, billing: "one-time" }))].map((r, i) => (
                                <tr key={`pkg-${i}`} className="border-b align-top bg-muted/30">
                                    <td className="py-2 pr-2 pt-3 text-muted-foreground">{i + 1}</td>
                                    <td className="py-2 pr-2 pt-3 font-medium" colSpan={2}>{r.title} <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">From Services step</span></td>
                                    <td className="py-2 pr-2 pt-3">{r.qty}</td>
                                    <td className="py-2 pr-2 pt-3">{money(r.price, cur)}</td>
                                    <td className="py-2 pr-2 pt-3 text-muted-foreground">{r.billing === "one-time" ? "One-time" : r.billing}</td>
                                    <td className="py-2 pr-2 pt-3 text-right font-medium">{money(r.price * r.qty, cur)}</td>
                                    <td />
                                </tr>
                            ))}
                            {lines.map((l, i) => (
                                <tr key={i} className="border-b last:border-0 align-top">
                                    <td className="py-2 pr-2 text-muted-foreground">{i + 1}</td>
                                    <td className="py-2 pr-2"><Input className="h-9" value={l.title} onChange={(e) => setLine(i, { title: e.target.value })} placeholder="Website Development" /></td>
                                    <td className="py-2 pr-2"><Input className="h-9" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Optional" /></td>
                                    <td className="py-2 pr-2"><Input className="h-9" type="number" min={1} value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) || 1 })} /></td>
                                    <td className="py-2 pr-2"><Input className="h-9" type="number" min={0} value={l.price} onChange={(e) => setLine(i, { price: Number(e.target.value) || 0 })} /></td>
                                    <td className="py-2 pr-2">
                                        <Select value={l.billing} onValueChange={(v) => setLine(i, { billing: v as LineItem["billing"] })}>
                                            <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="one-time">One-time</SelectItem>
                                                <SelectItem value="monthly">Monthly</SelectItem>
                                                <SelectItem value="yearly">Yearly</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="py-2 pr-2 pt-3 text-right font-medium">{money(l.price * l.qty, cur)}</td>
                                    <td className="py-2 pt-2.5">
                                        <button type="button" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                                            <IconTrash className="size-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-3 w-full border-dashed text-primary" onClick={() => setLines([...lines, { title: "", description: "", qty: 1, price: 0, billing: "one-time" }])}>
                    <IconPlus className="size-4" /> Add another item
                </Button>
                <div className="mt-4 max-w-[200px]">
                    <Field label="Discount (%)">
                        <Input type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value) || 0)} />
                    </Field>
                </div>
            </Panel>

            <Panel
                icon={IconDeviceFloppy}
                title="Payment Terms & Schedule"
                hint="Define how and when the client makes payments."
                right={
                    <Select
                        value={presetKey}
                        onValueChange={(v) => {
                            setPresetKey(v);
                            if (PAYMENT_PRESETS[v]) setMilestones(PAYMENT_PRESETS[v]);
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
                <div className="space-y-2">
                    {milestones.map((m, i) => (
                        <div key={i} className="grid grid-cols-[1fr_1.4fr_90px_110px_28px] items-center gap-2 max-md:grid-cols-2">
                            <Input className="h-9" value={m.label} onChange={(e) => { setPresetKey("custom"); setMilestones(milestones.map((x, j) => (j === i ? { ...x, label: e.target.value } : x))); }} />
                            <Input className="h-9" value={m.note} placeholder="When is it due?" onChange={(e) => setMilestones(milestones.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
                            <div className="relative">
                                <Input className="h-9 pr-6" type="number" min={0} max={100} value={m.percentage} onChange={(e) => { setPresetKey("custom"); setMilestones(milestones.map((x, j) => (j === i ? { ...x, percentage: Number(e.target.value) || 0 } : x))); }} />
                                <span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span>
                            </div>
                            <span className="text-right text-sm font-medium">{money((grand * m.percentage) / 100, cur)}</span>
                            <button type="button" aria-label="Remove milestone" onClick={() => { setPresetKey("custom"); setMilestones(milestones.filter((_, j) => j !== i)); }} className="text-muted-foreground hover:text-destructive">
                                <IconTrash className="size-4" />
                            </button>
                        </div>
                    ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                    <Button type="button" variant="outline" size="sm" className="text-primary" onClick={() => { setPresetKey("custom"); setMilestones([...milestones, { label: "Milestone", percentage: 0, note: "" }]); }}>
                        <IconPlus className="size-4" /> Add milestone
                    </Button>
                    <span className={cn("text-sm font-semibold", msTotal === 100 ? "text-emerald-600" : "text-destructive")}>Total {msTotal}%</span>
                </div>
            </Panel>
        </div>
    );

    const sel = (value: string, onChange: (v: string) => void, options: string[], suffix = "") => (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
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

    const termsStep = (
        <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
                <Panel icon={IconSettings} title="Technical Support Duration" hint="How long the client receives technical support after delivery.">
                    <Field label="Support Duration">{sel(supportDuration, setSupportDuration, ["1 Month", "3 Months", "6 Months", "12 Months", "24 Months"])}</Field>
                </Panel>
                <Panel icon={IconCircleCheck} title="Support Inclusions" hint="What is included in the technical support.">
                    <CheckList items={inclusions} onChange={setInclusions} addLabel="Add custom support inclusion…" />
                </Panel>
            </div>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                <Panel icon={IconX} title="Support Exclusions" hint="What is not included in the technical support." className="xl:col-span-2">
                    <CheckList items={supportExcl} onChange={setSupportExcl} addLabel="Add custom exclusion…" tone="danger" />
                </Panel>
                <Panel icon={IconFileText} title="Revisions" hint="Included revision rounds.">
                    <div className="space-y-3">
                        <Field label="UI/UX revisions">{sel(uiRev, setUiRev, ["1", "2", "3", "5", "10"])}</Field>
                        <Field label="Development revisions">{sel(devRev, setDevRev, ["1", "3", "5", "10"])}</Field>
                        <Field label={`Extra round fee (${cur})`}><Input type="number" min={0} value={extraRevFee} onChange={(e) => setExtraRevFee(e.target.value)} /></Field>
                    </div>
                </Panel>
                <Panel icon={IconListCheck} title="Project Handover Conditions" hint="Project is complete once these are met.">
                    <CheckList items={handover} onChange={setHandover} addLabel="Add condition…" />
                </Panel>
            </div>
            {hasRecurringLine && (
                <div className="grid gap-4 lg:grid-cols-3">
                    <Panel icon={IconReceipt} title="Recurring Service Rules" hint="For maintenance, SEO, hosting etc.">
                        <div className="space-y-3">
                            {toggle("Enable recurring billing after project completion", "billing")}
                            {toggle("Send invoice before each billing cycle", "invoice")}
                            {toggle("Include monthly performance report", "report")}
                            {toggle("Allow plan upgrade/downgrade anytime", "upgrade")}
                        </div>
                    </Panel>
                    <Panel icon={IconShieldCheck} title="Suspension & Grace Policy" hint="Policy for non-payment of recurring invoices.">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Grace period (days)">{sel(grace, setGrace, ["3", "7", "10", "15"])}</Field>
                            <Field label="Suspend after (days)">{sel(suspend, setSuspend, ["7", "15", "30"])}</Field>
                        </div>
                    </Panel>
                    <Panel icon={IconX} title="Cancellation Policy" hint="Notice required for recurring services.">
                        <Field label="Notice period (days)">{sel(cancelNotice, setCancelNotice, ["7", "15", "30", "60"])}</Field>
                    </Panel>
                </div>
            )}
            <div className="grid gap-4 lg:grid-cols-3">
                <Panel icon={IconReceipt} title="Extra Feature Charges" hint="How additional features or change requests are charged.">
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {([["feature", "Per feature"], ["hourly", "Hourly"], ["custom", "Custom"]] as const).map(([k, l]) => (
                                <Button key={k} type="button" size="sm" variant={extraCharge === k ? "default" : "outline"} onClick={() => setExtraCharge(k)}>{l}</Button>
                            ))}
                        </div>
                        <Input value={extraRate} onChange={(e) => setExtraRate(e.target.value)} placeholder={extraCharge === "custom" ? "Describe terms" : `Rate (${cur})`} />
                    </div>
                </Panel>
                <Panel icon={IconShieldCheck} title="Ownership & Intellectual Property" hint="Rights after project completion.">
                    <div className="space-y-2">
                        {([["client", "Full ownership transferred to client after final payment"], ["portfolio", "WebBriks retains right to showcase in portfolio"]] as const).map(([k, l]) => (
                            <label key={k} className="flex cursor-pointer items-start gap-2 text-sm">
                                <input type="radio" name="ownership" checked={ownership === k} onChange={() => setOwnership(k)} className="mt-1 accent-primary" />
                                {l}
                            </label>
                        ))}
                    </div>
                </Panel>
                <Panel icon={IconFileText} title="General Terms & Conditions" hint="Additional terms for this quotation.">
                    <TextList items={generalTerms} onChange={setGeneralTerms} addLabel="Add term" />
                </Panel>
            </div>
        </div>
    );

    // ── step 6: summary + document preview ──
    const checklist: [string, boolean][] = [
        ["Client", !!clientId && !!title.trim()],
        ["Services", !!service && (pkgs.length === 0 || !!pkg)],
        ["Scope", !!overview.trim() || deliverables.some((d) => d.trim()) || features.some((f) => f.on)],
        ["Pricing", !problem(3)],
        ["Terms", true],
        ["Preview", true],
    ];
    const ready = checklist.every(([, ok]) => ok);

    const previewStep = (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <div className="space-y-4">
                <Panel
                    icon={IconFileText}
                    title="Quotation Summary"
                    hint="Final details before saving."
                    right={
                        <span className={cn("rounded-md px-2 py-1 text-[11px] font-semibold", ready ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
                            {ready ? "Ready to save" : "Incomplete"}
                        </span>
                    }
                >
                    <dl className="space-y-3 text-sm">
                        <SummaryRow label="Client" value={snap.companyName || snap.contactName || "—"} sub={snap.email} onEdit={() => go(0)} />
                        <SummaryRow label="Services" value={svcLabel ? `${svcLabel}${pkg ? ` · ${pkg.name}` : ""}` : "—"} onEdit={() => go(1)} />
                        <SummaryRow label="Validity" value={new Date(validUntil).toDateString()} onEdit={() => go(0)} />
                    </dl>
                    <div className="mt-4 rounded-lg bg-primary/10 px-3 py-2.5">
                        <div className="flex items-center justify-between text-sm font-semibold">
                            <span>Total Amount ({cur})</span>
                            <span className="text-lg text-primary">{money(grand, cur)}</span>
                        </div>
                    </div>
                </Panel>
                <Panel icon={IconCircleCheck} title="Completion Checklist">
                    <ul className="grid grid-cols-2 gap-2">
                        {checklist.map(([l, ok]) => (
                            <li key={l} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                                <IconCircleCheck className={cn("size-4", ok ? "text-emerald-600" : "text-muted-foreground")} />
                                {l}
                            </li>
                        ))}
                    </ul>
                </Panel>
            </div>

            <Panel icon={IconFileText} title="Quotation Preview" hint="This is roughly how the quotation will read. The final PDF is available after saving.">
                <div className="space-y-4 rounded-lg border bg-white p-5 text-[13px] text-slate-800">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-lg font-bold text-primary">WebBriks</p>
                            <p className="text-xs text-slate-500">Design | Development | Growth</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xl font-bold">Quotation</p>
                            <p className="text-xs text-slate-500">Date: {new Date(date).toDateString()}</p>
                            <p className="text-xs text-slate-500">Valid until: {new Date(validUntil).toDateString()}</p>
                        </div>
                    </div>
                    <div className="grid gap-3 border-y py-3 sm:grid-cols-2">
                        <div>
                            <p className="text-[11px] uppercase text-slate-400">Prepared for</p>
                            <p className="font-semibold">{snap.companyName || snap.contactName}</p>
                            <p className="text-xs">{snap.contactName}</p>
                            <p className="text-xs">{snap.email} {snap.phone && `· ${snap.phone}`}</p>
                            <p className="text-xs">{snap.address}</p>
                        </div>
                        <div>
                            <p className="text-[11px] uppercase text-slate-400">Prepared by</p>
                            <p className="font-semibold">WebBriks</p>
                            <p className="text-xs">info@webbriks.com · www.webbriks.com</p>
                        </div>
                    </div>
                    <div>
                        <p className="font-semibold">{title || "Untitled Project"}</p>
                        {overview && <p className="mt-1 whitespace-pre-line text-xs text-slate-600">{overview}</p>}
                    </div>
                    {features.some((f) => f.on) && (
                        <div>
                            <p className="mb-1 font-semibold">Scope — {svcLabel}{platform && ` (${platform})`}</p>
                            <ul className="grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
                                {features.filter((f) => f.on).map((f) => (
                                    <li key={f.text} className="flex gap-1.5"><IconCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />{f.text}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <div>
                        <p className="mb-1 font-semibold">Investment Summary</p>
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-slate-100 text-left"><th className="p-1.5">Item</th><th className="p-1.5">Qty</th><th className="p-1.5">Unit</th><th className="p-1.5 text-right">Total</th></tr>
                            </thead>
                            <tbody>
                                {builtServices.flatMap((sv) => sv.lineItems).map((l) => ({ title: l.title, qty: l.quantity ?? 1, price: l.price, billing: l.billingCycle === "monthly" || l.billingCycle === "yearly" ? ` / ${l.billingCycle}` : "" })).map((l, i) => (
                                    <tr key={i} className="border-b">
                                        <td className="p-1.5">{l.title}</td>
                                        <td className="p-1.5">{l.qty}</td>
                                        <td className="p-1.5">{money(l.price, cur)}{l.billing}</td>
                                        <td className="p-1.5 text-right">{money(l.price * l.qty, cur)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                {calc.totals.discountAmount > 0 && <tr><td colSpan={3} className="p-1.5 text-right">Discount</td><td className="p-1.5 text-right">− {money(calc.totals.discountAmount, cur)}</td></tr>}
                                {calc.totals.taxAmount > 0 && <tr><td colSpan={3} className="p-1.5 text-right">VAT / Tax ({taxPct}%)</td><td className="p-1.5 text-right">{money(calc.totals.taxAmount, cur)}</td></tr>}
                                <tr className="font-bold text-primary"><td colSpan={3} className="p-1.5 text-right">Total Investment</td><td className="p-1.5 text-right">{money(grand, cur)}</td></tr>
                            </tfoot>
                        </table>
                        {(recurringMonthly > 0 || recurringYearly > 0) && (
                            <p className="mt-1 text-xs text-slate-500">
                                Recurring: {recurringMonthly > 0 && `${money(recurringMonthly, cur)} / month`} {recurringYearly > 0 && `${money(recurringYearly, cur)} / year`} (billed separately)
                            </p>
                        )}
                    </div>
                    <div>
                        <p className="mb-1 font-semibold">Payment Schedule</p>
                        <ul className="text-xs">
                            {milestones.map((m, i) => (
                                <li key={i} className="flex justify-between border-b py-1"><span>{m.label} ({m.percentage}%){m.note && ` — ${m.note}`}</span><span>{money((grand * m.percentage) / 100, cur)}</span></li>
                            ))}
                        </ul>
                    </div>
                </div>
            </Panel>
        </div>
    );

    const bodies = [clientStep, servicesStep, scopeStep, pricingStep, termsStep, previewStep];

    return (
        <div className="space-y-5 pb-24">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Create New Quotation</h1>
                    <p className="text-sm text-muted-foreground">Select client, service and pricing, then customise the terms for this quotation.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" disabled={saving} onClick={save}>
                        <IconDeviceFloppy className="size-4" /> {saving ? "Saving…" : "Save Draft"}
                    </Button>
                </div>
            </div>

            <Stepper step={step} maxStep={maxStep} onGo={go} />

            <div className={cn("grid items-start gap-5", step !== 5 && (step === 1 ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "xl:grid-cols-[minmax(0,1fr)_300px]"))}>
                <div className="min-w-0">{bodies[step]}</div>

                {step === 1 && (
                    <aside className="space-y-4 xl:sticky xl:top-4">
                        <Panel icon={IconFileText} title="Package Summary" right={pkg ? <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{pkg.name}</span> : undefined}>
                            {service ? (
                                <div className="space-y-3 text-sm">
                                    <div className="rounded-lg border bg-muted/30 p-3">
                                        <p className="font-semibold">{svcLabel}</p>
                                        <p className="text-xs text-muted-foreground">{service?.description}</p>
                                    </div>
                                    <dl className="space-y-1.5">
                                        {platform && <Row k="Platform / Technology" v={platform} />}
                                        {pkg && <Row k="Selected Package" v={pkg.name} />}
                                        {pkg && <Row k="Base Package Price" v={money(pkgPrice, cur)} />}
                                    </dl>
                                    {features.length > 0 && (
                                        <div>
                                            <p className="mb-1 text-xs font-semibold">Included Features ({features.filter((f) => f.on).length})</p>
                                            <ul className="space-y-1 text-xs">
                                                {features.filter((f) => f.on).slice(0, 5).map((f) => (
                                                    <li key={f.text} className="flex items-start gap-1.5"><IconCircleCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />{f.text}</li>
                                                ))}
                                            </ul>
                                            {features.filter((f) => f.on).length > 5 && <p className="mt-1 text-xs text-primary">+ {features.filter((f) => f.on).length - 5} more features…</p>}
                                        </div>
                                    )}
                                    {chosenAddons.length > 0 && (
                                        <div>
                                            <p className="mb-1 text-xs font-semibold">Add-on Features ({chosenAddons.length})</p>
                                            <ul className="space-y-1 text-xs">
                                                {chosenAddons.map((a) => (
                                                    <li key={a._id} className="flex items-start justify-between gap-2"><span className="flex gap-1.5"><IconCircleCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />{a.name}</span><span>{money(a.price, cur)}</span></li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    <dl className="space-y-1.5 border-t pt-3">
                                        <Row k="Base Package Price" v={money(isUnit ? (Number(unit.rate) || 0) * unit.qty : pkgPrice, cur)} />
                                        <Row k={`Add-on Features (${chosenAddons.length})`} v={money(chosenAddons.reduce((a, x) => a + x.price, 0), cur)} />
                                        <Row k="Discount" v={money(calc.totals.discountAmount, cur)} />
                                    </dl>
                                    <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2.5">
                                        <span className="text-xs font-semibold">Total Amount ({cur})</span>
                                        <span className="text-lg font-bold text-primary">{money(grand, cur)}</span>
                                    </div>
                                    <div className="space-y-2">
                                        <Field label="Package Duration"><Input className="h-9" value={duration} onChange={(e) => setDuration(e.target.value)} /></Field>
                                        <Field label="Support Period"><Input className="h-9" value={supportPeriod} onChange={(e) => setSupportPeriod(e.target.value)} /></Field>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Select a service category to see the package summary.</p>
                            )}
                        </Panel>
                    </aside>
                )}
                {step !== 5 && step !== 1 && (
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
                        <Button type="button" onClick={() => go(step + 1)}>
                            Continue to {STEPS[step + 1].title} <IconArrowRight className="size-4" />
                        </Button>
                    ) : (
                        <Button type="button" disabled={saving || !ready} onClick={save}>
                            <IconDeviceFloppy className="size-4" /> {saving ? "Saving…" : "Save & Open Quotation"}
                        </Button>
                    )}
                </div>
            </div>
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

function SummaryRow({ label, value, sub, onEdit }: { label: string; value: string; sub?: string; onEdit: () => void }) {
    return (
        <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-semibold">{value}</dd>
                {sub && <dd className="truncate text-xs text-muted-foreground">{sub}</dd>}
            </div>
            <Button type="button" variant="outline" size="sm" className="h-7 shrink-0" onClick={onEdit}>Edit</Button>
        </div>
    );
}

/** Feature checklist with per-row edit / delete and an "Add Custom Feature" row. */
function FeatureEditor({ items, onChange }: { items: CheckItem[]; onChange: (n: CheckItem[]) => void }) {
    const [editing, setEditing] = useState<number | null>(null);
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState("");
    const commit = () => {
        const text = draft.trim();
        if (text) onChange([...items, { text, on: true }]);
        setDraft("");
        setAdding(false);
    };
    return (
        <div className="max-h-[32rem] space-y-1 overflow-y-auto pr-1">
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
                            onKeyDown={(e) => e.key === "Enter" && setEditing(null)}
                        />
                    ) : (
                        <span className={cn("flex-1 text-sm", !it.on && "text-muted-foreground line-through")}>{it.text}</span>
                    )}
                    <button type="button" aria-label="Edit feature" onClick={() => setEditing(i)} className="text-muted-foreground hover:text-primary"><IconPencil className="size-4" /></button>
                    <button type="button" aria-label="Remove feature" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-destructive/80 hover:text-destructive"><IconTrash className="size-4" /></button>
                </div>
                </div>
            ))}
            {adding ? (
                <div className="flex gap-2 pt-2">
                    <Input autoFocus className="h-9" value={draft} placeholder="Feature name…" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commit()} />
                    <Button type="button" size="sm" className="h-9" onClick={commit}>Add</Button>
                </div>
            ) : (
                <Button type="button" variant="outline" size="sm" className="mt-2 w-full bg-primary/5 text-primary" onClick={() => setAdding(true)}>
                    <IconPlus className="size-4" /> Add Custom Feature
                </Button>
            )}
        </div>
    );
}
