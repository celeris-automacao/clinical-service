"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const tenant_scoped_prisma_factory_1 = require("../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
const prisma_tasks_repository_1 = require("../../tasks/infrastructure/persistence/prisma-tasks.repository");
describe('PrismaTasksRepository', () => {
    let repository;
    let tenantScopedPrismaFactory;
    const tenantPrisma = {
        taskTemplate: {
            create: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
        },
        taskAssignment: {
            create: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
        },
        playerStats: {
            findMany: jest.fn(),
        },
        patient: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
        },
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                prisma_tasks_repository_1.PrismaTasksRepository,
                {
                    provide: tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory,
                    useValue: {
                        forTenant: jest.fn().mockReturnValue(tenantPrisma),
                        forTenantContext: jest.fn().mockReturnValue(tenantPrisma),
                    },
                },
            ],
        }).compile();
        repository = module.get(prisma_tasks_repository_1.PrismaTasksRepository);
        tenantScopedPrismaFactory = module.get(tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory);
    });
    it('deve criar template dentro do tenant', async () => {
        await repository.createTemplate({
            tenantId: 'tenant-1',
            title: 'Beber agua',
            taskType: 'water',
            xpReward: 100,
            createdByUserId: 'staff-1',
        });
        expect(tenantPrisma.taskTemplate.create).toHaveBeenCalled();
    });
    it('deve listar templates do tenant', async () => {
        await repository.listTemplatesByTenant('tenant-1');
        expect(tenantPrisma.taskTemplate.findMany).toHaveBeenCalledWith({
            where: { tenantId: 'tenant-1' },
            orderBy: [{ isActive: 'desc' }, { title: 'asc' }],
        });
    });
    it('deve criar atribuicao com include do template', async () => {
        await repository.createAssignment({
            templateId: 'template-1',
            patientId: 'patient-1',
            tenantId: 'tenant-1',
            dueDate: new Date('2026-03-20'),
            assignedByUserId: 'staff-1',
        });
        expect(tenantPrisma.taskAssignment.create).toHaveBeenCalled();
    });
    it('deve buscar atribuicoes do paciente no tenant', async () => {
        await repository.findAssignmentsByPatient('patient-1', 'tenant-1');
        expect(tenantScopedPrismaFactory.forTenantContext).toHaveBeenCalledWith({
            userId: 'patient-1',
            tenantId: 'tenant-1',
        });
        expect(tenantPrisma.taskAssignment.findMany).toHaveBeenCalled();
    });
    it('deve buscar uma atribuicao pelo id dentro do tenant', async () => {
        await repository.findAssignmentById('assignment-1', 'tenant-1');
        expect(tenantPrisma.taskAssignment.findFirst).toHaveBeenCalledWith({
            where: { id: 'assignment-1', tenantId: 'tenant-1' },
            include: { template: true },
        });
    });
    it('deve validar se o paciente existe dentro do tenant', async () => {
        await repository.findPatientById('patient-1', 'tenant-1');
        expect(tenantPrisma.patient.findFirst).toHaveBeenCalledWith({
            where: { id: 'patient-1', tenantId: 'tenant-1' },
            select: { id: true },
        });
    });
    it('deve buscar atribuicoes pendentes de hoje filtrando por tenant', async () => {
        const today = new Date('2026-03-03');
        await repository.findPendingTasksToday('user-1', 'tenant-1', today);
        expect(tenantScopedPrismaFactory.forTenantContext).toHaveBeenCalledWith({
            userId: 'user-1',
            tenantId: 'tenant-1',
        });
        expect(tenantPrisma.taskAssignment.findMany).toHaveBeenCalled();
    });
    it('deve buscar o ranking filtrando por tenant', async () => {
        await repository.getPlayerStatsRanking('tenant-1');
        expect(tenantPrisma.playerStats.findMany).toHaveBeenCalledWith({
            where: { tenantId: 'tenant-1' },
            select: {
                currentLevel: true,
                currentXp: true,
                totalDamageDealt: true,
                patient: { select: { name: true } },
            },
            orderBy: [{ currentLevel: 'desc' }, { currentXp: 'desc' }, { totalDamageDealt: 'desc' }],
        });
    });
});
//# sourceMappingURL=tasks.repository.spec.js.map