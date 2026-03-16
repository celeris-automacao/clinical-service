"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const map_supabase_user_use_case_1 = require("../../auth/application/use-cases/map-supabase-user.use-case");
const auth_tokens_1 = require("../../auth/auth.tokens");
const supabase_strategy_1 = require("../../auth/strategies/supabase.strategy");
describe('SupabaseStrategy', () => {
    let strategy;
    let mapSupabaseUserUseCase;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                supabase_strategy_1.SupabaseStrategy,
                {
                    provide: map_supabase_user_use_case_1.MapSupabaseUserUseCase,
                    useValue: {
                        execute: jest.fn(),
                    },
                },
                {
                    provide: auth_tokens_1.AUTH_CONFIG_PORT,
                    useValue: {
                        getSupabaseJwtSecret: jest.fn().mockReturnValue('test-secret'),
                    },
                },
            ],
        }).compile();
        strategy = module.get(supabase_strategy_1.SupabaseStrategy);
        mapSupabaseUserUseCase = module.get(map_supabase_user_use_case_1.MapSupabaseUserUseCase);
    });
    it('deve delegar o payload JWT para o use case de mapeamento', async () => {
        const payload = {
            sub: 'user-uuid-123',
            email: 'paciente@teste.com',
            user_metadata: {
                tenant_id: 'clinica-xyz',
                role: 'patient',
            },
        };
        mapSupabaseUserUseCase.execute.mockResolvedValue({
            userId: 'user-uuid-123',
            tenantId: 'clinica-xyz',
            role: 'patient',
            email: 'paciente@teste.com',
        });
        const result = await strategy.validate(payload);
        expect(mapSupabaseUserUseCase.execute).toHaveBeenCalledWith(payload);
        expect(result).toEqual({
            userId: 'user-uuid-123',
            tenantId: 'clinica-xyz',
            role: 'patient',
            email: 'paciente@teste.com',
        });
    });
});
//# sourceMappingURL=supabase.strategy.spec.js.map