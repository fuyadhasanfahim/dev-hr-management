import { baseApi } from './baseApi';

export type TicketStatus =
    | 'open'
    | 'in_progress'
    | 'pending_client'
    | 'resolved'
    | 'closed';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TicketCategory =
    | 'support'
    | 'service'
    | 'development'
    | 'billing'
    | 'bug';

export type TicketSource = 'direct' | 'ai_chat' | 'live_chat';

export interface TicketUser {
    _id: string;
    name: string;
    email: string;
}

export interface Ticket {
    _id: string;
    ticketId: string;
    subject: string;
    status: TicketStatus;
    priority: TicketPriority;
    category?: TicketCategory;
    source?: TicketSource;
    clientId?: TicketUser | null;
    guestId?: TicketUser | null;
    assignedTo?: TicketUser | null;
    tags: string[];
    attachments: string[];
    createdAt: string;
    updatedAt: string;
}

export interface TicketReply {
    _id: string;
    content: string;
    text: string;
    attachments: string[];
    senderModel: 'Client' | 'Staff' | 'Guest';
    senderType: 'client' | 'staff' | 'guest';
    senderId?: TicketUser | null;
    senderName?: string;
    isInternalNote?: boolean;
    createdAt: string;
}

export interface TicketDetail extends Ticket {
    text: string;
    replies: TicketReply[];
}

interface ListTicketsArgs {
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: TicketCategory;
}

export const ticketApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getTickets: builder.query<Ticket[], ListTicketsArgs | void>({
            query: (args) => {
                const params = new URLSearchParams();
                if (args?.status) params.set('status', args.status);
                if (args?.priority) params.set('priority', args.priority);
                if (args?.category) params.set('category', args.category);
                const qs = params.toString();
                return `/support/tickets/admin${qs ? `?${qs}` : ''}`;
            },
            transformResponse: (res: { data: Ticket[] }) => res.data ?? [],
            providesTags: ['Tickets'],
        }),
        getTicketDetail: builder.query<TicketDetail, string>({
            query: (id) => `/support/tickets/${id}`,
            transformResponse: (res: { data: TicketDetail }) => res.data,
            providesTags: (_result, _error, id) => [{ type: 'TicketDetail', id }],
        }),
        replyToTicket: builder.mutation<
            unknown,
            { id: string; text: string; attachments?: string[] }
        >({
            query: ({ id, text, attachments }) => ({
                url: `/support/tickets/${id}/replies`,
                method: 'POST',
                body: { text, attachments: attachments ?? [] },
            }),
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'TicketDetail', id },
                'Tickets',
            ],
        }),
        updateTicketStatus: builder.mutation<
            Ticket,
            { id: string; status: TicketStatus }
        >({
            query: ({ id, status }) => ({
                url: `/support/tickets/${id}/status`,
                method: 'PATCH',
                body: { status },
            }),
            transformResponse: (res: { data: Ticket }) => res.data,
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'TicketDetail', id },
                'Tickets',
            ],
        }),
        updateTicket: builder.mutation<
            Ticket,
            {
                id: string;
                priority?: TicketPriority;
                status?: TicketStatus;
                category?: TicketCategory;
                assignedTo?: string;
                tags?: string[];
            }
        >({
            query: ({ id, ...body }) => ({
                url: `/support/tickets/${id}`,
                method: 'PATCH',
                body,
            }),
            transformResponse: (res: { data: Ticket }) => res.data,
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'TicketDetail', id },
                'Tickets',
            ],
        }),
        assignTicketToSelf: builder.mutation<Ticket, string>({
            query: (id) => ({
                url: `/support/tickets/${id}/assign`,
                method: 'POST',
            }),
            transformResponse: (res: { data: Ticket }) => res.data,
            invalidatesTags: (_result, _error, id) => [
                { type: 'TicketDetail', id },
                'Tickets',
            ],
        }),
    }),
});

export const {
    useGetTicketsQuery,
    useGetTicketDetailQuery,
    useReplyToTicketMutation,
    useUpdateTicketStatusMutation,
    useUpdateTicketMutation,
    useAssignTicketToSelfMutation,
} = ticketApi;
