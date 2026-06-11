# Notificaciones Push FCM

## Resumen

Este backend incorpora un modulo `customer-notifications` para clientes mobile con:

- Registro y desactivacion de tokens FCM.
- Historial de notificaciones enviadas.
- Deduplicacion por `dedupe_key`.
- Cron para `visit_day` y `overdue_invoices`.
- Envio FCM con `notification` y `data`.
- Desactivacion automatica de tokens invalidos o no registrados.

## Variables de entorno

Se soportan dos formas de autenticacion para Firebase Admin SDK:

### Opcion A: archivo JSON

```env
GOOGLE_APPLICATION_CREDENTIALS=./ferreclientes-4f214-firebase-adminsdk-fbsvc-29f985f65a.json
```

Tambien funciona ruta absoluta:

```env
GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\segura\firebase-admin.json
```

### Opcion B: variables individuales

```env
FIREBASE_PROJECT_ID=ferreclientes-4f214
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@ferreclientes-4f214.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Variables de negocio

```env
NOTIFICATION_VISIT_HOUR=9
OVERDUE_NOTIFICATION_INTERVAL_DAYS=1
```

Notas:

- `NOTIFICATION_VISIT_HOUR`: hora 0-23 en la que los jobs evaluan reglas.
- `OVERDUE_NOTIFICATION_INTERVAL_DAYS`: envia notificacion de facturas atrasadas diario o cada `N` dias.
- Si no se define `GOOGLE_APPLICATION_CREDENTIALS`, el servicio intenta usar las variables `FIREBASE_*`.
- Como respaldo de desarrollo, el servicio tambien puede leer el archivo JSON existente en la raiz del proyecto backend.

## Tablas requeridas

Ejecutar el script:

```sql
docs/sql/customer-notifications.sql
```

Tablas creadas:

- `device_tokens`
- `customer_notifications`

Indices clave:

- `ux_device_tokens_fcm_token`
- `ux_customer_notifications_dedupe_key`
- `idx_device_tokens_customer_active`

## Endpoints

Base path:

```text
/clientes-mobile/v1
```

Todos los endpoints requieren `Authorization: Bearer <jwt_cliente>`.

### 1. Registrar token FCM

`POST /clientes-mobile/v1/device-tokens`

Request:

```json
{
  "fcmToken": "FCM_TOKEN_DEL_DISPOSITIVO",
  "platform": "android",
  "deviceName": "Samsung A55",
  "appVersion": "1.0.0"
}
```

Response:

```json
{
  "registered": true,
  "token": {
    "id": 12,
    "customerId": 123,
    "platform": "android",
    "deviceName": "Samsung A55",
    "appVersion": "1.0.0",
    "isActive": true,
    "lastSeenAt": "2026-06-10T15:05:00.000Z",
    "createdAt": "2026-06-10T15:05:00.000Z",
    "updatedAt": "2026-06-10T15:05:00.000Z"
  }
}
```

### 2. Desactivar token

`POST /clientes-mobile/v1/device-tokens/deactivate`

Request:

```json
{
  "fcmToken": "FCM_TOKEN_DEL_DISPOSITIVO"
}
```

Response:

```json
{
  "deactivated": true,
  "token": {
    "id": 12,
    "customerId": 123,
    "platform": "android",
    "deviceName": "Samsung A55",
    "appVersion": "1.0.0",
    "isActive": false,
    "lastSeenAt": "2026-06-10T15:05:00.000Z",
    "createdAt": "2026-06-10T15:05:00.000Z",
    "updatedAt": "2026-06-10T15:10:00.000Z"
  }
}
```

### 3. Listar historial

`GET /clientes-mobile/v1/notifications?limit=20&offset=0&unreadOnly=false`

Response:

```json
{
  "items": [
    {
      "id": 45,
      "customerId": 123,
      "type": "visit_day",
      "title": "Hoy es tu dia de visita",
      "body": "Puedes crear tus pedidos hoy para recibirlos al dia siguiente.",
      "dedupeKey": "visit_day:123:2026-06-10",
      "metadata": {
        "evaluatedDate": "2026-06-10",
        "numeroCliente": "07810",
        "diaVis": "MIERCOLES",
        "delivery": {
          "successCount": 1,
          "failureCount": 0,
          "invalidTokenIds": [],
          "failures": []
        }
      },
      "scheduledFor": "2026-06-10T09:00:00.000Z",
      "sentAt": "2026-06-10T09:00:03.000Z",
      "readAt": null,
      "deletedByUser": false,
      "status": "sent",
      "fcmMessageIds": [
        "projects/ferreclientes-4f214/messages/0:1781140000000000%abc123"
      ],
      "errorCode": null,
      "errorMessage": null,
      "createdAt": "2026-06-10T09:00:03.000Z",
      "updatedAt": "2026-06-10T09:00:03.000Z"
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 20,
    "total": 1,
    "unread": 1
  }
}
```

### 4. Enviar push de prueba

`POST /clientes-mobile/v1/notifications/test-push`

Request:

```json
{
  "title": "Prueba push",
  "body": "Esta es una notificacion de prueba enviada manualmente.",
  "data": {
    "screen": "home",
    "origin": "postman"
  }
}
```

Response:

```json
{
  "sent": true,
  "skipped": false,
  "reason": null,
  "notification": {
    "id": 47,
    "customerId": 123,
    "type": "test_push",
    "title": "Prueba push",
    "body": "Esta es una notificacion de prueba enviada manualmente.",
    "status": "sent",
    "fcmMessageIds": [
      "projects/ferreclientes-4f214/messages/0:1781140000000000%abc999"
    ]
  }
}
```

### 5. Marcar como leida

`PATCH /clientes-mobile/v1/notifications/45/read`

Response:

```json
{
  "updated": true,
  "notification": {
    "id": 45,
    "type": "visit_day",
    "readAt": "2026-06-10T16:00:00.000Z"
  }
}
```

### 6. Borrar del historial del usuario

`DELETE /clientes-mobile/v1/notifications/45`

Response:

```json
{
  "deleted": true,
  "id": 45
}
```

## Payloads FCM

### Dia de visita

```json
{
  "message": {
    "token": "FCM_TOKEN_DEL_DISPOSITIVO",
    "notification": {
      "title": "Hoy es tu dia de visita",
      "body": "Puedes crear tus pedidos hoy para recibirlos al dia siguiente."
    },
    "data": {
      "type": "visit_day",
      "customerId": "123",
      "notificationId": "45",
      "date": "2026-06-10",
      "numeroCliente": "07810"
    },
    "android": {
      "priority": "high"
    }
  }
}
```

### Push de prueba

```json
{
  "message": {
    "token": "FCM_TOKEN_DEL_DISPOSITIVO",
    "notification": {
      "title": "Prueba push",
      "body": "Esta es una notificacion de prueba enviada manualmente."
    },
    "data": {
      "type": "test_push",
      "customerId": "123",
      "notificationId": "47",
      "source": "manual_test_endpoint",
      "requestedAt": "2026-06-11T16:00:00.000Z",
      "screen": "home",
      "origin": "postman"
    },
    "android": {
      "priority": "high"
    }
  }
}
```

### Facturas atrasadas

```json
{
  "message": {
    "token": "FCM_TOKEN_DEL_DISPOSITIVO",
    "notification": {
      "title": "Tienes facturas atrasadas",
      "body": "Tienes 3 factura(s) vencida(s). Revisa tu estado de cuenta en la app."
    },
    "data": {
      "type": "overdue_invoices",
      "customerId": "123",
      "notificationId": "46",
      "date": "2026-06-10",
      "invoiceCount": "3",
      "maxDaysLate": "12",
      "folios": "[\"F-1001\",\"F-1005\",\"F-1010\"]"
    },
    "android": {
      "priority": "high"
    }
  }
}
```

## Reglas implementadas

### `test_push`

- Usa el endpoint manual `POST /clientes-mobile/v1/notifications/test-push`.
- Requiere JWT del cliente autenticado.
- Guarda historial en `customer_notifications`.
- Genera `dedupe_key = test_push:<customerId>:<timestamp>`.

### `visit_day`

- Lee `CLI.DIAVIS`.
- Compara contra el dia actual.
- Genera `dedupe_key = visit_day:<customerId>:<yyyy-mm-dd>`.
- Solo envia una vez por cliente por dia.

### `overdue_invoices`

- Busca facturas `DOC` abiertas, con saldo pendiente y `VENCE < hoy`.
- Agrupa por cliente y guarda metadata:
  - `folios`
  - `invoiceCount`
  - `maxDaysLate`
  - `totalOverdue`
  - `evaluatedDate`
- Respeta `OVERDUE_NOTIFICATION_INTERVAL_DAYS`.
- Genera `dedupe_key = overdue_invoices:<customerId>:<yyyy-mm-dd>`.

## Manejo de errores

- Si FCM devuelve `messaging/invalid-registration-token` o `messaging/registration-token-not-registered`, el token se marca `is_active = 0`.
- Si el cliente no tiene tokens activos, la notificacion se registra con `status = failed`.
- Los errores y fallos parciales se guardan en `customer_notifications.error_code`, `error_message` y `metadata.delivery`.

## Archivos principales

- `src/modules/customer-notifications/customer-notifications.module.ts`
- `src/modules/customer-notifications/customer-notifications.service.ts`
- `src/modules/customer-notifications/push-notification.service.ts`
- `src/modules/customer-notifications/visit-day-notification.job.ts`
- `src/modules/customer-notifications/overdue-invoices-notification.job.ts`
- `src/entities/device-token.entity.ts`
- `src/entities/customer-notification.entity.ts`
