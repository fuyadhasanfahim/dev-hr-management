import { Router } from 'express';
import { requirePermission } from '../middlewares/require-permission.js';
import ClientController from '../controllers/client.controller.js';

const router: Router = Router();

// Get all clients
router.get('/', requirePermission('client.read'), ClientController.getAllClients);

// Get next auto-incremented WB-10001 client ID (must be before :id route)
router.get(
    '/next-id',
    requirePermission('client.read'),
    ClientController.getNextClientId,
);

// Migrate existing client IDs to WB-10001 format
router.post(
    '/migrate-ids',
    requirePermission('client.update'),
    ClientController.migrateClientIds,
);

// Get client stats (must be before :id route)
router.get(
    '/:id/stats',
    requirePermission('client.read'),
    ClientController.getClientStats,
);

// Get client by ID
router.get('/:id', requirePermission('client.read'), ClientController.getClientById);

// Create client
router.post('/', requirePermission('client.create'), ClientController.createClient);

// Update client
router.patch('/:id', requirePermission('client.update'), ClientController.updateClient);

// Get assigned services for a client
router.get(
    '/:id/assigned-services',
    requirePermission('client.read'),
    ClientController.getAssignedServices,
);

// Get all emails (client + team) for a client
router.get('/:id/emails', requirePermission('client.read'), ClientController.getClientEmails);

export const clientRoute = router;
