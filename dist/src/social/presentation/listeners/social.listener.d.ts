import { APPLICATION_EVENTS, ApplicationEventEnvelope } from '../../../shared/application/events/application-events';
import { CreateSocialPostUseCase } from '../../application/use-cases/create-social-post.use-case';
export declare class SocialListener {
    private readonly createSocialPostUseCase;
    constructor(createSocialPostUseCase: CreateSocialPostUseCase);
    handleBossDefeated(event: ApplicationEventEnvelope<typeof APPLICATION_EVENTS.bossDefeated>): Promise<void>;
    handleAchievement(event: ApplicationEventEnvelope<typeof APPLICATION_EVENTS.achievementUnlocked>): Promise<void>;
}
