'use client';

import CatalogExplorer from './explorer/CatalogExplorer';

/** Quotation Catalogs: service → platform → package → features, add-ons and content, all edited in the explorer. */
export default function CatalogHome() {
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="min-w-0">
                <h1 className="text-xl font-bold leading-tight tracking-tight">Quotation Catalogs</h1>
                <p className="text-xs text-muted-foreground">
                    Service → platform → package → features, add-ons and scope content (deliverables, milestones, responsibilities…) that fill a new quotation in one click.
                </p>
            </div>
            <CatalogExplorer />
        </div>
    );
}
