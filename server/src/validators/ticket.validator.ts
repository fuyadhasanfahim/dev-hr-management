import { z } from 'zod';
import { TicketCategory, TicketStatus, TicketPriority } from '../models/ticket.model.js';

// ─── Shared enums ────────────────────────────────────────────────────────────

const categoryEnum = z.nativeEnum(TicketCategory);
const statusEnum   = z.nativeEnum(TicketStatus);
const priorityEnum = z.nativeEnum(TicketPriority);

// ─── POST /support/tickets (direct creation) ─────────────────────────────────

export const CreateTicketValidation = z.object({
    body: z.object({
        subject: z.string().min(1, 'Subject is required').max(300).trim(),
        text: z.string().min(1, 'Description is required').trim(),
        attachments: z.array(z.string()).optional(),
        priority: priorityEnum.optional(),
        category: categoryEnum.optional(),
    }),
});

// ─── PATCH /support/tickets/:id (staff update) ──────────────────────────────

export const UpdateTicketValidation = z.object({
    body: z.object({
        status: statusEnum.optional(),
        priority: priorityEnum.optional(),
        category: categoryEnum.optional(),
        assignedTo: z.string().optional(),
        tags: z.array(z.string()).optional(),
    }),
    params: z.object({
        id: z.string().min(1),
    }),
});

// ─── PATCH /support/tickets/:id/status ───────────────────────────────────────

export const UpdateTicketStatusValidation = z.object({
    body: z.object({
        status: statusEnum,
    }),
    params: z.object({
        id: z.string().min(1),
    }),
});

// ─── POST /support/chat/sessions/:sessionId/convert ──────────────────────────

export const ConvertChatToTicketValidation = z.object({
    params: z.object({
        sessionId: z.string().min(1),
    }),
    body: z.object({
        reason: z.string().max(1000).optional(),
        subject: z.string().max(300).trim().optional(),
        category: categoryEnum.optional(),
    }),
});

// ─── Legacy POST /support/chats/convert (body-based) ─────────────────────────

export const ConvertChatToTicketBodyValidation = z.object({
    body: z.object({
        sessionId: z.string().min(1, 'Session ID is required'),
        reason: z.string().max(1000).optional(),
        subject: z.string().max(300).trim().optional(),
        category: categoryEnum.optional(),
    }),
});

// ─── POST /ai-chat/ticket ────────────────────────────────────────────────────

export const CreateTicketFromAIValidation = z.object({
    body: z.object({
        subject: z.string().min(1, 'Subject is required').max(300).trim(),
        description: z.string().min(1, 'Description is required').trim(),
        chatHistory: z.array(z.any()).optional(),
        category: categoryEnum.optional(),
        // Supplied by unverified visitors who aren't signed in.
        name: z.string().trim().optional(),
        email: z.string().email('Invalid email').trim().optional(),
    }),
});
