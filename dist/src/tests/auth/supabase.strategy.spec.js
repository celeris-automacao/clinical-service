"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_strategy_1 = require("../../auth/strategies/supabase.strategy");
describe('SupabaseStrategy', () => {
    let strategy;
    beforeEach(() => {
        process.env.SUPABASE_JWT_SECRET = 'test-secret';
        strategy = new supabase_strategy_1.SupabaseStrategy();
    });
    describe('validate', () => {
        it('deve extrair e retornar o contexto do usuário corretamente do payload JWT', async () => {
            const payload = {
                sub: 'user-uuid-123',
                email: 'paciente@teste.com',
                user_metadata: {
                    tenant_id: 'clinica-xyz',
                    role: 'patient'
                }
            };
            const result = await strategy.validate(payload);
            expect(result).toEqual({
                userId: 'user-uuid-123',
                tenantId: 'clinica-xyz',
                role: 'patient',
                email: 'paciente@teste.com'
            });
        });
        it('deve usar o fallback "patient" se a role não estiver no metadata', async () => {
            const payload = {
                sub: 'user-123',
                email: 'test@test.com',
                user_metadata: {}
            };
            const result = await strategy.validate(payload);
            expect(result.role).toBe('patient');
        });
    });
});
//# sourceMappingURL=supabase.strategy.spec.js.map