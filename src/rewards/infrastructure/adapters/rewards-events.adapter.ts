import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RewardsEventsPort } from '../../application/ports/rewards-events.port';

@Injectable()
export class RewardsEventsAdapter implements RewardsEventsPort {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async emitRewardClaimed(input: {
    userId: string;
    tenantId: string;
    achievement: string;
  }): Promise<void> {
    this.eventEmitter.emit('achievement.unlocked', input);
  }
}
