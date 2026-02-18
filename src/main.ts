import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import { json, urlencoded } from 'express';

async function bootstrap() {
  // Asegurar que existe el directorio de uploads
  const uploadDir = './uploads/garantias';
  if (!fs.existsSync(uploadDir)){
      fs.mkdirSync(uploadDir, { recursive: true });
  }

  const app = await NestFactory.create(AppModule);

  // Aumentar el límite de tamaño del cuerpo de la solicitud
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

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

  const server = await app.listen(process.env.PORT || 3000, '0.0.0.0');
  server.setTimeout(600000); // 10 minutos
}
bootstrap();
