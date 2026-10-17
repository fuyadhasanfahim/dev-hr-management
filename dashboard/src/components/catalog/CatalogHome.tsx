'use client';

import { useState } from 'react';
import { IconLayoutBoard, IconLayoutList, IconTable } from '@tabler/icons-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CatalogCanvas from './canvas/CatalogCanvas';
import CatalogManager from './CatalogManager';
import CatalogExplorer from './explorer/CatalogExplorer';

/** Quotation Catalogs: the canvas is the main editor and fills the page; the table is the searchable/paged list view. */
export default function CatalogHome() {
    const [view, setView] = useState<'explorer' | 'canvas' | 'list'>('explorer');
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                    <h1 className="text-xl font-bold leading-tight tracking-tight">Quotation Catalogs</h1>
                    <p className="truncate text-xs text-muted-foreground">
                        Service → platform → package → features, add-ons and scope content (deliverables, milestones, responsibilities…) that fill a new quotation in one click.
                    </p>
                </div>
                <Tabs value={view} onValueChange={(v) => setView(v as 'explorer' | 'canvas' | 'list')}>
                    <TabsList>
                        <TabsTrigger value="explorer"><IconLayoutList className="mr-1.5 size-4" /> Explorer</TabsTrigger>
                        <TabsTrigger value="canvas"><IconLayoutBoard className="mr-1.5 size-4" /> Canvas</TabsTrigger>
                        <TabsTrigger value="list"><IconTable className="mr-1.5 size-4" /> List</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
            {view === 'explorer' ? <CatalogExplorer /> : view === 'canvas' ? <CatalogCanvas /> : <CatalogManager />}
        </div>
    );
}
