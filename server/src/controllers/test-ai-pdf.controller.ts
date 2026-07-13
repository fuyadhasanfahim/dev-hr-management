import type { Request, Response, NextFunction } from 'express';
import { TestAiPdfService } from '../services/test-ai-pdf.service.js';

const downloadTestPdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { text } = req.body || {};
        const { buffer, filename } = await TestAiPdfService.generatePdf(text);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (err) {
        next(err);
    }
};

const TestAiPdfController = { downloadTestPdf };
export default TestAiPdfController;
