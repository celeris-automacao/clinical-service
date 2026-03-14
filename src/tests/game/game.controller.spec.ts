import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseGuard } from '../../auth/guards/supabase.guard';
import { GameController } from '../../game/presentation/http/game.controller';
import { GetPlayerStatsUseCase } from '../../game/application/use-cases/get-player-stats.use-case';

describe('GameController', () => {
  let controller: GameController;
  let getPlayerStatsUseCase: GetPlayerStatsUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GameController],
      providers: [
        {
          provide: GetPlayerStatsUseCase,
          useValue: { execute: jest.fn() },
        },
      ],
    })
      .overrideGuard(SupabaseGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<GameController>(GameController);
    getPlayerStatsUseCase = module.get<GetPlayerStatsUseCase>(GetPlayerStatsUseCase);
  });

  it('getStats deve encaminhar o contexto do usuário para o use case', async () => {
    const mockUser = { userId: 'u1', tenantId: 't1' };
    await controller.getStats(mockUser as any);
    expect(getPlayerStatsUseCase.execute).toHaveBeenCalledWith(mockUser);
  });
});
