# FretStudio — PRD

## Original problem statement
Application mobile et web cross-platform (Expo) d'entraînement à la guitare : manche interactif horizontal (6 cordes, 24 cases, grave en bas, repères nacrés 3,5,7,9,12×2,15,17,19,21,24×2), calques par fonction harmonique avec couleurs strictes (Tonique rouge #EF4444, 3ce bleu #3B82F6, 5te vert #10B981, 7e ambre #F59E0B, 9e violet #8B5CF6, 11e rose #EC4899, 13e cyan #06B6D4, neutres gris), sélecteurs tonalité/octave/gamme/accord, écran entraînement auditif (quiz + détection micro temps réel), réglages. Style dark studio.
User choices: horizontal, accordage standard, détection 100 % locale (YIN), samples de guitare, pas d'auth.
Follow-ups: menu de choix de gamme ; rotation paysage montrant au moins jusqu'à la case 16.

## Architecture
- Frontend only (Expo Router, tabs: Manche / Oreille / Réglages). Backend template untouched (unused).
- `src/music/theory.ts` (12 gammes, 20 accords, degrés), `src/music/yin.ts` (YIN pitch detection)
- `src/audio/sampler.ts` (35 samples guitare acoustique E2–D5 bundlés, pitch-shift au-delà), `usePitchDetector` (native: expo-audio AudioStream; web: getUserMedia + AnalyserNode)
- `src/settings.tsx` persisted settings (notation EN/latin, #/b, labels, neutres, son, volume, diapason A4, octave stricte)
- Components: Fretboard (fretScale/rowH props), ScalePicker (bottom sheet), Chip, Glass, StudioBackground

## Implemented (2026-06)
- Scale boxes: 5 positions (parent pentatonic, 2 notes/string chaining) in panel + picker; window highlight + auto-scroll
- Positions: scroll only if box off-screen, other scale notes faded outside the box, position chips in landscape legend row
- Scale & chord modes: uniform-color dots by default; degree chips recolor their notes (tonic selected by default) instead of hiding them.
- Ear quiz v2: exact octave required (Note & Écoute modes), octave-specific feedback, dynamic hint after 2 errors (string + fret list + mini fretboard); iOS speaker routing fix (doNotMix → session mode reset, defaultToSpeaker), mic paused during reference playback
- Single mic control (dial), monophonic playback (new note stops previous)
- Manche interactif + calques togglables + filtre octave + étiquettes notes/degrés + lecture gamme/arpège
- Menu "Gamme/Accord" (sheet groupé avec intervalles colorés)
- Paysage : panneau masqué, manche redimensionné (cases 0→16 visibles)
- Quiz oreille : Trouve la note / Écoute & rejoue / Degrés d'accord, score/série/record, cents meter, permissions micro complètes
- Réglages complets

## Backlog
- P1: Positions CAGED / boxes de gamme, métronome
- P1: Historique de progression & stats par note
- P2: Mode gaucher, autres accordages, accordeur dédié
