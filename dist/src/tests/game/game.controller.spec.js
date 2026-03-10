"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const game_controller_1 = require("../../game/game.controller");
const game_service_1 = require("../../game/game.service");
const supabase_guard_1 = require("../../auth/guards/supabase.guard");
describe('GameController', () => {
    let controller;
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [game_controller_1.GameController],
            providers: [
                {
                    provide: game_service_1.GameService,
                    useValue: { getPlayerStats: jest.fn() },
                },
            ],
        })
            .overrideGuard(supabase_guard_1.SupabaseGuard).useValue({ canActivate: () => true })
            .compile();
        controller = module.get(game_controller_1.GameController);
        service = module.get(game_service_1.GameService);
    });
    it('getStats deve encaminhar o contexto do usuário para o serviço', async () => {
        const mockUser = { userId: 'u1', tenantId: 't1' };
        await controller.getStats(mockUser);
        expect(service.getPlayerStats).toHaveBeenCalledWith(mockUser);
    });
});
//# sourceMappingURL=game.controller.spec.js.map