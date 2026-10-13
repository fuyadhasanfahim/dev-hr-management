import { createContext, useContext } from 'react';
import type { CanvasActions } from './types';

export const CanvasContext = createContext<CanvasActions | null>(null);

export function useCanvas(): CanvasActions {
    const ctx = useContext(CanvasContext);
    if (!ctx) throw new Error('useCanvas must be used inside <CatalogCanvas>');
    return ctx;
}
