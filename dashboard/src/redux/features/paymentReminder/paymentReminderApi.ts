import { apiSlice } from "@/redux/api/apiSlice";

export type ReminderKind = "due" | "recurring";
export type ReminderStatus =
  | "awaiting_decision"
  | "scheduled"
  | "paused"
  | "cancelled"
  | "done";
export type ScheduleOption = "instant" | "3d" | "7d" | "custom";

export interface IPaymentReminder {
  _id: string;
  kind: ReminderKind;
  orderId: string;
  receiptId?: string;
  orderNumber: string;
  clientName: string;
  title: string;
  amount: number;
  currency: string;
  cycle?: "monthly" | "yearly";
  status: ReminderStatus;
  sendAt?: string;
  dueDate?: string;
  lastPaidAt?: string;
  paidCount?: number;
  lastChannels?: string[];
  lastSentAt?: string;
  sentCount: number;
  lastError?: string;
}

export interface ScheduleItem {
  id: string;
  option: ScheduleOption;
  date?: string;
}

export interface PaidDetails {
  amount?: number;
  paidAt?: string;
  method?: string;
  note?: string;
}

export type ReminderAction =
  | "pause"
  | "resume"
  | "cancel"
  | "send-now"
  | "mark-paid";

const unwrap = <T,>(r: { data: T }) => r.data;

export const paymentReminderApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getReminders: builder.query<IPaymentReminder[], { kind?: ReminderKind }>({
      query: (params) => ({ url: "/payment-reminders", params }),
      transformResponse: unwrap<IPaymentReminder[]>,
      providesTags: ["PaymentReminder"],
    }),
    getPendingReminders: builder.query<IPaymentReminder[], void>({
      query: () => "/payment-reminders/pending",
      transformResponse: unwrap<IPaymentReminder[]>,
      providesTags: ["PaymentReminder"],
    }),
    // Deliberately no invalidation: the open dialog must keep its list.
    markRemindersPrompted: builder.mutation<void, string[]>({
      query: (ids) => ({
        url: "/payment-reminders/prompted",
        method: "POST",
        body: { ids },
      }),
    }),
    scheduleReminders: builder.mutation<void, ScheduleItem[]>({
      query: (items) => ({
        url: "/payment-reminders/schedule",
        method: "POST",
        body: { items },
      }),
      invalidatesTags: ["PaymentReminder"],
    }),
    rescheduleReminder: builder.mutation<void, ScheduleItem>({
      query: ({ id, ...body }) => ({
        url: `/payment-reminders/${id}/schedule`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["PaymentReminder"],
    }),
    getHeadsUp: builder.query<IPaymentReminder[], void>({
      query: () => "/payment-reminders/heads-up",
      transformResponse: unwrap<IPaymentReminder[]>,
      providesTags: ["PaymentReminder"],
    }),
    // No invalidation, same reason as markRemindersPrompted.
    markHeadsUpSeen: builder.mutation<void, string[]>({
      query: (ids) => ({
        url: "/payment-reminders/heads-up/seen",
        method: "POST",
        body: { ids },
      }),
    }),
    reminderAction: builder.mutation<
      void,
      { id: string; action: ReminderAction; body?: PaidDetails }
    >({
      query: ({ id, action, body }) => ({
        url: `/payment-reminders/${id}/${action}`,
        method: "POST",
        ...(body ? { body } : {}),
      }),
      invalidatesTags: ["PaymentReminder"],
    }),
    syncReminders: builder.mutation<{ created: number }, void>({
      query: () => ({ url: "/payment-reminders/sync", method: "POST" }),
      transformResponse: unwrap<{ created: number }>,
      invalidatesTags: ["PaymentReminder"],
    }),
  }),
});

export const {
  useGetRemindersQuery,
  useGetPendingRemindersQuery,
  useGetHeadsUpQuery,
  useMarkHeadsUpSeenMutation,
  useMarkRemindersPromptedMutation,
  useScheduleRemindersMutation,
  useRescheduleReminderMutation,
  useReminderActionMutation,
  useSyncRemindersMutation,
} = paymentReminderApi;
