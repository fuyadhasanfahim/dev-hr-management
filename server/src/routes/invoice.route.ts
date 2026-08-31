import express from "express";
import {
    getNextInvoiceNumber,
    getCurrentInvoiceNumber,
    sendInvoiceEmailHandler,
    recordInvoice,
    getInvoiceByNumber,
    getInvoices,
} from "../controllers/invoice.controller.js";
import { upload } from "../middlewares/upload.middleware.js";
import { requirePermission } from "../middlewares/require-permission.js";

const router = express.Router();

router.get("/next-number", requirePermission('invoice.read'), getNextInvoiceNumber);
router.get("/current-number", requirePermission('invoice.read'), getCurrentInvoiceNumber);
router.post("/send-email", requirePermission('invoice.create'), upload.single("file"), sendInvoiceEmailHandler);
router.post("/record", requirePermission('invoice.create'), recordInvoice);
router.get("/", requirePermission('invoice.read'), getInvoices);
router.get("/public/:invoiceNumber", getInvoiceByNumber);

export default router;
