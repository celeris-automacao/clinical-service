import { Test, TestingModule } from '@nestjs/testing';
import { RecordsController } from '../../records/records.controller';
import { RecordsService } from '../../records/records.service';
import { SupabaseGuard } from '../../auth/guards/supabase.guard';
import { UserContext } from '../../common/decorators/get-user.decorator';

describe('RecordsController', () => {
  let controller: RecordsController;
  let service: RecordsService;

  const mockUser: UserContext = {
    userId: 'user-uuid',
    tenantId: 'tenant-uuid',
    role: 'patient',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecordsController],
      providers: [
        {
          provide: RecordsService,
          useValue: {
            createRecord: jest.fn().mockResolvedValue({ id: '1', weight: 80 }),
            getEvolution: jest.fn().mockResolvedValue([]),
            getStats: jest.fn().mockResolvedValue({ totalDamage: 0 }),
          },
        },
      ],
    })
      .overrideGuard(SupabaseGuard)
      .useValue({ canActivate: () => true }) // Simula que o usuário está logado
      .compile();

    controller = module.get<RecordsController>(RecordsController);
    service = module.get<RecordsService>(RecordsService);
  });

  it('deve chamar o service com os dados corretos ao criar um registro', async () => {
    const dto = { weight: 85.5, skeletal_muscle_mass: 35 };
    
    await controller.createRecord(dto, mockUser);

    expect(service.createRecord).toHaveBeenCalledWith(dto, mockUser);
  });

  it('deve retornar o histórico de evolução do paciente', async () => {
    const result = await controller.getEvolution(mockUser);
    
    expect(service.getEvolution).toHaveBeenCalledWith(mockUser);
    expect(Array.isArray(result)).toBe(true);
  });
});