import { Test, TestingModule } from '@nestjs/testing';
import { SocialController } from '../../social/social.controller';
import { SocialService } from '../../social/social.service';
import { SupabaseGuard } from '../../auth/guards/supabase.guard';
import { UserContext } from '../../common/decorators/get-user.decorator';

describe('SocialController', () => {
  let controller: SocialController;
  let service: SocialService;

  const mockUser: UserContext = {
    userId: 'user-123',
    tenantId: 'tenant-456',
    role: 'patient'
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SocialController],
      providers: [
        {
          provide: SocialService,
          useValue: {
            getFeed: jest.fn().mockResolvedValue([{ id: '1', content: 'Post épico!' }]),
          },
        },
      ],
    })
      .overrideGuard(SupabaseGuard)
      .useValue({ canActivate: () => true }) // Bypass na segurança para teste unitário
      .compile();

    controller = module.get<SocialController>(SocialController);
    service = module.get<SocialService>(SocialService);
  });

  describe('getFeed', () => {
    it('deve chamar o service.getFeed com o tenantId do usuário logado', async () => {
      const result = await controller.getFeed(mockUser);

      // Garante que o controller não "inventa" dados e usa o contexto do JWT
      expect(service.getFeed).toHaveBeenCalledWith(mockUser.tenantId);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Post épico!');
    });
  });
});