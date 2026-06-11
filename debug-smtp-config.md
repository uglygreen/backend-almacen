# [OPEN] SMTP Config Debug

## Sintoma
- En produccion, despues de actualizar backend y reiniciar el servicio, sigue apareciendo:
  `SMTP no configurado. El OTP seguira usando fallback a logs`

## Hipotesis
1. El proceso en produccion no esta cargando el archivo `.env` porque no se encuentra en `process.cwd()` ni junto al ejecutable.
2. El servicio systemd si arranca la app, pero con otro directorio de trabajo distinto al esperado.
3. Las variables `SMTP_HOST`, `SMTP_USER` o `SMTP_PASS` no existen realmente en el entorno efectivo del proceso aunque si esten en un archivo `.env`.
4. El backend en produccion no corresponde al build mas reciente y sigue corriendo una version anterior o una ruta distinta.
5. El archivo `.env` existe, pero tiene formato/codificacion/valores vacios que hacen que `trim()` deje alguna variable requerida como vacia.

## Evidencia Inicial
- `ClientesMobileMailService` solo muestra ese warning cuando falta `host`, `port`, `user` o `pass`.
- `runtime-env.ts` solo intenta leer `.env` y `.env.production` desde el `cwd` y desde el directorio del ejecutable.

## Siguiente Paso
- Inspeccionar el archivo `.env` local, el cargador de variables y dejar instrucciones de verificacion exactas para produccion.
