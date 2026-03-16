// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common'; // Adicione esta linha
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.setGlobalPrefix('v1');
  
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    transform: true,
    forbidNonWhitelisted: true, // Opcional: erro se enviarem campos que não existem no DTO
  }));

  const config = new DocumentBuilder()
    .setTitle('HealthQuest API')
    .setDescription('Documentação das rotas de Gamificação e Clínica')
    .setVersion('1.0')
    .addBearerAuth() // Habilita o campo de Token que você usa no Insomnia
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  // 3. Setup do endpoint da documentação
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
  console.log(`🚀 Clinical Service rodando em: http://localhost:3000`);
  console.log(`📚 Documentação disponível em: http://localhost:3000/api`);
}
bootstrap();