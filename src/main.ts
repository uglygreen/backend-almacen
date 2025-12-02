import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Activar CORS (Para que Angular y la App Móvil se puedan conectar)
  app.enableCors();

  
  app.setGlobalPrefix('api');
  

  // 2. Activar Validación Global (DTOs)
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Elimina campos que no estén en el DTO
    forbidNonWhitelisted: true, // Lanza error si envían basura extra
    transform: true, // Convierte tipos (ej. string "1" a number 1)
  }));

  // 3. Configurar Swagger (Documentación Automática)
  const config = new DocumentBuilder()
    .setTitle('API Ferremayoristas')
    .setDescription('Sistema de gestión de almacén, pedidos y métricas')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}
bootstrap();
