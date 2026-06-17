import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { json, urlencoded } from 'express';
import * as crypto from 'crypto';
import { envBoolean, envString, loadRuntimeEnv } from './config/runtime-env';

// Polyfill para crypto en versiones antiguas de Node.js
if (!(global as any).crypto) {
  Object.defineProperty(global, 'crypto', {
    value: crypto,
    writable: true,
  });
}

async function bootstrap() {
  loadRuntimeEnv();
  process.env.TZ = envString('APP_TIMEZONE', process.env.TZ || 'Etc/GMT+6');
  const nodeEnv = envString('NODE_ENV', 'development');
  const swaggerEnabled = envBoolean('SWAGGER_ENABLED', nodeEnv !== 'production');
  const { AppModule } = require('./app.module');

  // Asegurar que existe el directorio de uploads
  const uploadsRoot = envString('UPLOADS_ROOT', path.join(process.cwd(), 'uploads'));
  const uploadDir = path.join(uploadsRoot, 'garantias');
  if (!fs.existsSync(uploadDir)){
      fs.mkdirSync(uploadDir, { recursive: true });
  }

  let httpsOptions: any = null;
  try {
    const keyPath = envString('SSL_KEY_PATH', '/etc/apache2/ssl/ferremayoristas.key');
    const certPath = envString('SSL_CERT_PATH', '/etc/apache2/ssl/86cfeec44800f120.crt');
    const caPath = envString('SSL_CA_PATH', '/etc/apache2/ssl/gd_bundle-g2.crt');
    const useHttps = envBoolean('SSL_ENABLED', true);

    // Verificar si existen los archivos antes de leerlos (evita error en local/Windows)
    if (useHttps && fs.existsSync(keyPath) && fs.existsSync(certPath) && fs.existsSync(caPath)) {
      httpsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
        ca: fs.readFileSync(caPath),
      };
      console.log('🔒 Certificados SSL cargados correctamente. Iniciando HTTPS.');
    } else {
      console.log('⚠️ No se encontraron certificados SSL en las rutas especificadas. Iniciando HTTP.');
    }
  } catch (error) {
    console.error('⚠️ Error al intentar cargar certificados SSL:', error.message);
  }

  const app = await NestFactory.create(AppModule, {
    httpsOptions,
  });

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
  if (swaggerEnabled) {
    console.log('Iniciando generación de Swagger...');
    const config = new DocumentBuilder()
      .setTitle('API Ferremayoristas')
      .setDescription('Sistema de gestión de almacén, pedidos y métricas')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      useGlobalPrefix: true,
      // Fix para pkg/ncc: Cargar assets desde CDN porque no se empaquetan los estáticos
      customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
      customJs: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.js',
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.js',
      ],
    });
    console.log('Swagger configurado correctamente en /api/docs');
  } else {
    console.log('Swagger deshabilitado para este entorno.');
  }

  console.log(`Iniciando servidor HTTP${httpsOptions ? 'S' : ''} en el puerto ${envString('PORT', '3005')}...`);
  const server = await app.listen(envString('PORT', '3005'), '0.0.0.0');
  server.setTimeout(600000); // 10 minutos
  console.log(`Servidor iniciado correctamente en el puerto ${envString('PORT', '3005')}.`);
}
bootstrap().catch((error) => {
  console.error('Error fatal al iniciar el backend:', error);
  process.exit(1);
});
