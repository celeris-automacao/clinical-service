import { Test, TestingModule } from '@nestjs/testing';
import { SocialListener } from '../../social/social.listener';
import { SocialService } from '../../social/social.service';

describe('SocialListener', () => {
  let listener: SocialListener;
  let socialService: SocialService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialListener,
        {
          provide: SocialService,
          useValue: {
            createPost: jest.fn(),
          },
        },
      ],
    }).compile();

    listener = module.get<SocialListener>(SocialListener);
    socialService = module.get<SocialService>(SocialService);
  });

  it('deve criar um post automático quando um Boss for derrotado', async () => {
    const payload = {
      killerId: 'u1',
      tenantId: 't1',
      bossName: 'Dragão de Açúcar'
    };

    await listener.handleBossDefeated(payload);

    expect(socialService.createPost).toHaveBeenCalledWith(
      'u1',
      't1',
      expect.stringContaining('Dragão de Açúcar'),
      'boss_defeat'
    );
  });

  it('deve criar um post automático quando uma conquista for desbloqueada', async () => {
    const payload = {
      patientId: 'u2',
      tenantId: 't1',
      achievement: 'Maratonista'
    };

    await listener.handleAchievement(payload);

    expect(socialService.createPost).toHaveBeenCalledWith(
      'u2',
      't1',
      expect.stringContaining('Maratonista'),
      'achievement'
    );
  });
});