import { Request, Response } from 'express';
import ServiceServices from '../services/service.service.js';

async function createService(req: Request, res: Response) {
    try {
        const result = await ServiceServices.createServiceInDB(req.body);
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, message: (err as Error).message });
    }
}

async function getAllServices(req: Request, res: Response) {
    try {
        const result = await ServiceServices.getAllServicesFromDB(req.query);
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: (err as Error).message });
    }
}

async function getServiceById(req: Request, res: Response) {
    try {
        const result = await ServiceServices.getServiceByIdFromDB(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: 'Service not found' });
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: (err as Error).message });
    }
}

async function updateService(req: Request, res: Response) {
    try {
        const result = await ServiceServices.updateServiceInDB(req.params.id, req.body);
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, message: (err as Error).message });
    }
}

export default {
    createService,
    getAllServices,
    getServiceById,
    updateService,
};
