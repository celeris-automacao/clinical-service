import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  APPLICATION_EVENTS,
  ApplicationEventEnvelope,
} from '../../../shared/application/events/application-events';
import { CreateSocialPostUseCase } from '../../application/use-cases/create-social-post.use-case';

@Injectable()
export class SocialListener {
  constructor(private readonly createSocialPostUseCase: CreateSocialPostUseCase) {}

  @OnEvent(APPLICATION_EVENTS.bossDefeated)
  async handleBossDefeated(
    event: ApplicationEventEnvelope<typeof APPLICATION_EVENTS.bossDefeated>,
  ) {
    const payload = event.payload;
    await this.createSocialPostUseCase.execute({
      patientId: payload.killerId,
      tenantId: payload.tenantId,
      content: `O Boss ${payload.bossName} foi derrotado! Vitoria epica para a clinica!`,
      type: 'boss_defeat',
    });
  }

  @OnEvent(APPLICATION_EVENTS.achievementUnlocked)
  async handleAchievement(
    event: ApplicationEventEnvelope<typeof APPLICATION_EVENTS.achievementUnlocked>,
  ) {
    const payload = event.payload;
    await this.createSocialPostUseCase.execute({
      patientId: payload.patientId,
      tenantId: payload.tenantId,
      content: `Desbloqueou a conquista: ${payload.achievement}!`,
      type: 'achievement',
    });
  }
}
