import { Test, TestingModule } from '@nestjs/testing';
import { SocialRepository } from '../../social/infrastructure/persistence/prisma-social.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('SocialRepository', () => {
  let repository: SocialRepository;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialRepository,
        {
          provide: PrismaService,
          useValue: {
            socialPost: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    repository = module.get<SocialRepository>(SocialRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('findFeedByTenant', () => {
    it('deve chamar prisma.socialPost.findMany com os filtros e ordenação corretos', async () => {
      const tenantId = 'tenant-123';
      const limit = 10;

      await repository.findFeedByTenant(tenantId, limit);

      // Valida se a query enviada ao banco respeita o isolamento e a ordem cronológica
      expect(prisma.socialPost.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        include: {
          patient: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    });

    it('deve usar o limite padrão de 20 postagens se o parâmetro for omitido', async () => {
      const tenantId = 'tenant-123';

      await repository.findFeedByTenant(tenantId);

      expect(prisma.socialPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
        })
      );
    });
  });

  describe('createPost', () => {
    it('deve chamar prisma.socialPost.create com os dados mapeados corretamente', async () => {
      const postData = {
        patientId: 'u1',
        tenantId: 't1',
        content: 'Novo Recorde Alcançado!',
        type: 'achievement'
      };

      await repository.createPost(postData);

      expect(prisma.socialPost.create).toHaveBeenCalledWith({
        data: postData,
      });
    });
  });
});
