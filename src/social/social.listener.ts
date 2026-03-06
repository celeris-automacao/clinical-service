// src/social/social.listener.ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SocialService } from './social.service';

@Injectable()
export class SocialListener {
  constructor(private readonly socialService: SocialService) {}

  @OnEvent('boss.defeated')
  async handleBossDefeated(payload: any) {
    await this.socialService.createPost(
      payload.killerId,
      payload.tenantId,
      `⚔️ O Boss ${payload.bossName} foi derrotado! Vitória épica para a clínica!`,
      'boss_defeat'
    );
  }

  @OnEvent('achievement.unlocked')
  async handleAchievement(payload: any) {
    await this.socialService.createPost(
      payload.patientId,
      payload.tenantId,
      `🏆 Desbloqueou a conquista: ${payload.achievement}!`,
      'achievement'
    );
  }
}