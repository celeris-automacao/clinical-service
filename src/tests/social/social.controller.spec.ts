import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseGuard } from '../../auth/guards/supabase.guard';
import { UserContext } from '../../shared/auth/user-context';
import { SocialController } from '../../social/presentation/http/social.controller';
import { GetFeedUseCase } from '../../social/application/use-cases/get-feed.use-case';

describe('SocialController', () => {
  let controller: SocialController;
  let getFeedUseCase: GetFeedUseCase;

  const mockUser: UserContext = {
    userId: 'user-123',
    tenantId: 'tenant-456',
    role: 'patient',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SocialController],
      providers: [
        {
          provide: GetFeedUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue([{ id: '1', content: 'Post épico!' }]),
          },
        },
      ],
    })
      .overrideGuard(SupabaseGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SocialController>(SocialController);
    getFeedUseCase = module.get<GetFeedUseCase>(GetFeedUseCase);
  });

  it('deve chamar o use case com o tenantId do usuário logado', async () => {
    const result = await controller.getFeed(mockUser);

    expect(getFeedUseCase.execute).toHaveBeenCalledWith(mockUser.tenantId);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Post épico!');
  });
});
