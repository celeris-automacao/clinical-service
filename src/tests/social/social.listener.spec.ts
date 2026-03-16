import { Test, TestingModule } from '@nestjs/testing';
import {
  APPLICATION_EVENTS,
  createApplicationEvent,
} from '../../shared/application/events/application-events';
import { CreateSocialPostUseCase } from '../../social/application/use-cases/create-social-post.use-case';
import { SocialListener } from '../../social/presentation/listeners/social.listener';

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

  it('deve criar um post automatico quando um boss for derrotado', async () => {
    await listener.handleBossDefeated(
      createApplicationEvent(APPLICATION_EVENTS.bossDefeated, {
        killerId: 'u1',
        tenantId: 't1',
        bossId: 'boss-1',
        bossName: 'Dragao de Acucar',
      }),
    );

    expect(createSocialPostUseCase.execute).toHaveBeenCalledWith({
      patientId: 'u1',
      tenantId: 't1',
      content: expect.stringContaining('Dragao de Acucar'),
      type: 'boss_defeat',
    });
  });

  it('deve criar um post automatico quando uma conquista for desbloqueada', async () => {
    await listener.handleAchievement(
      createApplicationEvent(APPLICATION_EVENTS.achievementUnlocked, {
        patientId: 'u2',
        tenantId: 't1',
        achievement: 'Maratonista',
      }),
    );

    expect(createSocialPostUseCase.execute).toHaveBeenCalledWith({
      patientId: 'u2',
      tenantId: 't1',
      content: expect.stringContaining('Maratonista'),
      type: 'achievement',
    });
  });
});
