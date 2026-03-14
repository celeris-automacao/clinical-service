import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CreateSocialPostUseCase } from './application/use-cases/create-social-post.use-case';

@Injectable()
export class SocialListener {
  constructor(private readonly createSocialPostUseCase: CreateSocialPostUseCase) {}

  @OnEvent('boss.defeated')
  async handleBossDefeated(payload: any) {
    await this.createSocialPostUseCase.execute({
      patientId: payload.killerId,
      tenantId: payload.tenantId,
      content: `⚔️ O Boss ${payload.bossName} foi derrotado! Vitória épica para a clínica!`,
      type: 'boss_defeat',
    });
  }

  @OnEvent('achievement.unlocked')
  async handleAchievement(payload: any) {
    await this.createSocialPostUseCase.execute({
      patientId: payload.patientId,
      tenantId: payload.tenantId,
      content: `🏆 Desbloqueou a conquista: ${payload.achievement}!`,
      type: 'achievement',
    });
  }
}
