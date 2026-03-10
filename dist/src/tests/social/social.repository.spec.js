"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const social_repository_1 = require("../../social/repositories/social.repository");
const prisma_service_1 = require("../../prisma/prisma.service");
describe('SocialRepository', () => {
    let repository;
    let prisma;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                social_repository_1.SocialRepository,
                {
                    provide: prisma_service_1.PrismaService,
                    useValue: {
                        socialPost: {
                            findMany: jest.fn(),
                            create: jest.fn(),
                        },
                    },
                },
            ],
        }).compile();
        repository = module.get(social_repository_1.SocialRepository);
        prisma = module.get(prisma_service_1.PrismaService);
    });
    describe('findFeedByTenant', () => {
        it('deve chamar prisma.socialPost.findMany com os filtros e ordenação corretos', async () => {
            const tenantId = 'tenant-123';
            const limit = 10;
            await repository.findFeedByTenant(tenantId, limit);
            expect(prisma.socialPost.findMany).toHaveBeenCalledWith({
                where: { tenantId },
                include: {
                    patient: { select: { name: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
            });
        });
        it('deve usar o limite padrão de 20 postagens se o parâmetro for omitido', async () => {
            const tenantId = 'tenant-123';
            await repository.findFeedByTenant(tenantId);
            expect(prisma.socialPost.findMany).toHaveBeenCalledWith(expect.objectContaining({
                take: 20,
            }));
        });
    });
    describe('createPost', () => {
        it('deve chamar prisma.socialPost.create com os dados mapeados corretamente', async () => {
            const postData = {
                patientId: 'u1',
                tenantId: 't1',
                content: 'Novo Recorde Alcançado!',
                type: 'achievement'
            };
            await repository.createPost(postData);
            expect(prisma.socialPost.create).toHaveBeenCalledWith({
                data: postData,
            });
        });
    });
});
//# sourceMappingURL=social.repository.spec.js.map