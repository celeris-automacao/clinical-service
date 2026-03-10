"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const legacy_auth_guard_1 = require("../../../common/guards/legacy-auth.guard");
describe('LegacyAuthGuard', () => {
    let guard;
    beforeEach(() => {
        guard = new legacy_auth_guard_1.AuthGuard();
    });
    it('deve permitir acesso se os headers estiverem presentes (Linhas 20-22)', () => {
        const mockRequest = {
            headers: { 'x-tenant-id': 't1', 'x-user-id': 'u1' }
        };
        const context = {
            switchToHttp: () => ({ getRequest: () => mockRequest })
        };
        expect(guard.canActivate(context)).toBe(true);
        expect(mockRequest['user']).toBeDefined();
    });
    it('deve lançar UnauthorizedException se faltar o tenantId (Linhas 10-12)', () => {
        const mockRequest = { headers: { 'x-user-id': 'u1' } };
        const context = {
            switchToHttp: () => ({ getRequest: () => mockRequest })
        };
        expect(() => guard.canActivate(context)).toThrow(common_1.UnauthorizedException);
    });
});
//# sourceMappingURL=legacy-auth.guard.spec.js.map