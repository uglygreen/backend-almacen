#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DOCKER_BIN="${DOCKER_BIN:-docker}"

CONTAINER_NAME="${CONTAINER_NAME:-backend-almacen}"
IMAGE_NAME="${IMAGE_NAME:-backend-almacen}"
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

STATE_DIR="${STATE_DIR:-$PROJECT_DIR/.deploy}"
CURRENT_IMAGE_FILE="$STATE_DIR/current-image.txt"
PREVIOUS_IMAGE_FILE="$STATE_DIR/previous-image.txt"

usage() {
  cat <<EOF
Uso:
  $(basename "$0") deploy [version]
  $(basename "$0") rollback [image_tag_o_image_ref]

Ejemplos:
  $(basename "$0") deploy
  $(basename "$0") deploy 20260612-0130
  $(basename "$0") rollback
  $(basename "$0") rollback backend-almacen:20260612-0130
EOF
}

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

ensure_inputs() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: No se encontro el archivo de entorno: $ENV_FILE" >&2
    exit 1
  fi

  if [[ ! -f "$FIREBASE_JSON" ]]; then
    echo "ERROR: No se encontro el archivo de Firebase: $FIREBASE_JSON" >&2
    exit 1
  fi

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

  mkdir -p "$UPLOADS_DIR" "$STATE_DIR"
}

container_exists() {
  "$DOCKER_BIN" ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"
}

container_running_image() {
  "$DOCKER_BIN" inspect --format '{{.Config.Image}}' "$CONTAINER_NAME"
}

run_container() {
  local image_ref="$1"
  local run_args

  if container_exists; then
    "$DOCKER_BIN" stop "$CONTAINER_NAME" >/dev/null || true
    "$DOCKER_BIN" rm "$CONTAINER_NAME" >/dev/null || true
  fi

  run_args=(
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
    run_args+=(
      -v "$SSL_KEY_FILE:$SSL_KEY_PATH_VALUE:ro"
      -v "$SSL_CERT_FILE:$SSL_CERT_PATH_VALUE:ro"
      -v "$SSL_CA_FILE:$SSL_CA_PATH_VALUE:ro"
    )
  fi

  run_args+=("$image_ref")

  "$DOCKER_BIN" run "${run_args[@]}"
}

save_state() {
  local current_image="$1"
  local previous_image="$2"

  printf '%s\n' "$current_image" > "$CURRENT_IMAGE_FILE"

  if [[ -n "$previous_image" ]]; then
    printf '%s\n' "$previous_image" > "$PREVIOUS_IMAGE_FILE"
  fi
}

ensure_inputs

ACTION="${1:-}"
ARG_VALUE="${2:-}"

if [[ -z "$ACTION" ]]; then
  usage
  exit 1
fi

case "$ACTION" in
  deploy)
    VERSION="${ARG_VALUE:-$(date -u +%Y%m%d-%H%M%S)}"
    NEW_IMAGE="$IMAGE_NAME:$VERSION"
    LATEST_IMAGE="$IMAGE_NAME:latest"
    PREVIOUS_IMAGE=""

    if container_exists; then
      PREVIOUS_IMAGE="$(container_running_image)"
      echo "Imagen anterior detectada: $PREVIOUS_IMAGE"
    fi

    echo "Construyendo imagen $NEW_IMAGE ..."
    "$DOCKER_BIN" build -t "$NEW_IMAGE" -t "$LATEST_IMAGE" "$PROJECT_DIR"

    echo "Levantando contenedor con $NEW_IMAGE ..."
    run_container "$NEW_IMAGE"
    save_state "$NEW_IMAGE" "$PREVIOUS_IMAGE"

    echo
    echo "Despliegue completado."
    echo "Imagen actual:  $NEW_IMAGE"
    if [[ -n "$PREVIOUS_IMAGE" ]]; then
      echo "Rollback:      $(basename "$0") rollback $PREVIOUS_IMAGE"
    fi
    echo "Logs:          $DOCKER_BIN logs -f $CONTAINER_NAME"
    ;;

  rollback)
    TARGET_IMAGE="${ARG_VALUE:-}"
    if [[ -z "$TARGET_IMAGE" ]]; then
      if [[ ! -f "$PREVIOUS_IMAGE_FILE" ]]; then
        echo "ERROR: No hay imagen previa registrada para rollback." >&2
        exit 1
      fi
      TARGET_IMAGE="$(<"$PREVIOUS_IMAGE_FILE")"
    elif [[ "$TARGET_IMAGE" != *:* ]]; then
      TARGET_IMAGE="$IMAGE_NAME:$TARGET_IMAGE"
    fi

    if ! "$DOCKER_BIN" image inspect "$TARGET_IMAGE" >/dev/null 2>&1; then
      echo "ERROR: La imagen indicada no existe localmente: $TARGET_IMAGE" >&2
      exit 1
    fi

    CURRENT_IMAGE=""
    if container_exists; then
      CURRENT_IMAGE="$(container_running_image)"
    fi

    echo "Revirtiendo a $TARGET_IMAGE ..."
    run_container "$TARGET_IMAGE"
    save_state "$TARGET_IMAGE" "$CURRENT_IMAGE"

    echo
    echo "Rollback completado."
    echo "Imagen actual:  $TARGET_IMAGE"
    if [[ -n "$CURRENT_IMAGE" ]]; then
      echo "Rollback inverso: $(basename "$0") rollback $CURRENT_IMAGE"
    fi
    echo "Logs:          $DOCKER_BIN logs -f $CONTAINER_NAME"
    ;;

  *)
    usage
    exit 1
    ;;
esac
