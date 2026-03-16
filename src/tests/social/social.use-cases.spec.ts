import { Test, TestingModule } from '@nestjs/testing';
import { CreateSocialPostUseCase } from '../../social/application/use-cases/create-social-post.use-case';
import { SocialRepositoryPort } from '../../social/application/ports/social-repository.port';
import { GetFeedUseCase } from '../../social/application/use-cases/get-feed.use-case';
import { SOCIAL_REPOSITORY } from '../../social/social.tokens';

describe('Social Use Cases', () => {
  let repository: SocialRepositoryPort;
  let getFeedUseCase: GetFeedUseCase;
  let createSocialPostUseCase: CreateSocialPostUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetFeedUseCase,
        CreateSocialPostUseCase,
        {
          provide: SOCIAL_REPOSITORY,
          useValue: {
            findFeedByTenant: jest.fn(),
            createPost: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<SocialRepositoryPort>(SOCIAL_REPOSITORY);
    getFeedUseCase = module.get<GetFeedUseCase>(GetFeedUseCase);
    createSocialPostUseCase = module.get<CreateSocialPostUseCase>(CreateSocialPostUseCase);
  });

  it('deve buscar o feed chamando o repositório com o tenantId correto', async () => {
    const tenantId = 'tenant-123';
    const mockPosts = [{ id: '1', content: 'Post teste', patient: { name: 'João' } }];

    (repository.findFeedByTenant as jest.Mock).mockResolvedValue(mockPosts);

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
