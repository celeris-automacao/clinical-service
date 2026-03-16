import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  APPLICATION_EVENTS,
  ApplicationEventEnvelope,
} from '../../../shared/application/events/application-events';
import { NotificationsRepositoryPort } from '../../application/ports/notifications-repository.port';
import { NOTIFICATIONS_REPOSITORY } from '../../dashboard.tokens';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly repository: NotificationsRepositoryPort,
  ) {}

  @OnEvent(APPLICATION_EVENTS.achievementUnlocked)
  async handleAchievement(
    event: ApplicationEventEnvelope<typeof APPLICATION_EVENTS.achievementUnlocked>,
  ) {
    const payload = event.payload;
    await this.repository.createNotification({
      tenantId: payload.tenantId,
      userId: payload.patientId,
      title: 'NOVA CONQUISTA!',
      message: `Paciente ${payload.patientId} desbloqueou "${payload.achievement}"`,
      type: 'achievement',
    });
  }

  @OnEvent(APPLICATION_EVENTS.bossDefeated)
  async handleBossDefeated(
    event: ApplicationEventEnvelope<typeof APPLICATION_EVENTS.bossDefeated>,
  ) {
    const payload = event.payload;
    await this.repository.createNotification({
      tenantId: payload.tenantId,
      userId: payload.killerId,
      title: 'VITORIA EPICA!',
      message: `O Boss "${payload.bossName}" foi derrotado pelo paciente ${payload.killerId}!`,
      type: 'boss_defeat',
    });
  }
}
