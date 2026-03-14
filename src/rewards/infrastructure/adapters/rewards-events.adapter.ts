import { Inject, Injectable } from '@nestjs/common';
import { RewardsEventsPort } from '../../application/ports/rewards-events.port';
import { ApplicationEventBusPort } from '../../../shared/application/ports/application-event-bus.port';
import { APPLICATION_EVENT_BUS } from '../../../shared/shared.tokens';

@Injectable()
export class RewardsEventsAdapter implements RewardsEventsPort {
  constructor(
    @Inject(APPLICATION_EVENT_BUS)
    private readonly eventBus: ApplicationEventBusPort,
  ) {}

  async emitRewardClaimed(input: {
    userId: string;
    tenantId: string;
    achievement: string;
  }): Promise<void> {
    this.eventBus.emit('achievement.unlocked', input);
  }
}
