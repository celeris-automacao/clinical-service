import { Inject, Injectable } from '@nestjs/common';
import {
  APPLICATION_EVENTS,
  createApplicationEvent,
} from '../../../shared/application/events/application-events';
import { ApplicationEventBusPort } from '../../../shared/application/ports/application-event-bus.port';
import { APPLICATION_EVENT_BUS } from '../../../shared/shared.tokens';
import { RewardsEventsPort } from '../../application/ports/rewards-events.port';

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
    this.eventBus.publish(
      createApplicationEvent(APPLICATION_EVENTS.rewardClaimed, {
        userId: input.userId,
        tenantId: input.tenantId,
        rewardTitle: input.achievement,
      }),
    );
  }
}
