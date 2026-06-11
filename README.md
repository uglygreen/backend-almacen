# Backend Almacén - Ferremayoristas

Sistema backend desarrollado en **NestJS** para la gestión operativa del almacén, con un enfoque principal en el módulo de **Garantías (RMA)**, seguimiento logístico y conexión con bases de datos heredadas (Legacy).

## 🏗 Arquitectura

El proyecto sigue una arquitectura modular basada en los principios de NestJS:

- **Framework**: NestJS (Node.js).
- **Base de Datos**: MySQL manejado con **TypeORM**.
  - **Conexión Default**: Base de datos nueva (`sistemas`) para gestión de garantías, historial y media.
  - **Conexión Legacy**: Conexión de solo lectura a la base de datos administrativa (`datosb`) para consultar Clientes, Productos, Facturas y Personal.
- **Tiempo Real**: WebSockets con `Socket.io` para notificaciones instantáneas de cambios de estatus.
- **Documentación**: Swagger UI (OpenAPI) disponible en `/docs`.
- **Empaquetado**: Compilación a binario único usando `ncc` y `pkg` para facilitar el despliegue sin dependencias externas en el servidor.

## 📦 Módulos Principales

### 1. Garantías
Gestión completa del ciclo de vida de una garantía:
- Registro de garantías vinculado a facturas y productos.
- Flujo de estatus (`PENDIENTE`, `RECOLECCION`, `ALMACEN`, `DIAGNOSTICO`, etc.).
- Historial de cambios de estatus (Bitácora).
- Carga de evidencias multimedia (Fotos/Videos).
- Asignación de logística (Choferes de recolección/entrega).

### 2. Integraciones
- **WhatsappService**: Notificaciones automáticas a clientes sobre el estado de su garantía.
- **Legacy DB**: Consultas cruzadas para validar facturas y existencias en el sistema anterior.

## 🚀 Despliegue a Producción

El proyecto utiliza una estrategia de "Single Binary" para simplificar la ejecución en el servidor Linux de producción, eliminando la necesidad de instalar `node_modules` en el servidor destino.

> **Recomendacion actual**: para integraciones que dependen de carga dinamica de modulos, como `firebase-admin`, conviene usar despliegue con Docker y `node dist/main.js` en lugar de `pkg`. La guia esta en [docs/docker-deployment.md](file:///c:/Proyectos/ferremayoristas/backend/almacen/backend-almacen/docs/docker-deployment.md).

### Prerrequisitos de Compilación
Tener instaladas las herramientas globales o usar `npx`:
- `@vercel/ncc`
- `pkg`

### Pasos para Generar el Ejecutable

1. **Transpilación de TypeScript a JS**:
   Genera la carpeta `dist` con el código compilado.
   ```bash
   npm run build
   ```

2. **Empaquetado en un solo archivo (Bundling)**:
   Usa `ncc` para unir todas las dependencias de `dist/main.js` en un solo archivo `build/index.js`.
   ```bash
   npx ncc build dist/main.js -o build
   ```

3. **Generación del Binario (Ejecutable)**:
   Usa `pkg` para crear el ejecutable final para Linux x64 (Node 18).
   ```bash
   pkg build/index.js --targets node18-linux-x64 --output backend-almacen
   ```

### Ejecución en Servidor

1. Subir el archivo generado `backend-almacen` al servidor Linux.
2. Asignar permisos de ejecución:
   ```bash
   chmod +x backend-almacen
   ```
3. **Certificados SSL**: El servicio buscará automáticamente los certificados en las siguientes rutas para habilitar HTTPS:
   - Clave: `/etc/apache2/ssl/ferremayoristas.key`
   - Certificado: `/etc/apache2/ssl/86cfeec44800f120.crt`
   - Bundle CA: `/etc/apache2/ssl/gd_bundle-g2.crt`
   
   *Si no se encuentran, el servicio iniciará en modo HTTP.*

4. Ejecutar el servicio:
   ```bash
   ./backend-almacen
   ```

> **Nota sobre Swagger**: Debido a que `pkg` no incluye activos estáticos, Swagger está configurado en `main.ts` para cargar sus estilos y scripts desde un CDN (Cloudflare), asegurando que la documentación funcione correctamente en producción.

### Opcion recomendada: Docker + Node 22.11.0

El repositorio ya incluye:

- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`

Levantamiento rapido:

```bash
docker compose build
docker compose up -d
```

Por defecto el backend queda en `http://localhost:3005` y el JSON de Firebase se monta como:

```text
/app/secrets/firebase-service-account.json
```

Consulta la guia completa en [docs/docker-deployment.md](file:///c:/Proyectos/ferremayoristas/backend/almacen/backend-almacen/docs/docker-deployment.md).

## 🛠 Configuración Local

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Configurar variables de entorno en un archivo `.env` en la raíz.
3. Ejecutar en modo desarrollo:
   ```bash
   npm run start:dev
   ```

## 📂 Estructura de Carpetas Clave

- `src/garantias`: Lógica del módulo de garantías (Controlador, Servicio, DTOs).
- `src/entities`: Definiciones de tablas (TypeORM) para ambas bases de datos.
- `src/events`: Gateway de WebSockets.
- `uploads/garantias`: Directorio donde se almacenan localmente las evidencias subidas.
