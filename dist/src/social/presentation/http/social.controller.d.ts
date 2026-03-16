import { UserContext } from '../../../shared/auth/user-context';
import { GetFeedUseCase } from '../../application/use-cases/get-feed.use-case';
export declare class SocialController {
    private readonly getFeedUseCase;
    constructor(getFeedUseCase: GetFeedUseCase);
    getFeed(user: UserContext): Promise<any[]>;
}
