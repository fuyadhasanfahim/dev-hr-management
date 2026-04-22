import type { Request, Response } from 'express';
import ServiceServices from '../services/service.service.js';

async function createService(req: Request, res: Response) {
    try {
        const result = await ServiceServices.createServiceInDB(req.body);
        return res.status(201).json({ success: true, data: result });
    } catch (err) {
        return res.status(400).json({ success: false, message: (err as Error).message });
    }
}

async function getAllServices(req: Request, res: Response) {
    try {
        const result = await ServiceServices.getAllServicesFromDB(req.query);
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return res.status(500).json({ success: false, message: (err as Error).message });
    }
}

async function getServiceById(req: Request, res: Response) {
    try {
        const result = await ServiceServices.getServiceByIdFromDB(req.params.id as string);
        if (!result) return res.status(404).json({ success: false, message: 'Service not found' });
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return res.status(500).json({ success: false, message: (err as Error).message });
    }
}

async function updateService(req: Request, res: Response) {
    try {
        const result = await ServiceServices.updateServiceInDB(req.params.id as string, req.body);
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return res.status(400).json({ success: false, message: (err as Error).message });
    }
}

export default {
    createService,
    getAllServices,
    getServiceById,
    updateService,
};
