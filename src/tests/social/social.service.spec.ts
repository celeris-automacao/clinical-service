import { Test, TestingModule } from '@nestjs/testing';
import { SocialService } from '../../social/social.service';
import { ISocialRepository } from '../../social/repositories/interfaces/social.repository.interface';

describe('SocialService', () => {
  let service: SocialService;
  let repository: ISocialRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialService,
        {
          provide: 'ISocialRepository',
          useValue: {
            findFeedByTenant: jest.fn(),
            createPost: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SocialService>(SocialService);
    repository = module.get<ISocialRepository>('ISocialRepository');
  });

  describe('getFeed', () => {
    it('deve buscar o feed chamando o repositório com o tenantId correto', async () => {
      const tenantId = 'tenant-123';
      const mockPosts = [{ id: '1', content: 'Post teste', patient: { name: 'João' } }];
      
      (repository.findFeedByTenant as jest.Mock).mockResolvedValue(mockPosts);

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