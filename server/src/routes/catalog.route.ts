import { Router } from 'express';
import { requireAnyPermission, requirePermission } from '../middlewares/require-permission.js';
import { getGraph, getTree, putLayout } from '../controllers/catalog.controller.js';
import { catalogServiceRoute } from './catalog-service.route.js';
import { catalogPlatformRoute } from './catalog-platform.route.js';
import { catalogPackageRoute } from './catalog-package.route.js';
import { catalogFeatureRoute } from './catalog-feature.route.js';
import { catalogSectionRoute } from './catalog-section.route.js';

const router: Router = Router();

router.get('/tree', requireAnyPermission('catalog.read', 'quotation.read'), getTree);
router.get('/graph', requireAnyPermission('catalog.read', 'quotation.read'), getGraph);
router.put('/layout', requirePermission('catalog.manage'), putLayout);
router.use('/services', catalogServiceRoute);
router.use('/platforms', catalogPlatformRoute);
router.use('/packages', catalogPackageRoute);
router.use('/features', catalogFeatureRoute);
router.use('/sections', catalogSectionRoute);

export const catalogRoute = router;
