import { createElement } from 'react';
import {
    IconCamera,
    IconChartBar,
    IconDeviceDesktop,
    IconDeviceMobile,
    IconLayoutGrid,
    IconPhotoEdit,
    IconPlayerPlay,
    IconShoppingCart,
} from '@tabler/icons-react';

/** Icon keys a catalog service can use (stored as a string in the DB). */
export const CATALOG_ICONS = {
    website: IconDeviceDesktop,
    ecommerce: IconShoppingCart,
    marketing: IconChartBar,
    photography: IconCamera,
    reels: IconPlayerPlay,
    editing: IconPhotoEdit,
    mobile: IconDeviceMobile,
    webapp: IconLayoutGrid,
} as const;

export type CatalogIconKey = keyof typeof CATALOG_ICONS;
export const catalogIcon = (key?: string) => CATALOG_ICONS[(key as CatalogIconKey) ?? 'website'] ?? IconDeviceDesktop;

/** Renders a catalog service icon by its stored key. */
export function CatalogIcon({ name, className }: { name?: string; className?: string }) {
    const Icon = catalogIcon(name);
    return createElement(Icon, { className });
}
