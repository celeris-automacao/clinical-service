"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const social_service_1 = require("../../social/social.service");
describe('SocialService', () => {
    let service;
    let repository;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                social_service_1.SocialService,
                {
                    provide: 'ISocialRepository',
                    useValue: {
                        findFeedByTenant: jest.fn(),
                        createPost: jest.fn(),
                    },
                },
            ],
        }).compile();
        service = module.get(social_service_1.SocialService);
        repository = module.get('ISocialRepository');
    });
    describe('getFeed', () => {
        it('deve buscar o feed chamando o repositório com o tenantId correto', async () => {
            const tenantId = 'tenant-123';
            const mockPosts = [{ id: '1', content: 'Post teste', patient: { name: 'João' } }];
            repository.findFeedByTenant.mockResolvedValue(mockPosts);
            const result = await service.getFeed(tenantId);
            expect(repository.findFeedByTenant).toHaveBeenCalledWith(tenantId, 20);
            expect(result).toEqual(mockPosts);
        });
    });
    describe('createPost', () => {
        it('deve encaminhar os dados de postagem para o repositório', async () => {
            const postData = {
                patientId: 'u1',
                tenantId: 't1',
                content: 'Missão Cumprida!',
                type: 'task_completion'
            };
            await service.createPost(postData.patientId, postData.tenantId, postData.content, postData.type);
            expect(repository.createPost).toHaveBeenCalledWith(postData);
        });
    });
});
//# sourceMappingURL=social.service.spec.js.map