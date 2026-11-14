// Single source of truth for the version shown in the app.
// Bump the minor number (middle digit) at each feature change so a reload can be verified on screen.
// Keep app.json and package.json "version" in sync.
//
// 1.11.1 — positions des gammes spéciales complétées : plus aucune note manquante (ex. demi-ton/ton de Do P1 = 8–12, avec Mi et La en case 12), même schéma dans les 12 tonalités
// 1.11.0 — positions pour les gammes spéciales (fenêtres de 4–5 cases ancrées sur la tonique : chromatique 3, tons entiers 3, demi-ton/ton et ton/demi-ton 4) ; Écouter joue les notes affichées
// 1.10.0 — gammes spéciales : chromatique, tons entiers, demi-ton/ton, ton/demi-ton (manche entier uniquement, sans positions)
// 1.9.0 — position 2/2 coupée par la fin du manche : utilise l'octave du dessous, complète, avec les plus petits écarts (Sol P5 2/2 = cases 0–4)
// 1.8.1 — correctif iPhone : plantage (transform) en changeant plusieurs fois de style de manche
// 1.8.0 — boutons de position sans numéros de cases ; choix des étiquettes (notes / degrés) dans le menu Gamme (utile en mode horizontal)
// 1.7.0 — positions ancrées sur la fondamentale : Pos. 1 = box dont la tonique est la 1ʳᵉ note (pentatoniques) / 2ᵉ note (majeure) de la corde 6, même schéma dans les 12 tonalités (Sol P1 = 2–5, Do P1 = 7–10)
// 1.6.1 — changer de position remet tous les boutons de position sur 1/2
// 1.6.0 — positions de gamme = ensemble exact de notes : lues corde par corde elles se suivent dans la gamme, sans trou ni note répétée (Do P1 = 2–6, Sol P4 = 9–13...)
// 1.5.3 — Écouter : sur une position coupée par la fin du manche (2/2 de la dernière position), ne joue que les notes affichées
// 1.5.2 — positions de gamme complétées : plus aucune note manquante (ex. Do Pos. 2 = cases 4–8), vérifié sur 12 tonalités × 12 gammes
// 1.5.1 — « Écouter » part toujours de la fondamentale la plus grave de la position
// 1.5.0 — suppression du sélecteur Octave ; « Écouter » part de la tonique dans la position choisie, monte jusqu’à l’octave au-dessus et surligne chaque note sur le manche
// 1.4.1 — badges 1/2 (bleu) et 2/2 (ambre) bien distincts
// 1.4.0 — sélecteurs 1/2 · 2/2 des positions en badge arrondi coloré
// 1.3.0 — 5 styles de manche au choix (Réglages → Manche) : Studio, Palissandre, Érable miel, Ébène, Nuit indigo
// 1.2.0 — repères de touche en marron (se détachent des notes)
// 1.1.0 — positions décalées (ancienne Pos. 2 = Pos. 1) + bascule 1/2 ↔ 2/2 (position homologue +12 frets)
export const APP_VERSION = "1.11.1";
