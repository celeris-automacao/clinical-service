import { SocialService } from './social.service';
export declare class SocialListener {
    private readonly socialService;
    constructor(socialService: SocialService);
    handleBossDefeated(payload: any): Promise<void>;
    handleAchievement(payload: any): Promise<void>;
}
