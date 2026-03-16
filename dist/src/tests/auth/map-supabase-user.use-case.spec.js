"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const map_supabase_user_use_case_1 = require("../../auth/application/use-cases/map-supabase-user.use-case");
describe('MapSupabaseUserUseCase', () => {
    let useCase;
    let getStaffMemberByUserIdUseCase;
    beforeEach(() => {
        getStaffMemberByUserIdUseCase = {
            execute: jest.fn().mockResolvedValue(null),
        };
        useCase = new map_supabase_user_use_case_1.MapSupabaseUserUseCase(getStaffMemberByUserIdUseCase);
    });
    it('deve extrair e retornar o contexto do usuario corretamente do payload JWT', async () => {
        const payload = {
            sub: 'user-uuid-123',
            email: 'paciente@teste.com',
            user_metadata: {
                tenant_id: 'clinica-xyz',
                role: 'patient',
            },
        };
        const result = await useCase.execute(payload);
        expect(result).toEqual({
            userId: 'user-uuid-123',
            tenantId: 'clinica-xyz',
            role: 'patient',
            staffId: undefined,
            email: 'paciente@teste.com',
        });
    });
    it('deve usar o role do staff ativo quando houver cadastro do profissional', async () => {
        getStaffMemberByUserIdUseCase.execute.mockResolvedValue({
            id: 'staff-1',
            role: 'admin',
            status: 'active',
        });
        const result = await useCase.execute({
            sub: 'user-123',
            email: 'staff@test.com',
            user_metadata: {
                tenant_id: 'tenant-1',
            },
        });
        expect(result.role).toBe('admin');
        expect(result.staffId).toBe('staff-1');
    });
    it('deve usar o fallback patient se a role nao estiver no metadata', async () => {
        const payload = {
            sub: 'user-123',
            email: 'test@test.com',
            user_metadata: {
                tenant_id: 'tenant-1',
            },
        };
        const result = await useCase.execute(payload);
        expect(result.role).toBe('patient');
    });
    it('deve rejeitar staff inativo', async () => {
        getStaffMemberByUserIdUseCase.execute.mockResolvedValue({
            id: 'staff-1',
            role: 'doctor',
            status: 'inactive',
        });
        await expect(useCase.execute({
            sub: 'user-123',
            user_metadata: {
                tenant_id: 'tenant-1',
            },
        })).rejects.toThrow(common_1.UnauthorizedException);
    });
    it('deve rejeitar JWT sem tenant', async () => {
        await expect(useCase.execute({
            sub: 'user-123',
            user_metadata: {},
        })).rejects.toThrow(common_1.UnauthorizedException);
    });
});
//# sourceMappingURL=map-supabase-user.use-case.spec.js.map