"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const create_social_post_use_case_1 = require("../../social/application/use-cases/create-social-post.use-case");
const get_feed_use_case_1 = require("../../social/application/use-cases/get-feed.use-case");
const social_tokens_1 = require("../../social/social.tokens");
describe('Social Use Cases', () => {
    let repository;
    let getFeedUseCase;
    let createSocialPostUseCase;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                get_feed_use_case_1.GetFeedUseCase,
                create_social_post_use_case_1.CreateSocialPostUseCase,
                {
                    provide: social_tokens_1.SOCIAL_REPOSITORY,
                    useValue: {
                        findFeedByTenant: jest.fn(),
                        createPost: jest.fn(),
                    },
                },
            ],
        }).compile();
        repository = module.get(social_tokens_1.SOCIAL_REPOSITORY);
        getFeedUseCase = module.get(get_feed_use_case_1.GetFeedUseCase);
        createSocialPostUseCase = module.get(create_social_post_use_case_1.CreateSocialPostUseCase);
    });
    it('deve buscar o feed chamando o repositório com o tenantId correto', async () => {
        const tenantId = 'tenant-123';
        const mockPosts = [{ id: '1', content: 'Post teste', patient: { name: 'João' } }];
        repository.findFeedByTenant.mockResolvedValue(mockPosts);
        const result = await getFeedUseCase.execute(tenantId);
        expect(repository.findFeedByTenant).toHaveBeenCalledWith(tenantId, 20);
        expect(result).toEqual(mockPosts);
    });
    it('deve encaminhar os dados de postagem para o repositório', async () => {
        const postData = {
            patientId: 'u1',
            tenantId: 't1',
            content: 'Missão Cumprida!',
            type: 'task_completion',
        };
        await createSocialPostUseCase.execute(postData);
        expect(repository.createPost).toHaveBeenCalledWith(postData);
    });
});
//# sourceMappingURL=social.use-cases.spec.js.map