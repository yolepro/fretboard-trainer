# Lancer FretStudio en local (macOS)

Projet : application Expo (expo-router), 100 % locale. Il n'y a ni backend ni base de données :
les réglages et les records sont enregistrés sur l'appareil (stockage local).

Chemin : `/Users/mbp-yoanncharpiot/Dev/fretboard-trainer`

## Lancement

Un seul terminal :

```bash
cd /Users/mbp-yoanncharpiot/Dev/fretboard-trainer/frontend
yarn expo start --port 3000
```

Puis appuyer sur `w` pour ouvrir la version web, ou scanner le QR code avec Expo Go.

## Tester sur téléphone (Expo Go)

1. Mettre à jour Expo Go depuis l'App Store.
2. Téléphone et Mac sur le même Wi-Fi.
3. `yarn expo start --port 3000` puis scanner le QR code.

## Dépannage

- Utiliser `yarn` (pas `npm install`) : le script `preinstall` du projet peut le bloquer.
- Après une mise à jour des dépendances (`package.json`) : `yarn install`, puis `yarn expo start --clear`.

## Anciennes versions (backend + MongoDB)

Les versions précédentes contenaient un backend FastAPI et une base MongoDB, jamais utilisés par
l'application. Ils ont été supprimés en 1.30.5. S'ils tournent encore sur le Mac, on peut les arrêter :

```bash
brew services stop mongodb-community
```

Le fichier `frontend/.env` (`EXPO_PUBLIC_BACKEND_URL=…`) n'est plus utilisé et peut être supprimé.
