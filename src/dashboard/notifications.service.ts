// src/dashboard/notifications.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsRepository } from './repositories/notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject('INotificationsRepository') // <--- ADICIONE ESTA LINHA
    private readonly repository: NotificationsRepository
  ) { }

  @OnEvent('achievement.unlocked')
  async handleAchievement(payload: any) {
    const title = '🏆 NOVA CONQUISTA!';
    const message = `Paciente ${payload.patientId} desbloqueou "${payload.achievement}"`;

    // Delegamos a persistência ao repositório
    await this.repository.createNotification({
      tenantId: payload.tenantId,
      userId: payload.patientId,
      title,
      message,
      type: 'achievement'
    });

    console.log(`[Notification System] ${title}: ${message}`);
  }

  @OnEvent('boss.defeated')
  async handleBossDefeated(payload: any) {
    const title = '📢 VITÓRIA ÉPICA!';
    const message = `O Boss "${payload.bossName}" foi derrotado pelo paciente ${payload.killerId}!`;

    await this.repository.createNotification({
      tenantId: payload.tenantId,
      userId: payload.killerId,
      title,
      message,
      type: 'boss_defeat'
    });

    console.log('\n' + '='.repeat(40));
    console.log(title);
    console.log(`🏥 Clínica: ${payload.tenantId}`);
    console.log(`⚔️ ${message}`);
    console.log('='.repeat(40) + '\n');
  }
}