import {
    IconAlertTriangle,
    IconBox,
    IconCalendarTime,
    IconChecklist,
    IconFileDescription,
    IconFileText,
    IconHeading,
    IconPackage,
    IconTargetArrow,
    IconTools,
    IconUserCheck,
    IconX,
} from '@tabler/icons-react';
import type { CatalogSectionKind } from '@/types/catalog.type';

export interface SectionMeta {
    label: string;
    icon: typeof IconBox;
    type: 'text' | 'list';
    placeholder: string;
    /** Milestones carry "3 weeks"-style durations. */
    withDuration?: boolean;
    hint?: string;
}

export const SECTION_META: Record<CatalogSectionKind, SectionMeta> = {
    projectTitle: { label: 'Project title', icon: IconHeading, type: 'text', placeholder: 'e.g. E-Commerce Website Development', hint: 'Default title for the quotation.' },
    projectOverview: { label: 'Project overview', icon: IconFileDescription, type: 'text', placeholder: 'A brief overview of the project and its objectives…' },
    scopeOfWork: { label: 'Scope of work', icon: IconTargetArrow, type: 'text', placeholder: 'The overall scope of work for this project…' },
    deliverables: { label: 'Deliverables', icon: IconPackage, type: 'list', placeholder: 'Add deliverable' },
    optionalDeliverables: { label: 'Optional deliverables', icon: IconBox, type: 'list', placeholder: 'Add optional deliverable' },
    milestones: { label: 'Milestones & timeline', icon: IconCalendarTime, type: 'list', placeholder: 'Add milestone', withDuration: true },
    clientResponsibilities: { label: 'Client responsibilities', icon: IconUserCheck, type: 'list', placeholder: 'Add responsibility' },
    requiredAssets: { label: 'Required assets from client', icon: IconChecklist, type: 'list', placeholder: 'Add required asset' },
    exclusions: { label: 'Exclusions', icon: IconX, type: 'list', placeholder: 'Add exclusion' },
    changeRequestNote: { label: 'Change request note', icon: IconAlertTriangle, type: 'text', placeholder: 'How changes after project start are handled…' },
    supportNote: { label: 'Support & maintenance note', icon: IconTools, type: 'text', placeholder: 'What post-launch support and maintenance covers…' },
};

export const SECTION_ORDER = Object.keys(SECTION_META) as CatalogSectionKind[];
export const FALLBACK_ICON = IconFileText;

export const unitLabel = (d?: { value: number; unit: string } | null) =>
    d ? `${d.value} ${d.unit}${d.value === 1 ? '' : 's'}` : '';
