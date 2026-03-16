import { AchievementsEventsPort } from '../ports/achievements-events.port';
export declare class EmitBossDefeatedUseCase {
    private readonly eventsPort;
    constructor(eventsPort: AchievementsEventsPort);
    execute(input: {
        tenantId: string;
        bossId: string;
        bossName: string;
        killerId: string;
    }): Promise<void>;
}
