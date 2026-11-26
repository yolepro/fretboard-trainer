#!/usr/bin/env bash
# Ancien nom, gardé pour l'habitude : publie dans Expo Go. Voir deploy.sh (expo, local ou les deux).
exec "$(dirname "$0")/deploy.sh" expo "$@"
