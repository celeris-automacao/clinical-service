export interface TasksRepositoryPort {
  createTemplate(data: {
    tenantId: string;
    title: string;
    description?: string;
    taskType: string;
    xpReward: number;
    createdByUserId: string;
  }): Promise<any>;
  findTemplateByTitleAndType(title: string, taskType: string, tenantId: string): Promise<any | null>;
  findTemplateById(id: string, tenantId: string): Promise<any | null>;
  listTemplatesByTenant(tenantId: string): Promise<any[]>;
  createAssignment(data: {
    templateId: string;
    patientId: string;
    tenantId: string;
    dueDate: Date;
    assignedByUserId: string;
  }): Promise<any>;
  findAssignmentsByPatient(patientId: string, tenantId: string): Promise<any[]>;
  findAssignmentsByPatientOnDate(patientId: string, tenantId: string, dueDate: Date): Promise<any[]>;
  findAssignmentById(id: string, tenantId: string): Promise<any | null>;
  findPatientById(patientId: string, tenantId: string): Promise<{ id: string } | null>;
  findActiveAssignment(input: {
    patientId: string;
    tenantId: string;
    templateId: string;
    dueDate: Date;
  }): Promise<any | null>;
  findPendingTasksToday(userId: string, tenantId: string, today: Date): Promise<any[]>;
  getPlayerStatsRanking(tenantId: string): Promise<any[]>;
  findPatientsWithActivity(tenantId: string): Promise<any[]>;
}
