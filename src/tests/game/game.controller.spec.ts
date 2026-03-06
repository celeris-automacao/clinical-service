// src/tests/game/player.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { GameController } from '../../game/game.controller';
import { GameService } from '../../game/game.service';
import { SupabaseGuard } from '../../auth/guards/supabase.guard';

describe('GameController', () => {
  let controller: GameController;
  let service: GameService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GameController],
      providers: [
        {
          provide: GameService,
          useValue: { getPlayerStats: jest.fn() },
        },
      ],
    })
      .overrideGuard(SupabaseGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<GameController>(GameController);
    service = module.get<GameService>(GameService);
  });

  it('getStats deve encaminhar o contexto do usuário para o serviço', async () => {
    const mockUser = { userId: 'u1', tenantId: 't1' };
    await controller.getStats(mockUser as any);
    expect(service.getPlayerStats).toHaveBeenCalledWith(mockUser);
  });
});