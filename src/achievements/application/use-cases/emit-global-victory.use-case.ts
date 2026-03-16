import { Inject, Injectable } from '@nestjs/common';
import { ACHIEVEMENTS_EVENTS_PORT } from '../../achievements.tokens';
import { AchievementsEventsPort } from '../ports/achievements-events.port';

@Injectable()
export class EmitGlobalVictoryUseCase {
  constructor(
    @Inject(ACHIEVEMENTS_EVENTS_PORT)
    private readonly eventsPort: AchievementsEventsPort,
  ) {}

  async execute(input: { tenantId: string; message: string }) {
    await this.eventsPort.emitBossDefeatedGlobal({
      tenantId: input.tenantId,
      message: input.message,
      timestamp: new Date(),
    });
  }
}
