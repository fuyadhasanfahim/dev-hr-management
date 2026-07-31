import { isPast } from 'date-fns';

/**
 * Single source of truth for everything the Team Workload / Kanban / Task
 * Detail views need to derive from a raw task: subtasks, progress %,
 * "current task" selection, overdue/blocked state, and status/priority
 * badge styling. Consolidated here because the old DeveloperBoard and
 * KanbanBoard each reimplemented this independently and had started to
 * drift (e.g. different SubTaskItem shapes).
 */

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
    orderId?: any;
    assignedTo?: TaskAssignee | string;
    assignedBy?: any;
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
    reviewedBy?: any;
    reviewedAt?: string;
    createdAt: string;
    updatedAt?: string;
}

/**
 * Subtasks are the single progress source of truth. Older tasks created
 * before the `subtasks[]` field existed encode their checklist as plain
 * text in `description` ("Selected Features & Sub-Features:\n- ..."), so
 * we fall back to parsing that when `subtasks` is empty. Fallback items
 * get a synthetic `fallback_${idx}` id and cannot be toggled server-side.
 */
export function getTaskSubtasks(task: Pick<TaskItem, 'subtasks' | 'description' | 'status'>): SubTaskItem[] {
    if (task.subtasks && task.subtasks.length > 0) {
        return task.subtasks;
    }
    if (task.description && task.description.includes('Selected Features & Sub-Features:\n- ')) {
        const parts = task.description.split('\n\nInstructions:\n');
        const featPart = parts[0];
        const lines = featPart.replace('Selected Features & Sub-Features:\n- ', '').split('\n- ');
        return lines
            .map((line, idx) => ({
                _id: `fallback_${idx}`,
                title: line.trim(),
                completed: task.status === 'completed',
            }))
            .filter((s) => s.title);
    }
    return [];
}

export interface TaskProgress {
    completed: number;
    total: number;
    pct: number;
}

export function getTaskProgress(task: Pick<TaskItem, 'subtasks' | 'description' | 'status'>): TaskProgress {
    const subtasks = getTaskSubtasks(task);
    const completed = subtasks.filter((s) => s.completed).length;
    const total = subtasks.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, pct };
}

export function isTaskOverdue(task: Pick<TaskItem, 'dueDate' | 'status'>): boolean {
    return task.status !== 'completed' && isPast(new Date(task.dueDate));
}

/**
 * A task is treated as "blocked" when it was rejected on review — the
 * schema has no dedicated BLOCKED status, so `rejected` is the closest
 * real signal that work is stuck pending correction.
 */
export function isTaskBlocked(task: Pick<TaskItem, 'status'>): boolean {
    return task.status === 'rejected';
}

const PRIORITY_WEIGHT: Record<TaskItem['priority'], number> = {
    urgent: 3,
    high: 2,
    medium: 1,
    low: 0,
};

/**
 * "Current task" rule for a member, in priority order:
 * 1. In-progress task, tie-broken by highest priority then nearest due date
 * 2. Otherwise nearest-due pending/rejected task
 * 3. Otherwise null ("No active task")
 */
export function getCurrentTask(tasks: TaskItem[]): TaskItem | null {
    if (tasks.length === 0) return null;

    const byPriorityThenDue = (a: TaskItem, b: TaskItem) => {
        const pw = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        if (pw !== 0) return pw;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    };

    const inProgress = tasks.filter((t) => t.status === 'in_progress').sort(byPriorityThenDue);
    if (inProgress.length > 0) return inProgress[0];

    const pending = tasks
        .filter((t) => t.status === 'pending' || t.status === 'rejected')
        .sort(byPriorityThenDue);
    if (pending.length > 0) return pending[0];

    return null;
}

export type WorkloadStatus = 'available' | 'busy' | 'at_capacity';

/** Active = not yet completed. Thresholds: 0 free, 1-2 busy, 3+ at capacity. */
export function getWorkloadStatus(activeCount: number): WorkloadStatus {
    if (activeCount === 0) return 'available';
    if (activeCount <= 2) return 'busy';
    return 'at_capacity';
}

export function countActiveTasks(tasks: TaskItem[]): number {
    return tasks.filter((t) => t.status !== 'completed').length;
}

export const STATUS_LABEL: Record<TaskItem['status'], string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    under_review: 'Review',
    completed: 'Completed',
    rejected: 'Blocked',
};

export const PRIORITY_LABEL: Record<TaskItem['priority'], string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent',
};

export function getAssigneeName(assignee?: TaskAssignee | string | null): string {
    if (!assignee || typeof assignee === 'string') return 'Unassigned';
    return assignee.userId?.name || assignee.name || 'Unassigned';
}

export function getOrderLabel(orderId: TaskItem['orderId']): string | null {
    if (orderId && typeof orderId === 'object' && orderId.orderNumber) {
        return `#${orderId.orderNumber}`;
    }
    return null;
}
