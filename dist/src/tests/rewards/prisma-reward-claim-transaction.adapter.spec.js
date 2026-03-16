"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const testing_1 = require("@nestjs/testing");
const tenant_scoped_prisma_factory_1 = require("../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
const prisma_reward_claim_transaction_adapter_1 = require("../../rewards/infrastructure/persistence/prisma-reward-claim-transaction.adapter");
describe('PrismaRewardClaimTransactionAdapter', () => {
    let adapter;
    let tenantScopedPrismaFactory;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                prisma_reward_claim_transaction_adapter_1.PrismaRewardClaimTransactionAdapter,
                {
                    provide: tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory,
                    useValue: {
                        runInTenantTransaction: jest.fn(),
                    },
                },
            ],
        }).compile();
        adapter = module.get(prisma_reward_claim_transaction_adapter_1.PrismaRewardClaimTransactionAdapter);
        tenantScopedPrismaFactory = module.get(tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory);
    });
    it('deve lancar erro se o perfil do jogador nao existir', async () => {
        const tx = {
            playerStats: {
                findUnique: jest.fn().mockResolvedValue(null),
            },
        };
        tenantScopedPrismaFactory.runInTenantTransaction.mockImplementation(async (_context, callback) => callback(tx));
        await expect(adapter.claimReward({
            rewardId: 'r1',
            patientId: 'u1',
            tenantId: 't1',
            requiredDamage: 100,
            goldCost: 50,
        })).rejects.toThrow(new common_1.BadRequestException('Perfil do jogador nao encontrado.'));
    });
    it('deve lancar erro se o dano for insuficiente', async () => {
        const tx = {
            playerStats: {
                findUnique: jest.fn().mockResolvedValue({ totalDamageDealt: 20, currentGold: 500 }),
            },
        };
        tenantScopedPrismaFactory.runInTenantTransaction.mockImplementation(async (_context, callback) => callback(tx));
        await expect(adapter.claimReward({
            rewardId: 'r1',
            patientId: 'u1',
            tenantId: 't1',
            requiredDamage: 100,
            goldCost: 50,
        })).rejects.toThrow(new common_1.BadRequestException('Dano total insuficiente para desbloquear.'));
    });
    it('deve lancar erro se o ouro for insuficiente', async () => {
        const tx = {
            playerStats: {
                findUnique: jest.fn().mockResolvedValue({ totalDamageDealt: 1000, currentGold: 20 }),
            },
        };
        tenantScopedPrismaFactory.runInTenantTransaction.mockImplementation(async (_context, callback) => callback(tx));
        await expect(adapter.claimReward({
            rewardId: 'r1',
            patientId: 'u1',
            tenantId: 't1',
            requiredDamage: 100,
            goldCost: 50,
        })).rejects.toThrow(/Saldo insuficiente/);
    });
    it('deve atualizar ouro e criar o reward claim dentro da transacao', async () => {
        const tx = {
            playerStats: {
                findUnique: jest.fn().mockResolvedValue({ totalDamageDealt: 1000, currentGold: 200 }),
                update: jest.fn().mockResolvedValue({}),
            },
            rewardClaim: {
                create: jest.fn().mockResolvedValue({}),
            },
        };
        tenantScopedPrismaFactory.runInTenantTransaction.mockImplementation(async (_context, callback) => callback(tx));
        const result = await adapter.claimReward({
            rewardId: 'r1',
            patientId: 'u1',
            tenantId: 't1',
            requiredDamage: 100,
            goldCost: 50,
        });
        expect(tenantScopedPrismaFactory.runInTenantTransaction).toHaveBeenCalledWith({ userId: 'u1', tenantId: 't1' }, expect.any(Function));
        expect(tx.playerStats.update).toHaveBeenCalledWith({
            where: { patientId: 'u1' },
            data: { currentGold: { decrement: 50 } },
        });
        expect(tx.rewardClaim.create).toHaveBeenCalledWith({
            data: {
                rewardId: 'r1',
                patientId: 'u1',
                tenantId: 't1',
            },
        });
        expect(result).toEqual({ remainingGold: 150 });
    });
});
//# sourceMappingURL=prisma-reward-claim-transaction.adapter.spec.js.map