import type { Form } from '../EntityFormDialog';
import type {
    CatalogFeature,
    CatalogPackage,
    CatalogPlatform,
    CatalogSection,
    CatalogSectionItem,
    CatalogSectionKind,
    CatalogService,
    FormEntity,
} from '@/types/catalog.type';

export type NodeKind = 'service' | 'platform' | 'package' | 'features' | 'section';

export interface ServiceNodeData extends Record<string, unknown> { kind: 'service'; service: CatalogService; platformCount: number; packageCount: number; expanded: boolean; sectionKinds: CatalogSectionKind[] }
export interface PlatformNodeData extends Record<string, unknown> { kind: 'platform'; platform: CatalogPlatform; service: CatalogService; packageCount: number }
export interface PackageNodeData extends Record<string, unknown> { kind: 'package'; pkg: CatalogPackage; service: CatalogService; platform?: CatalogPlatform; expanded: boolean; featureCount: number; addonCount: number; sectionKinds: CatalogSectionKind[] }
export interface FeaturesNodeData extends Record<string, unknown> { kind: 'features'; listKind: 'included' | 'addon'; pkg: CatalogPackage; service: CatalogService; items: CatalogFeature[] }
export interface SectionNodeData extends Record<string, unknown> {
    kind: 'section';
    section: CatalogSection;
    service: CatalogService;
    pkg?: CatalogPackage;
    /** True when a package-level section overrides a service-level one of the same kind. */
    overrides: boolean;
}
export type CanvasNodeData = ServiceNodeData | PlatformNodeData | PackageNodeData | FeaturesNodeData | SectionNodeData;

export interface ViewTarget { type: 'service' | 'platform' | 'package'; id: string; serviceId?: string }

export type Clip =
    | { type: 'package'; id: string; name: string }
    | { type: 'section'; id: string; name: string }
    | { type: 'item'; item: CatalogSectionItem; name: string };

export interface MenuItem {
    label?: string;
    onClick?: () => void;
    danger?: boolean;
    disabled?: boolean;
    separator?: boolean;
}

/** Everything a node can do — provided once by the canvas so nodes stay presentational. */
export interface CanvasActions {
    canManage: boolean;
    toggleExpand: (id: string) => void;
    view: (t: ViewTarget) => void;
    /** Opens the form dialog (edit when `id` is set, create with presets otherwise). */
    openForm: (entity: FormEntity, id: string | null, initial?: Form, onSaved?: (doc: { _id: string } & Form) => void) => void;
    remove: (entity: FormEntity | 'sections', id: string, name: string) => Promise<void>;
    toggleActive: (entity: FormEntity | 'sections', id: string) => void;
    unlinkPlatform: (serviceId: string, platformId: string) => Promise<void>;
    linkPlatform: (serviceId: string, platformId: string) => Promise<void>;
    pickFeatures: (pkg: CatalogPackage, listKind: 'included' | 'addon') => void;
    duplicatePackage: (id: string, target?: { serviceId?: string; platformId?: string | null }) => Promise<void>;
    addSection: (serviceId: string, packageId: string | null, kind: CatalogSectionKind) => Promise<void>;
    saveItems: (section: CatalogSection, items: CatalogSectionItem[], label: string) => Promise<void>;
    saveText: (section: CatalogSection, text: string) => Promise<void>;
    moveItem: (fromSectionId: string, key: string, to: CatalogSection, index: number) => Promise<void>;
    linkFeatures: (pkg: CatalogPackage, listKind: 'included' | 'addon', ids: string[]) => Promise<void>;
    setFeatureOrder: (pkg: CatalogPackage, listKind: 'included' | 'addon', ids: string[]) => Promise<void>;
    moveFeature: (from: { pkgId: string; listKind: 'included' | 'addon' }, featureId: string, to: CatalogPackage, listKind: 'included' | 'addon', index: number) => Promise<void>;
    copy: (clip: Clip) => void;
    clip: Clip | null;
    pastePackage: (serviceId: string, platformId: string | null) => Promise<void>;
    pasteSection: (serviceId: string, packageId: string | null) => Promise<void>;
    pasteItem: (section: CatalogSection) => Promise<void>;
    menu: (e: React.MouseEvent, items: MenuItem[]) => void;
}
