import { Router } from 'express';
import { requirePermission } from '../middlewares/require-permission.js';
import {
    createReturnFileFormat,
    getAllReturnFileFormats,
    getReturnFileFormatById,
    updateReturnFileFormat,
    deleteReturnFileFormat,
} from '../controllers/return-file-format.controller.js';

const router = Router();

// Return-file formats are part of the service configuration — gate writes
// with the same permissions as services.
router.post('/', requirePermission('service.create'), createReturnFileFormat);
router.get('/', getAllReturnFileFormats);
router.get('/:id', getReturnFileFormatById);
router.patch('/:id', requirePermission('service.update'), updateReturnFileFormat);
router.delete('/:id', requirePermission('service.delete'), deleteReturnFileFormat);

export { router as returnFileFormatRoute };
