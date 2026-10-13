import type { Request, Response } from 'express';
import {
    CatalogCrud,
    duplicatePackage,
    duplicateSection,
    getCatalogGraph,
    getCatalogTree,
    saveCatalogLayout,
    type CatalogEntity,
} from '../services/catalog.service.js';

const idOf = (req: Request) => String(req.params.id);

/** Thin generic controller; each catalog module wires it to its own route file + permission. */
export const catalogController = (entity: CatalogEntity) => ({
    list: async (req: Request, res: Response) => {
        const { items, pagination } = await CatalogCrud.list(entity, req.query);
        res.json({ success: true, data: items, pagination });
    },
    get: async (req: Request, res: Response) =>
        res.json({ success: true, data: await CatalogCrud.get(entity, idOf(req)) }),
    create: async (req: Request, res: Response) =>
        res.status(201).json({ success: true, data: await CatalogCrud.create(entity, req.body, req.user?.id) }),
    update: async (req: Request, res: Response) =>
        res.json({ success: true, data: await CatalogCrud.update(entity, idOf(req), req.body) }),
    toggle: async (req: Request, res: Response) =>
        res.json({ success: true, data: await CatalogCrud.toggle(entity, idOf(req)) }),
    remove: async (req: Request, res: Response) => {
        await CatalogCrud.remove(entity, idOf(req));
        res.json({ success: true });
    },
});

export const getTree = async (_req: Request, res: Response) =>
    res.json({ success: true, data: await getCatalogTree() });

export const getGraph = async (_req: Request, res: Response) =>
    res.json({ success: true, data: await getCatalogGraph() });

export const putLayout = async (req: Request, res: Response) =>
    res.json({ success: true, data: await saveCatalogLayout(req.body?.positions) });

export const copyPackage = async (req: Request, res: Response) =>
    res.status(201).json({ success: true, data: await duplicatePackage(idOf(req), req.body ?? {}) });

export const copySection = async (req: Request, res: Response) =>
    res.status(201).json({ success: true, data: await duplicateSection(idOf(req), req.body ?? {}) });
