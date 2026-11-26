#!/usr/bin/env bash
# Récupère la dernière version du code (git pull) et la publie dans Expo Go (EAS Update),
# avec le numéro de version de l'appli (src/version.ts) comme message.
#
# Usage, depuis n'importe quel dossier :
#   ./frontend/scripts/publish-expo-go.sh            (depuis la racine du dépôt)
#   yarn publish:expo-go                             (depuis frontend/)
# Options (variables d'environnement) : CHANNEL=main  PLATFORM=ios|android|all  SKIP_PULL=1
set -euo pipefail

FRONT="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$FRONT/.." && pwd)"
CHANNEL="${CHANNEL:-main}"
PLATFORM="${PLATFORM:-ios}"

say() { printf '\n▸ %s\n' "$*"; }
fail() { printf '\n✖ %s\n' "$*" >&2; exit 1; }

# 1. Prérequis
command -v git >/dev/null || fail "git est introuvable."
command -v yarn >/dev/null || fail "yarn est introuvable : lance « corepack enable »."
command -v eas >/dev/null || fail "eas-cli est introuvable : lance « npm install -g eas-cli »."
eas whoami >/dev/null 2>&1 || fail "Tu n'es pas connecté à Expo : lance « eas login »."

cd "$ROOT"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
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

# 5. Publication
say "Publication de la v$VERSION ($BRANCH, $COMMIT) sur le canal « $CHANNEL » ($PLATFORM)"
eas update \
  --channel "$CHANNEL" \
  --platform "$PLATFORM" \
  --environment production \
  --message "v$VERSION ($BRANCH, $COMMIT)" \
  --non-interactive || fail "eas update a échoué (voir ci-dessus)."

printf '\n✔ v%s publiée. Dans Expo Go : ferme complètement l’appli puis rouvre le projet (parfois deux fois).\n' "$VERSION"
