import { Router } from 'express';
import { requireAnyPermission } from '../middlewares/require-permission.js';
import { getTree } from '../controllers/catalog.controller.js';
import { catalogServiceRoute } from './catalog-service.route.js';
import { catalogPlatformRoute } from './catalog-platform.route.js';
import { catalogPackageRoute } from './catalog-package.route.js';
import { catalogFeatureRoute } from './catalog-feature.route.js';

const router: Router = Router();

router.get('/tree', requireAnyPermission('catalog.read', 'quotation.read'), getTree);
router.use('/services', catalogServiceRoute);
router.use('/platforms', catalogPlatformRoute);
router.use('/packages', catalogPackageRoute);
router.use('/features', catalogFeatureRoute);

export const catalogRoute = router;
