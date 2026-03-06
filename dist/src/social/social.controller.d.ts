import { SocialService } from './social.service';
import { UserContext } from '../common/decorators/get-user.decorator';
export declare class SocialController {
    private readonly socialService;
    constructor(socialService: SocialService);
    getFeed(user: UserContext): Promise<({
        patient: {
            name: string;
        };
    } & {
        id: string;
        tenantId: string;
        type: string;
        patientId: string;
        createdAt: Date;
        content: string;
    })[]>;
}
