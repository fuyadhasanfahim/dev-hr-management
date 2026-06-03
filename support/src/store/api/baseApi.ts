import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const baseApi = createApi({
    reducerPath: 'api',
    baseQuery: fetchBaseQuery({
        baseUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5000'}/api`,
        credentials: 'include',
    }),
    tagTypes: ['QueuedSessions', 'ActiveSessions', 'SessionMessages', 'UnreadCounts', 'Notifications', 'ClientMeetings', 'Tickets', 'TicketDetail'],
    endpoints: () => ({}),
});
