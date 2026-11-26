#!/usr/bin/env bash
# Récupère la dernière version du code (git pull) puis la déploie :
#   expo   → publication dans Expo Go (EAS Update), message = numéro de version de l'appli
#   local  → serveur Expo sur cette machine (simulateur, Expo Go sur le même réseau, ou la VM avec son nom DNS)
#   both   → les deux : publication puis serveur local
#
# Usage, depuis n'importe quel dossier :
#   ./frontend/scripts/deploy.sh [expo|local|both]     (sans argument : un menu demande le choix)
#   yarn deploy [expo|local|both]                       (depuis frontend/)
#
# Options (variables d'environnement) :
#   CHANNEL=main  PLATFORM=ios|android|all              publication Expo Go
#   SKIP_PULL=1                                          ne pas faire de git pull
#   HOST=fretstudio.<région>.cloudapp.azure.com         local : adresse que l'iPhone utilisera (VM Azure)
#   PORT=8081                                            local : port du serveur
#   OPEN=ios|android|web                                 local : ouvrir directement le simulateur / le navigateur
#   OFFLINE=1                                            local : sans compte Expo (évite l'erreur « codesigning »)
#   KEEP_CACHE=1                                         local : ne pas vider le cache de Metro
set -euo pipefail

FRONT="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$FRONT/.." && pwd)"
CHANNEL="${CHANNEL:-main}"
PLATFORM="${PLATFORM:-ios}"
PORT="${PORT:-8081}"

say() { printf '\n▸ %s\n' "$*"; }
fail() { printf '\n✖ %s\n' "$*" >&2; exit 1; }

# 0. Où déployer
MODE="${1:-}"
if [ -z "$MODE" ]; then
  if [ -t 0 ]; then
    printf 'Où déployer ?\n  1) Expo Go (publication EAS Update, pour l’iPhone)\n  2) En local (serveur Expo sur cette machine)\n  3) Les deux\n'
    read -r -p 'Choix [1-3] : ' c
    case "$c" in 1) MODE=expo ;; 2) MODE=local ;; 3) MODE=both ;; *) fail "Choix inconnu : $c" ;; esac
  else
    MODE=expo
  fi
fi
case "$MODE" in
  expo | go | expo-go) MODE=expo ;;
  local) ;;
  both | les-deux | all) MODE=both ;;
  *) fail "Mode inconnu : $MODE (expo, local ou both)." ;;
esac
PUBLISH=0
LOCAL=0
[ "$MODE" != "local" ] && PUBLISH=1
[ "$MODE" != "expo" ] && LOCAL=1

# 1. Prérequis
command -v git >/dev/null || fail "git est introuvable."
command -v yarn >/dev/null || fail "yarn est introuvable : lance « corepack enable »."
if [ "$PUBLISH" = 1 ]; then
  command -v eas >/dev/null || fail "eas-cli est introuvable : lance « npm install -g eas-cli »."
  eas whoami >/dev/null 2>&1 || fail "Tu n'es pas connecté à Expo : lance « eas login »."
fi

cd "$ROOT"
if [ "$PUBLISH" = 1 ] && [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short --untracked-files=no
  fail "Des fichiers suivis par git ont été modifiés (ci-dessus). Enregistre-les (commit) ou annule-les (git restore <fichier>) avant de publier."
fi
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# 2. git pull
BEFORE="$(git rev-parse HEAD)"
if [ "${SKIP_PULL:-0}" != "1" ]; then
  say "Récupération du code (branche $BRANCH)"
  git pull --ff-only || fail "git pull a échoué (voir ci-dessus)."
fi
AFTER="$(git rev-parse HEAD)"

# 3. Dépendances : seulement si elles ont changé, ou si elles ne sont pas installées
cd "$FRONT"
if [ ! -d node_modules ] || ! git diff --quiet "$BEFORE" "$AFTER" -- package.json yarn.lock; then
  say "Installation des dépendances"
  yarn install --frozen-lockfile || fail "yarn install a échoué (voir ci-dessus)."
fi

# 4. Numéro de version
VERSION="$(sed -n 's/^export const APP_VERSION = "\(.*\)";.*/\1/p' src/version.ts)"
[ -n "$VERSION" ] || fail "Numéro de version introuvable dans src/version.ts."
APP_JSON_VERSION="$(node -p "require('./app.json').expo.version")"
[ "$VERSION" = "$APP_JSON_VERSION" ] || printf '⚠ Attention : version.ts dit %s, app.json dit %s.\n' "$VERSION" "$APP_JSON_VERSION"
COMMIT="$(git rev-parse --short HEAD)"

# 5. Publication dans Expo Go
if [ "$PUBLISH" = 1 ]; then
  say "Publication de la v$VERSION ($BRANCH, $COMMIT) sur le canal « $CHANNEL » ($PLATFORM)"
  eas update \
    --channel "$CHANNEL" \
    --platform "$PLATFORM" \
    --environment production \
    --message "v$VERSION ($BRANCH, $COMMIT)" \
    --non-interactive || fail "eas update a échoué (voir ci-dessus)."
  printf '\n✔ v%s publiée. Dans Expo Go : ferme complètement l’appli puis rouvre le projet (parfois deux fois).\n' "$VERSION"
fi

# 6. Serveur local (reste ouvert : Ctrl-C pour l'arrêter)
if [ "$LOCAL" = 1 ]; then
  ARGS=(--port "$PORT")
  [ "${KEEP_CACHE:-0}" = "1" ] || ARGS+=(-c)
  [ "${OFFLINE:-0}" = "1" ] && ARGS+=(--offline)
  case "${OPEN:-}" in
    ios) ARGS+=(--ios) ;;
    android) ARGS+=(--android) ;;
    web) ARGS+=(--web) ;;
    "") ;;
    *) fail "OPEN inconnu : $OPEN (ios, android ou web)." ;;
  esac
  if [ -n "${HOST:-}" ]; then
    # VM : l'iPhone se connecte par ce nom (le port doit être ouvert dans Azure).
    export REACT_NATIVE_PACKAGER_HOSTNAME="$HOST"
    ARGS+=(--lan)
    printf '\nAdresse pour Expo Go : exp://%s:%s\n' "$HOST" "$PORT"
  fi
  say "Serveur local de la v$VERSION ($BRANCH, $COMMIT) — Ctrl-C pour l’arrêter"
  exec npx expo start "${ARGS[@]}"
fi
