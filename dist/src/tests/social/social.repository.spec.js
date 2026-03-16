"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const prisma_social_repository_1 = require("../../social/infrastructure/persistence/prisma-social.repository");
const tenant_scoped_prisma_factory_1 = require("../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
describe('PrismaSocialRepository', () => {
    let repository;
    let tenantScopedPrismaFactory;
    const tenantPrisma = {
        socialPost: {
            findMany: jest.fn(),
            create: jest.fn(),
        },
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                prisma_social_repository_1.PrismaSocialRepository,
                {
                    provide: tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory,
                    useValue: {
                        forTenant: jest.fn().mockReturnValue(tenantPrisma),
                        forTenantContext: jest.fn().mockReturnValue(tenantPrisma),
                    },
                },
            ],
        }).compile();
        repository = module.get(prisma_social_repository_1.PrismaSocialRepository);
        tenantScopedPrismaFactory = module.get(tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory);
    });
    it('deve chamar socialPost.findMany com tenant scope e ordenacao correta', async () => {
        await repository.findFeedByTenant('tenant-123', 10);
        expect(tenantScopedPrismaFactory.forTenant).toHaveBeenCalledWith('tenant-123');
        expect(tenantPrisma.socialPost.findMany).toHaveBeenCalledWith({
            where: { tenantId: 'tenant-123' },
            include: {
                patient: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
    });
    it('deve usar o limite padrao de 20 se omitido', async () => {
        await repository.findFeedByTenant('tenant-123');
        expect(tenantPrisma.socialPost.findMany).toHaveBeenCalledWith(expect.objectContaining({
            take: 20,
        }));
    });
    it('deve criar post com tenant-scoped prisma', async () => {
        const postData = {
            patientId: 'u1',
            tenantId: 't1',
            content: 'Novo Recorde Alcancado!',
            type: 'achievement',
        };
        await repository.createPost(postData);
        expect(tenantScopedPrismaFactory.forTenantContext).toHaveBeenCalledWith({
            userId: 'u1',
            tenantId: 't1',
        });
        expect(tenantPrisma.socialPost.create).toHaveBeenCalledWith({
            data: postData,
        });
    });
});
//# sourceMappingURL=social.repository.spec.js.map