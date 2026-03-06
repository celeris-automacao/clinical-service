import { ExecutionContext } from '@nestjs/common';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

// Função auxiliar para capturar o factory do decorador
function getParamDecoratorFactory(decorator: Function) {
  class Test {
    test(@decorator() value: any) {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Test, 'test');
  return args[Object.keys(args)[0]].factory;
}

describe('GetUser Decorator', () => {
  it('deve extrair o usuário do objeto request', () => {
    const factory = getParamDecoratorFactory(GetUser);
    const mockUser = { userId: '123', tenantId: '456', role: 'patient' };
    
    // Simula o contexto do NestJS
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: mockUser,
        }),
      }),
    } as ExecutionContext;

    const result = factory(null, mockContext);
    expect(result).toEqual(mockUser);
  });
});