import type { Request, Response } from "express";
import { QuotationService } from "../services/quotation.service.js";

const createQuotation = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new Error("Unauthorized");

    const result = await QuotationService.createQuotation(req.body, userId);
    res.status(201).json({
      success: true,
      message: "Quotation created successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create quotation",
    });
  }
};

const updateQuotation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await QuotationService.updateQuotation(
      id as string,
      req.body,
    );
    if (!result) {
      res.status(404).json({ success: false, message: "Quotation not found" });
      return;
    }
    res.status(200).json({
      success: true,
      message: "Quotation updated successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update quotation",
    });
  }
};

const getAllQuotations = async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.clientId) filters.clientId = req.query.clientId;
    if (req.query.search) filters.search = req.query.search;

    const options = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
    };

    const result = await QuotationService.getQuotations(filters, options);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch quotations",
    });
  }
};

const getQuotationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await QuotationService.getQuotationById(id as string);
    if (!result) {
      res.status(404).json({ success: false, message: "Quotation not found" });
      return;
    }
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch quotation",
    });
  }
};

const deleteQuotation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await QuotationService.deleteQuotation(id as string);
    if (!result) {
      res.status(404).json({ success: false, message: "Quotation not found" });
      return;
    }
    res.status(200).json({
      success: true,
      message: "Quotation deleted successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete quotation",
    });
  }
};

export default {
  createQuotation,
  updateQuotation,
  getAllQuotations,
  getQuotationById,
  deleteQuotation,
  convertToOrder: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const result = await QuotationService.convertToOrder(
        id as string,
        userId,
      );
      res.status(201).json({
        success: true,
        message: "Quotation converted to order successfully",
        data: result,
      });
    } catch (error: any) {
      console.error(`CONVERT ERROR [ID: ${req.params.id}]:`, error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to convert quotation to order",
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  },
};
