import { z } from 'zod';

export const InvoiceValidation = z.object({
    body: z.object({
        orderId: z.string().optional(),
        projectId: z.string().optional(),
        milestoneId: z.string().optional(),
        dueDate: z.string().datetime(),
    }).refine(data => {
        // Ensure either orderId or (projectId + milestoneId) is provided
        return data.orderId || (data.projectId && data.milestoneId);
    }, {
        message: "Either orderId or both projectId and milestoneId must be provided",
        path: ["orderId"],
    }),
});
