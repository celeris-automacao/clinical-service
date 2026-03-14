import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { INotificationsRepository } from './repositories/interfaces/notifications.repository.interface';
import { NOTIFICATIONS_REPOSITORY } from './dashboard.tokens';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly repository: INotificationsRepository,
  ) {}

  @OnEvent('achievement.unlocked')
  async handleAchievement(payload: any) {
    const title = '🏆 NOVA CONQUISTA!';
    const message = `Paciente ${payload.patientId} desbloqueou "${payload.achievement}"`;

    await this.repository.createNotification({
      tenantId: payload.tenantId,
      userId: payload.patientId,
      title,
      message,
      type: 'achievement',
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
      type: 'boss_defeat',
    });

    console.log('\n' + '='.repeat(40));
    console.log(title);
    console.log(`🏥 Clínica: ${payload.tenantId}`);
    console.log(`⚔️ ${message}`);
    console.log('='.repeat(40) + '\n');
  }
}
