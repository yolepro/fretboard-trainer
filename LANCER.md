# Lancer Fretboard Trainer en local (macOS)

Projet : Expo (expo-router) + backend FastAPI + MongoDB.
Chemin : `/Users/mbp-yoanncharpiot/Dev/fretboard-trainer`

## Lancement quotidien

Ouvrir deux terminaux.

### Terminal 1 : backend

```bash
cd /Users/mbp-yoanncharpiot/Dev/fretboard-trainer/backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Vérification : http://localhost:8001/docs

### Terminal 2 : frontend

```bash
cd /Users/mbp-yoanncharpiot/Dev/fretboard-trainer/frontend
yarn expo start --port 3000
```

Puis appuyer sur `w` pour ouvrir la version web.

MongoDB tourne en arrière-plan via Homebrew. S'il est arrêté :

```bash
brew services start mongodb-community
```

## Fichiers .env (non versionnés)

`backend/.env` :

```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="fretboard_trainer"
```

`frontend/.env` :

```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

Après toute modification d'un `.env` : `yarn expo start --clear`.

## Tester sur téléphone (Expo Go)

1. Mettre à jour Expo Go depuis l'App Store.
2. Récupérer l'IP du Mac : `ipconfig getifaddr en0`
3. Dans `frontend/.env`, remplacer `localhost` par cette IP.
4. Relancer avec `yarn expo start --port 3000 --clear` et scanner le QR code (même Wi-Fi).

## Dépannage

- Utiliser `yarn` (pas `npm install`) : le script `preinstall` du projet peut le bloquer.
- `pip install` échoue sur `emergentintegrations` : paquet propre à Emergent, absent de PyPI. Le retirer de `requirements.txt` s'il n'est pas utilisé dans le code (`grep -rn emergentintegrations --include=*.py backend`).
- Erreurs de version Python : recréer le venv avec Python 3.12 (`brew install python@3.12 && python3.12 -m venv venv`).
- Arrêter MongoDB : `brew services stop mongodb-community`.
