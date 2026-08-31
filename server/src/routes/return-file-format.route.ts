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

// Creating a format is an inline step of the order-creation form, so it
// rides on `order.create`; editing/removing an existing one is an admin
// config action.
router.post('/', requirePermission('order.create'), createReturnFileFormat);
router.get('/', getAllReturnFileFormats);
router.get('/:id', getReturnFileFormatById);
router.patch('/:id', requirePermission('returnFileFormat.manage'), updateReturnFileFormat);
router.delete('/:id', requirePermission('returnFileFormat.manage'), deleteReturnFileFormat);

export { router as returnFileFormatRoute };
