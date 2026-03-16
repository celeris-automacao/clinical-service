"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const tenant_scoped_prisma_factory_1 = require("../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
const prisma_task_completion_transaction_adapter_1 = require("../../tasks/infrastructure/persistence/prisma-task-completion-transaction.adapter");
describe('PrismaTaskCompletionTransactionAdapter', () => {
    let adapter;
    let tenantScopedPrismaFactory;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                prisma_task_completion_transaction_adapter_1.PrismaTaskCompletionTransactionAdapter,
                {
                    provide: tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory,
                    useValue: {
                        runInTenantTransaction: jest.fn(),
                    },
                },
            ],
        }).compile();
        adapter = module.get(prisma_task_completion_transaction_adapter_1.PrismaTaskCompletionTransactionAdapter);
        tenantScopedPrismaFactory = module.get(tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory);
    });
    it('deve concluir a atribuicao, atualizar progressao e aplicar dano normal ao boss', async () => {
        const tx = {
            taskAssignment: { update: jest.fn() },
            playerStats: {
                upsert: jest.fn().mockResolvedValue({ currentLevel: 1, currentXp: 50 }),
                update: jest.fn(),
            },
            bossBattle: {
                findFirst: jest.fn().mockResolvedValue({ id: 'boss-1', currentHp: 1000 }),
                update: jest.fn(),
            },
        };
        tenantScopedPrismaFactory.runInTenantTransaction.mockImplementation(async (_context, callback) => callback(tx));
        const result = await adapter.execute({
            assignmentId: 'assignment-1',
            patientId: 'user-1',
            tenantId: 'tenant-1',
            xpReward: 50,
        });
        expect(tx.taskAssignment.update).toHaveBeenCalled();
        expect(tx.playerStats.update).toHaveBeenCalled();
        expect(tx.bossBattle.update).toHaveBeenCalledWith({
            where: { id: 'boss-1' },
            data: { currentHp: 950 },
        });
        expect(result.bossDamage).toBe(50);
    });
    it('deve retornar boss derrotado sem atualizar hp quando o dano zerar a vida', async () => {
        const tx = {
            taskAssignment: { update: jest.fn() },
            playerStats: {
                upsert: jest.fn().mockResolvedValue({ currentLevel: 1, currentXp: 0 }),
                update: jest.fn(),
            },
            bossBattle: {
                findFirst: jest.fn().mockResolvedValue({ id: 'boss-1', currentHp: 50 }),
                update: jest.fn(),
            },
        };
        tenantScopedPrismaFactory.runInTenantTransaction.mockImplementation(async (_context, callback) => callback(tx));
        const result = await adapter.execute({
            assignmentId: 'assignment-1',
            patientId: 'user-1',
            tenantId: 'tenant-1',
            xpReward: 100,
        });
        expect(tx.bossBattle.update).not.toHaveBeenCalled();
        expect(result.defeatedBossId).toBe('boss-1');
    });
    it('deve retornar dano zero se nao houver boss ativo', async () => {
        const tx = {
            taskAssignment: { update: jest.fn() },
            playerStats: {
                upsert: jest.fn().mockResolvedValue({ currentLevel: 1, currentXp: 0 }),
                update: jest.fn(),
            },
            bossBattle: {
                findFirst: jest.fn().mockResolvedValue(null),
                update: jest.fn(),
            },
        };
        tenantScopedPrismaFactory.runInTenantTransaction.mockImplementation(async (_context, callback) => callback(tx));
        const result = await adapter.execute({
            assignmentId: 'assignment-1',
            patientId: 'user-1',
            tenantId: 'tenant-1',
            xpReward: 100,
        });
        expect(result.bossDamage).toBe(0);
        expect(result.defeatedBossId).toBeUndefined();
    });
});
//# sourceMappingURL=prisma-task-completion-transaction.adapter.spec.js.map