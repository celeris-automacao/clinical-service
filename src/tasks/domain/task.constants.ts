export const TASK_TYPES = [
  'water',
  'workout',
  'diet',
  'sleep',
  'medication',
  'appointment',
  'custom',
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_ASSIGNMENT_STATUSES = ['pending', 'completed', 'expired', 'cancelled'] as const;

export type TaskAssignmentStatus = (typeof TASK_ASSIGNMENT_STATUSES)[number];
