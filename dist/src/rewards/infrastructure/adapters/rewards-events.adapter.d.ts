import { ApplicationEventBusPort } from '../../../shared/application/ports/application-event-bus.port';
import { RewardsEventsPort } from '../../application/ports/rewards-events.port';
export declare class RewardsEventsAdapter implements RewardsEventsPort {
    private readonly eventBus;
    constructor(eventBus: ApplicationEventBusPort);
    emitRewardClaimed(input: {
        userId: string;
        tenantId: string;
        achievement: string;
    }): Promise<void>;
}
