#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DOCKER_BIN="${DOCKER_BIN:-docker}"

CONTAINER_NAME="${CONTAINER_NAME:-backend-almacen}"
IMAGE_NAME="${IMAGE_NAME:-backend-almacen}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
HOST_PORT="${HOST_PORT:-3006}"
CONTAINER_PORT="${CONTAINER_PORT:-3005}"

ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env}"
UPLOADS_DIR="${UPLOADS_DIR:-$PROJECT_DIR/uploads}"
FIREBASE_JSON="${FIREBASE_JSON:-$PROJECT_DIR/ferreclientes-4f214-firebase-adminsdk-fbsvc-29f985f65a.json}"
FIREBASE_TARGET_PATH="${FIREBASE_TARGET_PATH:-/app/secrets/firebase-service-account.json}"
HOST_SSL_DIR="${HOST_SSL_DIR:-$PROJECT_DIR/ssl}"
SSL_KEY_FILE="${SSL_KEY_FILE:-$HOST_SSL_DIR/ferremayoristas.key}"
SSL_CERT_FILE="${SSL_CERT_FILE:-$HOST_SSL_DIR/86cfeec44800f120.crt}"
SSL_CA_FILE="${SSL_CA_FILE:-$HOST_SSL_DIR/gd_bundle-g2.crt}"

echo "Project dir: $PROJECT_DIR"
echo "Container:   $CONTAINER_NAME"
echo "Image:       $IMAGE_NAME:$IMAGE_TAG"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: No se encontro el archivo de entorno: $ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$FIREBASE_JSON" ]]; then
  echo "ERROR: No se encontro el archivo de Firebase: $FIREBASE_JSON" >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  local default_value="${2:-}"
  local value
  value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"

  if [[ -z "$value" ]]; then
    printf '%s\n' "$default_value"
    return
  fi

  printf '%s\n' "$value"
}

is_truthy() {
  local value="${1,,}"
  [[ "$value" == "1" || "$value" == "true" || "$value" == "yes" || "$value" == "on" ]]
}

SSL_ENABLED_VALUE="${SSL_ENABLED:-$(read_env_value "SSL_ENABLED" "false")}"
SSL_KEY_PATH_VALUE="${SSL_KEY_PATH:-$(read_env_value "SSL_KEY_PATH" "/app/ssl/ferremayoristas.key")}"
SSL_CERT_PATH_VALUE="${SSL_CERT_PATH:-$(read_env_value "SSL_CERT_PATH" "/app/ssl/86cfeec44800f120.crt")}"
SSL_CA_PATH_VALUE="${SSL_CA_PATH:-$(read_env_value "SSL_CA_PATH" "/app/ssl/gd_bundle-g2.crt")}"

if is_truthy "$SSL_ENABLED_VALUE"; then
  for ssl_file in "$SSL_KEY_FILE" "$SSL_CERT_FILE" "$SSL_CA_FILE"; do
    if [[ ! -f "$ssl_file" ]]; then
      echo "ERROR: SSL_ENABLED=true pero falta el certificado: $ssl_file" >&2
      exit 1
    fi
  done
fi

mkdir -p "$UPLOADS_DIR"

echo "Construyendo imagen..."
"$DOCKER_BIN" build -t "$IMAGE_NAME:$IMAGE_TAG" "$PROJECT_DIR"

if "$DOCKER_BIN" ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
  echo "Deteniendo contenedor anterior..."
  "$DOCKER_BIN" stop "$CONTAINER_NAME" >/dev/null || true
  "$DOCKER_BIN" rm "$CONTAINER_NAME" >/dev/null || true
fi

RUN_ARGS=(
  -d
  --name "$CONTAINER_NAME"
  --restart unless-stopped
  --env-file "$ENV_FILE"
  -e NODE_ENV=production
  -e PORT="$CONTAINER_PORT"
  -e SSL_ENABLED="$SSL_ENABLED_VALUE"
  -e SSL_KEY_PATH="$SSL_KEY_PATH_VALUE"
  -e SSL_CERT_PATH="$SSL_CERT_PATH_VALUE"
  -e SSL_CA_PATH="$SSL_CA_PATH_VALUE"
  -e UPLOADS_ROOT=/app/uploads
  -e GOOGLE_APPLICATION_CREDENTIALS="$FIREBASE_TARGET_PATH"
  -p "$HOST_PORT:$CONTAINER_PORT"
  -v "$UPLOADS_DIR:/app/uploads"
  -v "$FIREBASE_JSON:$FIREBASE_TARGET_PATH:ro"
)

if is_truthy "$SSL_ENABLED_VALUE"; then
  RUN_ARGS+=(
    -v "$SSL_KEY_FILE:$SSL_KEY_PATH_VALUE:ro"
    -v "$SSL_CERT_FILE:$SSL_CERT_PATH_VALUE:ro"
    -v "$SSL_CA_FILE:$SSL_CA_PATH_VALUE:ro"
  )
fi

RUN_ARGS+=("$IMAGE_NAME:$IMAGE_TAG")

echo "Levantando contenedor nuevo..."
"$DOCKER_BIN" run "${RUN_ARGS[@]}"

echo
echo "Despliegue completado."
echo "Logs:    $DOCKER_BIN logs -f $CONTAINER_NAME"
echo "Prueba:  http://127.0.0.1:$HOST_PORT/api/docs"
