"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const supabase_guard_1 = require("../../auth/guards/supabase.guard");
const game_controller_1 = require("../../game/presentation/http/game.controller");
const get_player_stats_use_case_1 = require("../../game/application/use-cases/get-player-stats.use-case");
describe('GameController', () => {
    let controller;
    let getPlayerStatsUseCase;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [game_controller_1.GameController],
            providers: [
                {
                    provide: get_player_stats_use_case_1.GetPlayerStatsUseCase,
                    useValue: { execute: jest.fn() },
                },
            ],
        })
            .overrideGuard(supabase_guard_1.SupabaseGuard)
            .useValue({ canActivate: () => true })
            .compile();
        controller = module.get(game_controller_1.GameController);
        getPlayerStatsUseCase = module.get(get_player_stats_use_case_1.GetPlayerStatsUseCase);
    });
    it('getStats deve encaminhar o contexto do usuário para o use case', async () => {
        const mockUser = { userId: 'u1', tenantId: 't1' };
        await controller.getStats(mockUser);
        expect(getPlayerStatsUseCase.execute).toHaveBeenCalledWith(mockUser);
    });
});
//# sourceMappingURL=game.controller.spec.js.map