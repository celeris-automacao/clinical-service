export declare const TASK_TYPES: readonly ["water", "workout", "diet", "sleep", "medication", "appointment", "custom"];
export type TaskType = (typeof TASK_TYPES)[number];
export declare const TASK_ASSIGNMENT_STATUSES: readonly ["pending", "completed", "expired", "cancelled"];
export type TaskAssignmentStatus = (typeof TASK_ASSIGNMENT_STATUSES)[number];
