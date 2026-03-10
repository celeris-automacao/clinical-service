"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const rewards_repository_1 = require("../../rewards/repositories/rewards.repository");
const prisma_service_1 = require("../../prisma/prisma.service");
describe('RewardsRepository - Cobertura Total', () => {
    let repository;
    let prisma;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                rewards_repository_1.RewardsRepository,
                {
                    provide: prisma_service_1.PrismaService,
                    useValue: {
                        reward: { findMany: jest.fn(), findUnique: jest.fn() },
                        rewardClaim: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
                    },
                },
            ],
        }).compile();
        repository = module.get(rewards_repository_1.RewardsRepository);
        prisma = module.get(prisma_service_1.PrismaService);
    });
    it('deve executar findClaimsByPatient (Linhas 17-21)', async () => {
        const spy = jest.spyOn(prisma.rewardClaim, 'findMany').mockResolvedValue([]);
        await repository.findClaimsByPatient('u1');
        expect(spy).toHaveBeenCalledWith({ where: { patientId: 'u1' } });
    });
    it('findClaimsByPatient deve buscar o histórico do paciente', async () => {
        const patientId = 'u1';
        const spy = jest.spyOn(prisma.rewardClaim, 'findMany').mockResolvedValue([]);
        await repository.findClaimsByPatient(patientId);
        expect(spy).toHaveBeenCalledWith({ where: { patientId } });
    });
    it('findAllActiveByTenant deve filtrar por clínica e recompensas ativas', async () => {
        const tenantId = 'tenant-123';
        const spy = jest.spyOn(prisma.reward, 'findMany').mockResolvedValue([]);
        await repository.findAllActiveByTenant(tenantId);
        expect(spy).toHaveBeenCalledWith({
            where: { tenantId, isActive: true },
        });
    });
    it('deve executar findById (Linhas 23-27)', async () => {
        const spy = jest.spyOn(prisma.reward, 'findUnique').mockResolvedValue(null);
        await repository.findById('r1');
        expect(spy).toHaveBeenCalledWith({ where: { id: 'r1' } });
    });
    it('deve executar findSpecificClaim (Linhas 29-33)', async () => {
        const spy = jest.spyOn(prisma.rewardClaim, 'findFirst').mockResolvedValue(null);
        await repository.findSpecificClaim('r1', 'u1');
        expect(spy).toHaveBeenCalledWith({ where: { rewardId: 'r1', patientId: 'u1' } });
    });
    it('deve executar createClaim (Linhas 35-37)', async () => {
        const data = { rewardId: 'r1', patientId: 'u1', tenantId: 't1' };
        const spy = jest.spyOn(prisma.rewardClaim, 'create').mockResolvedValue({});
        await repository.createClaim(data);
        expect(spy).toHaveBeenCalledWith({ data });
    });
});
//# sourceMappingURL=rewards.repository.spec.js.map