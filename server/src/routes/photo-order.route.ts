import { Router } from 'express';
import { requirePermission } from '../middlewares/require-permission.js';
import { upload } from '../middlewares/upload.middleware.js';
import C from '../controllers/photo-order.controller.js';

const router: Router = Router();
const read = requirePermission('photoOrder.read');
const create = requirePermission('photoOrder.create');
const update = requirePermission('photoOrder.update');
const remove = requirePermission('photoOrder.delete');
const status = requirePermission('photoOrder.changeStatus');
const meta = requirePermission('photoOrder.manageMetadata');
const invoice = requirePermission('photoOrder.invoice');

// Static paths are declared before '/:id' so they are never read as an order id.
router.get('/stats', read, C.orderStats);
router.get('/years', read, C.orderYears);

// metadata: services + return file formats (anyone who can read orders may list them for the order form)
router.get('/meta/services', read, C.listServices);
router.post('/meta/services', meta, C.createService);
router.patch('/meta/services/:id', meta, C.updateService);
router.delete('/meta/services/:id', meta, C.deleteService);
router.get('/meta/formats', read, C.listFormats);
router.post('/meta/formats', meta, C.createFormat);
router.patch('/meta/formats/:id', meta, C.updateFormat);
router.delete('/meta/formats/:id', meta, C.deleteFormat);

// invoices
router.get('/invoices/clients', invoice, C.invoiceClients);
router.get('/invoices/orders', invoice, C.invoiceOrders);
router.get('/invoices', invoice, C.listInvoices);
router.post('/invoices', invoice, C.createInvoice);
router.get('/invoices/:id', invoice, C.getInvoice);
router.delete('/invoices/:id', invoice, C.deleteInvoice);
router.post('/invoices/:id/email', invoice, upload.single('pdf'), C.emailInvoice);

// orders
router.get('/', read, C.listOrders);
router.post('/', create, C.createOrder);
router.get('/:id', read, C.getOrder);
router.patch('/:id', update, C.updateOrder);
router.patch('/:id/status', status, C.changeStatus);
router.patch('/:id/extend-deadline', update, C.extendDeadline);
router.post('/:id/revision', update, C.addRevision);
router.delete('/:id', remove, C.deleteOrder);

export const photoOrderRoute = router;
