import { Test, TestingModule } from '@nestjs/testing';
import { SocialListener } from '../../social/social.listener';
import { CreateSocialPostUseCase } from '../../social/application/use-cases/create-social-post.use-case';

describe('SocialListener', () => {
  let listener: SocialListener;
  let createSocialPostUseCase: CreateSocialPostUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialListener,
        {
          provide: CreateSocialPostUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    listener = module.get<SocialListener>(SocialListener);
    createSocialPostUseCase = module.get<CreateSocialPostUseCase>(CreateSocialPostUseCase);
  });

  it('deve criar um post automático quando um Boss for derrotado', async () => {
    const payload = {
      killerId: 'u1',
      tenantId: 't1',
      bossName: 'Dragão de Açúcar',
    };

    await listener.handleBossDefeated(payload);

    expect(createSocialPostUseCase.execute).toHaveBeenCalledWith({
      patientId: 'u1',
      tenantId: 't1',
      content: expect.stringContaining('Dragão de Açúcar'),
      type: 'boss_defeat',
    });
  });

  it('deve criar um post automático quando uma conquista for desbloqueada', async () => {
    const payload = {
      patientId: 'u2',
      tenantId: 't1',
      achievement: 'Maratonista',
    };

    await listener.handleAchievement(payload);

    expect(createSocialPostUseCase.execute).toHaveBeenCalledWith({
      patientId: 'u2',
      tenantId: 't1',
      content: expect.stringContaining('Maratonista'),
      type: 'achievement',
    });
  });
});
