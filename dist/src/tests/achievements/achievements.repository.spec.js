"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const achievements_repository_1 = require("../../achievements/repositories/achievements.repository");
const prisma_service_1 = require("../../prisma/prisma.service");
describe('AchievementsRepository', () => {
    let repository;
    let prisma;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                achievements_repository_1.AchievementsRepository,
                {
                    provide: prisma_service_1.PrismaService,
                    useValue: {
                        reward: { upsert: jest.fn() },
                        rewardClaim: { findFirst: jest.fn(), create: jest.fn() },
                    },
                },
            ],
        }).compile();
        repository = module.get(achievements_repository_1.AchievementsRepository);
        prisma = module.get(prisma_service_1.PrismaService);
    });
    it('getOrCreateBadge deve usar upsert com a chave composta (title_tenantId)', async () => {
        await repository.getOrCreateBadge('t1', 'Badge Teste', 'icon-1');
        expect(prisma.reward.upsert).toHaveBeenCalledWith({
            where: { title_tenantId: { title: 'Badge Teste', tenantId: 't1' } },
            update: {},
            create: expect.objectContaining({ title: 'Badge Teste', tenantId: 't1' })
        });
    });
    it('createClaim deve salvar o registro de ganho da medalha', async () => {
        await repository.createClaim('p1', 't1', 'r1');
        expect(prisma.rewardClaim.create).toHaveBeenCalledWith({
            data: { rewardId: 'r1', patientId: 'p1', tenantId: 't1' }
        });
    });
});
//# sourceMappingURL=achievements.repository.spec.js.map