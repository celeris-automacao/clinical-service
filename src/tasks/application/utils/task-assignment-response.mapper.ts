type RawTaskAssignment = {
  id: string;
  templateId: string;
  patientId: string;
  status?: string;
  dueDate: Date;
  completedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  template?: {
    title?: string;
    description?: string;
    taskType?: string;
    xpReward?: number;
  } | null;
};

function normalizeTaskType(rawType?: string, title?: string, description?: string): string {
  const type = (rawType ?? '').toLowerCase().trim();
  if (type === 'diet' || type === 'nutrition') return 'nutrition';
  if (type === 'water' || type === 'hydration') return 'water';
  if (type === 'workout' || type === 'exercise') return 'workout';
  if (type === 'meditation') return 'meditation';

  const text = `${title ?? ''} ${description ?? ''}`.toLowerCase();
  if (text.includes('refeic') || text.includes('aliment') || text.includes('nutri')) {
    return 'nutrition';
  }
  if (text.includes('agua') || text.includes('hidrata')) return 'water';
  if (text.includes('caminhad') || text.includes('exerc') || text.includes('treino')) {
    return 'workout';
  }
  return 'general';
}

export function mapTaskAssignmentResponse(assignment: RawTaskAssignment) {
  const title = assignment.template?.title || 'Tarefa';
  const description = assignment.template?.description || '';
  const taskType = normalizeTaskType(assignment.template?.taskType, title, description);

  return {
    id: assignment.id,
    templateId: assignment.templateId,
    patientId: assignment.patientId,
    title,
    description,
    taskType,
    xpReward: assignment.template?.xpReward || 0,
    status: assignment.status,
    dueDate: assignment.dueDate,
    isCompleted: assignment.status === 'completed' || Boolean(assignment.completedAt),
    completedAt: assignment.completedAt,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  };
}

