"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const tenant_scoped_prisma_factory_1 = require("../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
const prisma_staff_repository_1 = require("../../staff/infrastructure/persistence/prisma-staff.repository");
describe('PrismaStaffRepository', () => {
    let repository;
    let tenantScopedPrismaFactory;
    const rootPrisma = {
        staffInvitation: {
            findFirst: jest.fn(),
            updateMany: jest.fn(),
        },
    };
    const tenantPrisma = {
        staff: {
            create: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
            updateMany: jest.fn(),
            count: jest.fn(),
        },
        staffInvitation: {
            create: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            updateMany: jest.fn(),
        },
        staffAuditLog: {
            findMany: jest.fn(),
        },
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                prisma_staff_repository_1.PrismaStaffRepository,
                {
                    provide: tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory,
                    useValue: {
                        forRoot: jest.fn().mockReturnValue(rootPrisma),
                        forTenant: jest.fn().mockReturnValue(tenantPrisma),
                        forTenantContext: jest.fn().mockReturnValue(tenantPrisma),
                    },
                },
            ],
        }).compile();
        repository = module.get(prisma_staff_repository_1.PrismaStaffRepository);
        tenantScopedPrismaFactory = module.get(tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory);
    });
    it('deve criar um profissional com contexto de tenant e usuario', async () => {
        const data = {
            tenantId: 'tenant-1',
            userId: 'user-1',
            name: 'Dra. Ana',
            document: '123',
            professionalType: 'doctor',
            specialty: 'clinica geral',
            role: 'doctor',
            status: 'active',
        };
        await repository.create(data);
        expect(tenantScopedPrismaFactory.forTenantContext).toHaveBeenCalledWith({
            userId: 'user-1',
            tenantId: 'tenant-1',
        });
        expect(tenantPrisma.staff.create).toHaveBeenCalledWith({ data });
    });
    it('deve listar os profissionais do tenant com filtros opcionais', async () => {
        await repository.findAllByTenant('tenant-1', { role: 'doctor', status: 'active' });
        expect(tenantPrisma.staff.findMany).toHaveBeenCalledWith({
            where: {
                tenantId: 'tenant-1',
                role: 'doctor',
                status: 'active',
            },
            orderBy: [{ role: 'asc' }, { name: 'asc' }],
        });
    });
    it('deve criar convite com contexto do usuario que convidou', async () => {
        await repository.createInvitation({
            tenantId: 'tenant-1',
            email: 'ana@test.com',
            name: 'Dra. Ana',
            document: '12345678900',
            professionalType: 'doctor',
            specialty: 'clinica geral',
            role: 'doctor',
            invitedByUserId: 'actor-1',
            token: 'token-1',
            status: 'pending',
            expiresAt: new Date(),
        });
        expect(tenantScopedPrismaFactory.forTenantContext).toHaveBeenCalledWith({
            userId: 'actor-1',
            tenantId: 'tenant-1',
        });
        expect(tenantPrisma.staffInvitation.create).toHaveBeenCalled();
    });
    it('deve listar convites pendentes por tenant', async () => {
        await repository.findPendingInvitationsByTenant('tenant-1');
        expect(tenantPrisma.staffInvitation.findMany).toHaveBeenCalledWith({
            where: {
                tenantId: 'tenant-1',
                status: 'pending',
            },
            orderBy: { createdAt: 'desc' },
        });
    });
    it('deve buscar convite pelo token usando contexto root', async () => {
        await repository.findInvitationByToken('token-1');
        expect(tenantScopedPrismaFactory.forRoot).toHaveBeenCalled();
        expect(rootPrisma.staffInvitation.findFirst).toHaveBeenCalledWith({
            where: { token: 'token-1' },
        });
    });
    it('deve marcar convite como aceito dentro do tenant', async () => {
        await repository.acceptInvitation('token-1', 'user-1', 'tenant-1');
        expect(tenantPrisma.staffInvitation.updateMany).toHaveBeenCalledWith({
            where: { token: 'token-1', tenantId: 'tenant-1' },
            data: { status: 'accepted' },
        });
    });
    it('deve revogar convite dentro do tenant', async () => {
        jest.spyOn(repository, 'findInvitationById').mockResolvedValue({ id: 'invite-1', status: 'revoked' });
        await repository.revokeInvitation('invite-1', 'user-1', 'tenant-1');
        expect(tenantPrisma.staffInvitation.updateMany).toHaveBeenCalledWith({
            where: { id: 'invite-1', tenantId: 'tenant-1' },
            data: { status: 'revoked' },
        });
    });
    it('deve expirar convites pendentes vencidos', async () => {
        rootPrisma.staffInvitation.updateMany.mockResolvedValue({ count: 2 });
        const result = await repository.cleanupExpiredInvitations(new Date('2026-03-14T12:00:00Z'));
        expect(rootPrisma.staffInvitation.updateMany).toHaveBeenCalledWith({
            where: {
                status: 'pending',
                expiresAt: { lt: new Date('2026-03-14T12:00:00Z') },
            },
            data: {
                status: 'expired',
            },
        });
        expect(result).toBe(2);
    });
    it('deve listar logs de auditoria por tenant', async () => {
        await repository.findAuditLogsByTenant('tenant-1');
        expect(tenantPrisma.staffAuditLog.findMany).toHaveBeenCalledWith({
            where: { tenantId: 'tenant-1' },
            orderBy: { createdAt: 'desc' },
        });
    });
});
//# sourceMappingURL=staff.repository.spec.js.map