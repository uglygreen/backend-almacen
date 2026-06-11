# Despliegue Docker

Esta configuracion reemplaza el despliegue con `pkg` para ejecutar el backend con `Node 22.11.0` dentro de un contenedor. Es la opcion recomendada para integraciones como `firebase-admin`, ya que evita los problemas de carga dinamica de modulos dentro del binario unico.

## Archivos incluidos

- `Dockerfile`: construye una imagen multi-stage basada en `node:22.11.0-bookworm-slim`.
- `docker-compose.yml`: levanta el servicio en el puerto `3005`, monta `uploads` y monta el JSON de Firebase como archivo de solo lectura.
- `.dockerignore`: reduce el contexto de construccion.

## Variables y rutas relevantes

- `PORT=3005`
- `SSL_ENABLED=false`
- `UPLOADS_ROOT=/app/uploads`
- `GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/firebase-service-account.json`

El `docker-compose.yml` ya monta este archivo local:

```text
./ferreclientes-4f214-firebase-adminsdk-fbsvc-29f985f65a.json
```

como esta ruta dentro del contenedor:

```text
/app/secrets/firebase-service-account.json
```

## Requisitos previos

- Docker Engine 24+ o Docker Desktop reciente
- Archivo `.env` configurado para la base de datos, JWT, correo y variables de negocio
- Archivo `ferreclientes-4f214-firebase-adminsdk-fbsvc-29f985f65a.json` presente en la raiz del proyecto

## Construccion y arranque

```bash
docker compose build
docker compose up -d
```

Ver logs:

```bash
docker compose logs -f backend-almacen
```

Detener:

```bash
docker compose down
```

## Prueba del contenedor

Una vez iniciado, el backend quedara disponible en:

```text
http://localhost:3005
```

Si mantienes el prefijo global actual, los endpoints siguen quedando bajo `/api`.

Ejemplos:

- `POST http://localhost:3005/api/clientes-mobile/v1/device-tokens`
- `POST http://localhost:3005/api/clientes-mobile/v1/notifications/test-push`

## Produccion detras de proxy

La recomendacion es publicar el contenedor por HTTP interno y terminar HTTPS en `nginx` o `apache`.

- Mantener `SSL_ENABLED=false` dentro del contenedor
- Exponer solo `3005` internamente si el proxy corre en el mismo host
- Reenviar trafico desde el proxy a `http://127.0.0.1:3005`

## Actualizacion de despliegue

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Notas

- El contenedor instala dependencias de produccion y ejecuta `node dist/main.js`.
- `logo-extendido.png` se copia dentro de la imagen porque es usado por el modulo de correo OTP.
- `uploads` se monta como volumen para conservar evidencias y respaldos entre reinicios.
- Si no quieres montar el JSON desde el host, puedes reemplazarlo por `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY` en el entorno del contenedor.
