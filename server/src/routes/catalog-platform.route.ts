import { Router } from 'express';
import { requireAnyPermission, requirePermission } from '../middlewares/require-permission.js';
import { catalogController } from '../controllers/catalog.controller.js';

const c = catalogController('platforms');
const router: Router = Router();

// Anyone who can read the catalog — or build quotations with it — may list/read.
const canRead = requireAnyPermission('catalog.read', 'quotation.read');
const canManage = requirePermission('catalog.manage');

router.get('/', canRead, c.list);
router.get('/:id', canRead, c.get);
router.post('/', canManage, c.create);
router.patch('/:id', canManage, c.update);
router.patch('/:id/toggle-status', canManage, c.toggle);
router.delete('/:id', canManage, c.remove);

export const catalogPlatformRoute = router;
