'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { CatalogFeature, CatalogGraph } from '@/types/catalog.type';
import { IdChecklist } from '../EntityFormDialog';
import { BrandLogo } from '../BrandLogo';
import { SECTION_META, SECTION_ORDER, unitLabel } from './section-meta';
import type { ViewTarget } from './types';

const money = (n: number) => `৳${Math.round(n).toLocaleString('en-US')}`;

/** "Link existing" — pick features already defined for the service and attach them to a package. */
export function FeaturePicker({ title, options, onConfirm, onClose }: { title: string; options: CatalogFeature[]; onConfirm: (ids: string[]) => void; onClose: () => void }) {
    const [ids, setIds] = useState<string[]>([]);
    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>Only features of this service (and platform) that are not already in the package.</DialogDescription>
                </DialogHeader>
                <IdChecklist options={options.map((f) => ({ value: f._id, label: f.kind === 'addon' ? `${f.name} — ${money(f.price)}` : f.name, group: f.group || 'General' }))} value={ids} onChange={setIds} />
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button disabled={ids.length === 0} onClick={() => { onConfirm(ids); onClose(); }}>Link {ids.length || ''} feature{ids.length === 1 ? '' : 's'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const Row = ({ k, v }: { k: string; v?: React.ReactNode }) =>
    v === undefined || v === null || v === '' ? null : (
        <div className="flex justify-between gap-4 border-b py-1.5 text-sm last:border-0"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
    );

const Bullets = ({ title, items }: { title: string; items?: string[] }) =>
    items && items.length > 0 ? (
        <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
            <ul className="list-disc space-y-0.5 pl-4 text-sm">{items.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
    ) : null;

/** Read-only "View" drawer — price, billing, platforms and what the item contains. */
export function ViewSheet({ target, graph, onClose }: { target: ViewTarget | null; graph: CatalogGraph; onClose: () => void }) {
    const svc = target?.type === 'service' ? graph.services.find((s) => s._id === target.id) : undefined;
    const plat = target?.type === 'platform' ? graph.platforms.find((p) => p._id === target.id) : undefined;
    const pkg = target?.type === 'package' ? graph.packages.find((p) => p._id === target.id) : undefined;
    const pkgService = pkg ? graph.services.find((s) => s._id === pkg.serviceId) : undefined;

    const title = svc?.name ?? plat?.name ?? pkg?.name ?? '';
    const sectionsOf = (serviceId: string, packageId: string | null) => graph.sections.filter((s) => s.serviceId === serviceId && (s.packageId ?? null) === packageId);

    return (
        <Sheet open={!!target} onOpenChange={(o) => !o && onClose()}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">{plat?.logo && <BrandLogo name={plat.logo} color={plat.color} className="size-5" />}{title}</SheetTitle>
                    <SheetDescription>{svc?.description ?? plat?.description ?? pkg?.description}</SheetDescription>
                </SheetHeader>

                <div className="space-y-5 px-4 pb-6">
                    {svc && (
                        <>
                            <dl>
                                <Row k="Quotation category" v={svc.quotationCategory} />
                                <Row k="Pricing" v={svc.pricingMode === 'unit' ? 'Per unit (rate × quantity)' : 'Packages'} />
                                <Row k="Platforms" v={svc.platformIds.map((id) => graph.platforms.find((p) => p._id === id)?.name).filter(Boolean).join(', ') || 'None'} />
                                <Row k="Packages" v={graph.packages.filter((p) => p.serviceId === svc._id).length} />
                                <Row k="Status" v={svc.isActive ? 'Active' : 'Inactive'} />
                            </dl>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Default content</p>
                                {SECTION_ORDER.map((k) => {
                                    const sec = sectionsOf(svc._id, null).find((s) => s.kind === k);
                                    return <p key={k} className="flex justify-between text-sm"><span>{SECTION_META[k].label}</span><span className="text-muted-foreground">{sec ? (SECTION_META[k].type === 'list' ? `${sec.items.length} items` : sec.text ? 'set' : 'empty') : '—'}</span></p>;
                                })}
                            </div>
                        </>
                    )}

                    {plat && (
                        <dl>
                            <Row k="Used by services" v={graph.services.filter((s) => s.platformIds.includes(plat._id)).map((s) => s.name).join(', ') || 'None'} />
                            <Row k="Packages" v={graph.packages.filter((p) => p.platformId === plat._id).length} />
                            <Row k="Status" v={plat.isActive ? 'Active' : 'Inactive'} />
                        </dl>
                    )}

                    {pkg && (
                        <>
                            <dl>
                                <Row k="Service" v={pkgService?.name} />
                                <Row k="Platform" v={pkg.platformId ? graph.platforms.find((p) => p._id === pkg.platformId)?.name : undefined} />
                                <Row k="Price" v={pkg.price == null ? 'Custom quote' : `${money(pkg.price)}${pkg.priceMax ? ` – ${money(pkg.priceMax)}` : ''}`} />
                                <Row k="Billing" v={pkg.billingCycle + (pkg.unitLabel ? ` · per ${pkg.unitLabel}` : '')} />
                                <Row k="Duration" v={pkg.duration} />
                                <Row k="Support" v={pkg.supportPeriod} />
                                <Row k="Best for" v={pkg.bestFor} />
                                <Row k="Features" v={`${pkg.featureIds.length} included · ${pkg.addonIds.length} add-ons`} />
                                <Row k="Status" v={pkg.isActive ? 'Active' : 'Inactive'} />
                            </dl>
                            <Bullets title="Highlights" items={pkg.bullets} />
                            <Bullets title="Notes" items={pkg.notes} />
                            <Bullets title="Free support includes" items={pkg.supportInclusions} />
                            <Bullets title="Additional charges apply to" items={pkg.additionalCharges} />
                            <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Content used for this package</p>
                                {SECTION_ORDER.map((k) => {
                                    const own = sectionsOf(pkg.serviceId, pkg._id).find((s) => s.kind === k);
                                    const def = sectionsOf(pkg.serviceId, null).find((s) => s.kind === k);
                                    const sec = own ?? def;
                                    if (!sec) return null;
                                    return (
                                        <div key={k} className="text-sm">
                                            <p className="flex justify-between"><span>{SECTION_META[k].label}</span><span className="text-xs text-muted-foreground">{own ? 'package override' : 'service default'}</span></p>
                                            {SECTION_META[k].type === 'list' ? (
                                                <ul className="ml-4 list-disc text-xs text-muted-foreground">{sec.items.map((i) => <li key={i.key}>{i.title}{i.duration ? ` — ${unitLabel(i.duration)}` : ''}</li>)}</ul>
                                            ) : (
                                                <p className="ml-1 whitespace-pre-line text-xs text-muted-foreground">{sec.text}</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
