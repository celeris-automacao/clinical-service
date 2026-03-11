import { SocialService } from './social.service';
import { UserContext } from '../common/decorators/get-user.decorator';
export declare class SocialController {
    private readonly socialService;
    constructor(socialService: SocialService);
    getFeed(user: UserContext): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        patientId: string;
        type: string;
        content: string;
    }[]>;
}
