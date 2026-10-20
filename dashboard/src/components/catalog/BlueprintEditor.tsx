'use client';

import { IconPlus, IconTrash } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Blueprint, BlueprintInclusion } from '@/lib/quotation-blueprint';

const NONE = '__none';
const num = (v: string) => (v === '' ? null : Number(v));
const val = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

function Num({ label, value, onChange, hint }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void; hint?: string }) {
    return (
        <div className="space-y-1">
            <Label className="text-[11px]">{label}</Label>
            <Input className="h-8" type="number" min={0} value={val(value)} placeholder="inherit" onChange={(e) => onChange(num(e.target.value))} />
            {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
        </div>
    );
}

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
    return (
        <section className="space-y-3 rounded-lg border p-3">
            <div>
                <p className="text-sm font-semibold">{title}</p>
                {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
            </div>
            {children}
        </section>
    );
}

/**
 * Edits a quotation blueprint. Blank fields are not stored, so a package inherits them
 * from its service (package → service), and the wizard leaves them empty if neither sets them.
 */
export function BlueprintEditor({ value, onChange, scope }: { value: Blueprint | null | undefined; onChange: (v: Blueprint | null) => void; scope: 'service' | 'package' }) {
    const b: Blueprint = value ?? {};
    const set = (patch: Partial<Blueprint>) => onChange({ ...b, ...patch });
    const inclusions = b.inclusions ?? [];
    const rev = b.revisions ?? { ui: null, dev: null, uiExtraFee: null, devExtraFee: null };
    const ms = b.paymentMilestones ?? [];
    const pol = b.policies ?? { graceDays: null, suspendDays: null, cancelNoticeDays: null, extraFeatureRate: null, hourlyRate: null, validityDays: null, ownership: '' as const };
    const setIncl = (i: number, patch: Partial<BlueprintInclusion>) => set({ inclusions: inclusions.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
    const msTotal = ms.reduce((a, m) => a + (Number(m.percentage) || 0), 0);

    return (
        <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
                {scope === 'package'
                    ? 'Anything set here overrides the service blueprint for this package. Leave a block empty to inherit.'
                    : 'Defaults for every package of this service. A package can override each block.'}
            </p>

            <Block title="Design" hint="Template-based packages skip the custom UI/UX (Figma) process.">
                <Select value={b.designMode || NONE} onValueChange={(v) => set({ designMode: v === NONE ? '' : (v as 'template' | 'custom') })}>
                    <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NONE}>Not specified</SelectItem>
                        <SelectItem value="template">Template-based design</SelectItem>
                        <SelectItem value="custom">Custom UI/UX design</SelectItem>
                    </SelectContent>
                </Select>
            </Block>

            <Block title="Inclusions (domain, hosting, …)" hint="Included items add no charge. Items with “Renewal timer” start counting from the day the quotation becomes an order.">
                {inclusions.map((it, i) => (
                    <div key={it.key} className="space-y-2 rounded-md border p-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <Input className="h-8 min-w-40 flex-1" placeholder="e.g. Domain" value={it.label} onChange={(e) => setIncl(i, { label: e.target.value })} />
                            <Select value={it.kind} onValueChange={(v) => setIncl(i, { kind: v as BlueprintInclusion['kind'] })}>
                                <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="domain">Domain</SelectItem>
                                    <SelectItem value="hosting">Hosting</SelectItem>
                                    <SelectItem value="support">Support</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                            <button type="button" aria-label="Remove inclusion" className="text-destructive/80 hover:text-destructive" onClick={() => set({ inclusions: inclusions.filter((_, j) => j !== i) })}>
                                <IconTrash className="size-4" />
                            </button>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="w-24"><Num label="Term (months)" value={it.termMonths} onChange={(v) => setIncl(i, { termMonths: v })} /></div>
                            <div className="w-28"><Num label="Charge if off" value={it.charge} onChange={(v) => setIncl(i, { charge: v ?? 0 })} /></div>
                            <Select value={it.owner || NONE} onValueChange={(v) => setIncl(i, { owner: v === NONE ? '' : (v as 'client' | 'agency') })}>
                                <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE}>Owner: —</SelectItem>
                                    <SelectItem value="client">Owner: client</SelectItem>
                                    <SelectItem value="agency">Owner: agency</SelectItem>
                                </SelectContent>
                            </Select>
                            <label className="flex h-8 items-center gap-1.5 text-xs"><Checkbox checked={it.included} onCheckedChange={(v) => setIncl(i, { included: !!v })} /> Included</label>
                            <label className="flex h-8 items-center gap-1.5 text-xs"><Checkbox checked={it.renews} onCheckedChange={(v) => setIncl(i, { renews: !!v })} /> Renewal timer</label>
                        </div>
                    </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => set({ inclusions: [...inclusions, { key: crypto.randomUUID(), label: '', kind: 'other', included: true, termMonths: null, owner: '', renews: false, charge: 0, note: '' }] })}>
                    <IconPlus className="size-3.5" /> Add inclusion
                </Button>
            </Block>

            <Block title="Revisions" hint="Included rounds, and the fee for each extra round (0 = free).">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Num label="UI/UX rounds" value={rev.ui} onChange={(v) => set({ revisions: { ...rev, ui: v } })} />
                    <Num label="Dev rounds" value={rev.dev} onChange={(v) => set({ revisions: { ...rev, dev: v } })} />
                    <Num label="UI/UX extra fee" value={rev.uiExtraFee} onChange={(v) => set({ revisions: { ...rev, uiExtraFee: v } })} />
                    <Num label="Dev extra fee" value={rev.devExtraFee} onChange={(v) => set({ revisions: { ...rev, devExtraFee: v } })} />
                </div>
            </Block>

            <Block title="Payment milestones" hint="Shown on the Pricing step. Percentages should total 100.">
                {ms.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <Input className="h-8 flex-1" placeholder="Milestone" value={m.label} onChange={(e) => set({ paymentMilestones: ms.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                        <Input className="h-8 w-20" type="number" min={0} max={100} value={m.percentage} onChange={(e) => set({ paymentMilestones: ms.map((x, j) => (j === i ? { ...x, percentage: Number(e.target.value) || 0 } : x)) })} aria-label="Percentage" />
                        <Input className="h-8 flex-1" placeholder="When is it due?" value={m.note} onChange={(e) => set({ paymentMilestones: ms.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })} />
                        <button type="button" aria-label="Remove milestone" className="text-destructive/80 hover:text-destructive" onClick={() => set({ paymentMilestones: ms.filter((_, j) => j !== i) })}><IconTrash className="size-4" /></button>
                    </div>
                ))}
                <div className="flex items-center justify-between">
                    <Button type="button" variant="outline" size="sm" onClick={() => set({ paymentMilestones: [...ms, { label: '', percentage: 0, note: '' }] })}>
                        <IconPlus className="size-3.5" /> Add milestone
                    </Button>
                    {ms.length > 0 && <span className={msTotal === 100 ? 'text-xs text-emerald-600 dark:text-emerald-400' : 'text-xs text-destructive'}>Total {msTotal}%</span>}
                </div>
            </Block>

            <Block title="Policies" hint="Blank = not stated; the wizard leaves it empty.">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Num label="Quotation valid (days)" value={pol.validityDays} onChange={(v) => set({ policies: { ...pol, validityDays: v } })} />
                    <Num label="Grace period (days)" value={pol.graceDays} onChange={(v) => set({ policies: { ...pol, graceDays: v } })} />
                    <Num label="Suspend after (days)" value={pol.suspendDays} onChange={(v) => set({ policies: { ...pol, suspendDays: v } })} />
                    <Num label="Cancellation notice (days)" value={pol.cancelNoticeDays} onChange={(v) => set({ policies: { ...pol, cancelNoticeDays: v } })} />
                    <Num label="Extra feature rate" value={pol.extraFeatureRate} onChange={(v) => set({ policies: { ...pol, extraFeatureRate: v } })} />
                    <Num label="Hourly rate" value={pol.hourlyRate} onChange={(v) => set({ policies: { ...pol, hourlyRate: v } })} />
                    <div className="space-y-1">
                        <Label className="text-[11px]">Ownership</Label>
                        <Select value={pol.ownership || NONE} onValueChange={(v) => set({ policies: { ...pol, ownership: v === NONE ? '' : (v as 'client' | 'portfolio' | 'custom') } })}>
                            <SelectTrigger className="h-8 w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE}>Not specified</SelectItem>
                                <SelectItem value="client">Client owns after final payment</SelectItem>
                                <SelectItem value="portfolio">Agency may showcase</SelectItem>
                                <SelectItem value="custom">Custom terms</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </Block>
        </div>
    );
}
