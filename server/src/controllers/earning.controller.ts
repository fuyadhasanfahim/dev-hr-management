import type { Request, Response } from "express";
import earningService from "../services/earning.service.js";
import { isTelemarketer } from "../utils/telemarketer.util.js";
import { Role } from "../constants/role.js";
import ClientModel from "../models/client.model.js";
import type { EarningQueryParams } from "../types/earning.type.js";

/**
 * Earnings are fully derived from Receipt payments (see
 * ReceiptService.addPayment/voidPayment -> EarningService.syncEarningFromReceipt).
 * This controller is read-only — there is no way to create/edit/delete an
 * Earning directly; record or void a payment on its Receipt instead.
 */

async function scopeToTelemarketerClients(req: Request, params: EarningQueryParams): Promise<void> {
    if (!req.user || ![Role.STAFF, Role.TEAM_LEADER].includes(req.user.role as Role)) return;
    const isTM = await isTelemarketer(req.user.id as string);
    if (!isTM) return;

    const clients = await ClientModel.find({ createdBy: req.user.id }).select("_id").lean();
    const clientIds = clients.map((c) => c._id.toString());
    // A telemarketer's own scope is a single client at a time in this API;
    // if they have no clients, force an impossible match.
    params.clientId = clientIds.length > 0 ? clientIds[0] : "000000000000000000000000";
}

async function getAllEarnings(req: Request, res: Response) {
    try {
        const params: EarningQueryParams = {
            page: parseInt(req.query.page as string) || 1,
            limit: parseInt(req.query.limit as string) || 20,
        };

        if (req.query.clientId) params.clientId = req.query.clientId as string;
        if (req.query.status) params.status = req.query.status as "partial" | "paid" | "void";
        if (req.query.search) params.search = req.query.search as string;
        if (req.query.filterType)
            params.filterType = req.query.filterType as "today" | "week" | "month" | "year";
        if (req.query.month) params.month = parseInt(req.query.month as string);
        if (req.query.year) params.year = parseInt(req.query.year as string);

        await scopeToTelemarketerClients(req, params);

        const result = await earningService.getAllEarnings(params);

        return res.status(200).json({
            message: "Earnings fetched successfully",
            data: result.earnings,
            meta: {
                total: result.total,
                page: result.page,
                totalPages: result.totalPages,
            },
        });
    } catch (error) {
        console.error("Error fetching earnings:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

async function getEarningById(req: Request, res: Response) {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ message: "Earning ID is required" });
        }

        const earning = await earningService.getEarningByIdFromDB(id);

        if (!earning) {
            return res.status(404).json({ message: "Earning not found" });
        }

        return res.status(200).json({
            message: "Earning fetched successfully",
            data: earning,
        });
    } catch (error) {
        console.error("Error fetching earning:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

async function getEarningStats(req: Request, res: Response) {
    try {
        const params: EarningQueryParams = {};

        if (req.query.filterType)
            params.filterType = req.query.filterType as "today" | "week" | "month" | "year";
        if (req.query.month) params.month = parseInt(req.query.month as string);
        if (req.query.year) params.year = parseInt(req.query.year as string);
        if (req.query.clientId) params.clientId = req.query.clientId as string;

        await scopeToTelemarketerClients(req, params);

        const stats = await earningService.getEarningStatsWithFilter(params);

        return res.status(200).json({
            message: "Earning stats fetched successfully",
            data: stats,
        });
    } catch (error) {
        console.error("Error fetching earning stats:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

async function getEarningYears(_req: Request, res: Response) {
    try {
        const years = await earningService.getEarningYearsFromDB();
        return res.status(200).json({
            message: "Years fetched successfully",
            data: years,
        });
    } catch (error) {
        console.error("Error fetching years:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export { getAllEarnings, getEarningById, getEarningStats, getEarningYears };
