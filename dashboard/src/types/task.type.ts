import type { IOrder } from './order.type';

// Shapes the task API returns, shared by the task screens, the progress helpers and the task API slice.

// The order a task belongs to, when the API populates it.
export interface TaskOrderRef {
    _id: string;
    orderId?: string;
    orderNumber?: string;
    projectName?: string;
    title?: string;
    quotationSnapshot?: IOrder['quotationSnapshot'];
}

export interface SubTaskItem {
    _id: string;
    title: string;
    completed: boolean;
    completedAt?: string;
    isSubFeature?: boolean;
    parentName?: string;
    needsRevision?: boolean;
    revisionNote?: string;
}

export interface TaskAssignee {
    _id: string;
    name?: string;
    designation?: string;
    userId?: {
        _id: string;
        name: string;
        email: string;
        image?: string;
    };
}

export interface TaskItem {
    _id: string;
    orderId?: TaskOrderRef | string;
    assignedTo?: TaskAssignee | string;
    assignedBy?: TaskAssignee | string;
    title: string;
    description?: string;
    subtasks?: SubTaskItem[];
    status: 'pending' | 'in_progress' | 'under_review' | 'completed' | 'rejected';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    startDate?: string;
    dueDate: string;
    submissionNote?: string;
    submissionAttachment?: string;
    submittedAt?: string;
    reviewNote?: string;
    reviewedBy?: TaskAssignee | string;
    reviewedAt?: string;
    createdAt: string;
    updatedAt?: string;
}

// A row of the staff list as the task screens read it: the person's name sits on `user`, or directly on the row
// for older records.
export interface StaffListItem {
    _id: string;
    name?: string;
    designation?: string;
    staffId?: string;
    user?: { _id?: string; name?: string; email?: string; image?: string };
    userId?: { _id: string; name: string; email: string; image?: string } | string;
}

// One entry of a quotation's scope of work, as parsed from the quotation text or JSON: a plain line, or an
// object whose sub-features sit under `children`, `subFeatures` or `items`.
export type RawScopeItem =
    | string
    | {
          name?: string;
          title?: string;
          route?: string;
          price?: string;
          children?: RawScopeItem[];
          subFeatures?: RawScopeItem[];
          items?: RawScopeItem[];
      };
