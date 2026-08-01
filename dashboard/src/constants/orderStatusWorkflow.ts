import type { IOrder, OrderStatus } from "@/types/order.type";

/**
 * Order status state machine — must match ALLOWED_STATUS_TRANSITIONS in
 * server/src/models/order.model.ts exactly. This is the single source of
 * truth for which status an order can be manually moved to next; do not
 * reimplement this table anywhere else (see E1-F1-T2 in
 * ENGINEERING_BACKLOG.md for what happens when it drifts).
 */
export const ORDER_STATUS_WORKFLOW: Record<OrderStatus, OrderStatus[]> = {
    pending: ["in_progress", "cancelled"],
    in_progress: ["completed", "revision", "cancelled"],
    revision: ["in_progress", "cancelled"],
    completed: ["delivered", "revision"],
    delivered: ["revision"],
    cancelled: [],
};

/** Returns the set of statuses `order` can be manually transitioned to next. */
export const getFilteredStatusOptions = (order: IOrder): OrderStatus[] => {
    const currentStatus = order.status;
    const baseOptions = ORDER_STATUS_WORKFLOW[currentStatus] || [];
    return baseOptions.filter((opt) => opt !== currentStatus);
};
