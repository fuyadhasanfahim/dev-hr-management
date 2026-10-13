'use client';

import { useState } from 'react';
import { IconLayoutBoard, IconTable } from '@tabler/icons-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CatalogCanvas from './canvas/CatalogCanvas';
import CatalogManager from './CatalogManager';

/** Quotation Catalogs: the canvas is the main editor, the table is the searchable/paged list view. */
export default function CatalogHome() {
    const [view, setView] = useState<'canvas' | 'list'>('canvas');
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Quotation Catalogs</h1>
                    <p className="text-sm text-muted-foreground">
                        Map every service → platform → package → features, add-ons and the scope content (deliverables, milestones, responsibilities…) that fills a new quotation in one click.
                    </p>
                </div>
                <Tabs value={view} onValueChange={(v) => setView(v as 'canvas' | 'list')}>
                    <TabsList>
                        <TabsTrigger value="canvas"><IconLayoutBoard className="mr-1.5 size-4" /> Canvas</TabsTrigger>
                        <TabsTrigger value="list"><IconTable className="mr-1.5 size-4" /> List</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
            {view === 'canvas' ? <CatalogCanvas /> : <CatalogManager />}
        </div>
    );
}
