import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { TasksRepositoryPort } from '../../application/ports/tasks-repository.port';
export declare class PrismaTasksRepository implements TasksRepositoryPort {
    private readonly tenantScopedPrismaFactory;
    constructor(tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    createTemplate(data: {
        tenantId: string;
        title: string;
        description?: string;
        taskType: string;
        xpReward: number;
        createdByUserId: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        isActive: boolean;
        title: string;
        description: string | null;
        taskType: string;
        xpReward: number;
        createdByUserId: string;
    }>;
    findTemplateByTitleAndType(title: string, taskType: string, tenantId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        isActive: boolean;
        title: string;
        description: string | null;
        taskType: string;
        xpReward: number;
        createdByUserId: string;
    }>;
    findTemplateById(id: string, tenantId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        isActive: boolean;
        title: string;
        description: string | null;
        taskType: string;
        xpReward: number;
        createdByUserId: string;
    }>;
    listTemplatesByTenant(tenantId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        isActive: boolean;
        title: string;
        description: string | null;
        taskType: string;
        xpReward: number;
        createdByUserId: string;
    }[]>;
    createAssignment(data: {
        templateId: string;
        patientId: string;
        tenantId: string;
        dueDate: Date;
        assignedByUserId: string;
    }): Promise<{
        template: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            isActive: boolean;
            title: string;
            description: string | null;
            taskType: string;
            xpReward: number;
            createdByUserId: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        patientId: string;
        dueDate: Date;
        completedAt: Date | null;
        templateId: string;
        status: string;
        assignedByUserId: string;
    }>;
    findAssignmentsByPatient(patientId: string, tenantId: string): Promise<({
        template: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            isActive: boolean;
            title: string;
            description: string | null;
            taskType: string;
            xpReward: number;
            createdByUserId: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        patientId: string;
        dueDate: Date;
        completedAt: Date | null;
        templateId: string;
        status: string;
        assignedByUserId: string;
    })[]>;
    findAssignmentsByPatientOnDate(patientId: string, tenantId: string, dueDate: Date): Promise<({
        template: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            isActive: boolean;
            title: string;
            description: string | null;
            taskType: string;
            xpReward: number;
            createdByUserId: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        patientId: string;
        dueDate: Date;
        completedAt: Date | null;
        templateId: string;
        status: string;
        assignedByUserId: string;
    })[]>;
    findAssignmentById(id: string, tenantId: string): Promise<{
        template: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            isActive: boolean;
            title: string;
            description: string | null;
            taskType: string;
            xpReward: number;
            createdByUserId: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        patientId: string;
        dueDate: Date;
        completedAt: Date | null;
        templateId: string;
        status: string;
        assignedByUserId: string;
    }>;
    findPatientById(patientId: string, tenantId: string): Promise<{
        id: string;
    } | null>;
    findActiveAssignment(input: {
        patientId: string;
        tenantId: string;
        templateId: string;
        dueDate: Date;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        patientId: string;
        dueDate: Date;
        completedAt: Date | null;
        templateId: string;
        status: string;
        assignedByUserId: string;
    }>;
    findPendingTasksToday(userId: string, tenantId: string, today: Date): Promise<({
        template: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            isActive: boolean;
            title: string;
            description: string | null;
            taskType: string;
            xpReward: number;
            createdByUserId: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        patientId: string;
        dueDate: Date;
        completedAt: Date | null;
        templateId: string;
        status: string;
        assignedByUserId: string;
    })[]>;
    getPlayerStatsRanking(tenantId: string): Promise<any[]>;
    findPatientsWithActivity(tenantId: string): Promise<any[]>;
}
