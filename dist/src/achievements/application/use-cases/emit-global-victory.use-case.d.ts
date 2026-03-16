import { AchievementsEventsPort } from '../ports/achievements-events.port';
export declare class EmitGlobalVictoryUseCase {
    private readonly eventsPort;
    constructor(eventsPort: AchievementsEventsPort);
    execute(input: {
        tenantId: string;
        message: string;
    }): Promise<void>;
}
