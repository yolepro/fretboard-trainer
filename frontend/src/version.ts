// Single source of truth for the version shown in the app.
// Bump the minor number (middle digit) at each feature change so a reload can be verified on screen.
// Keep app.json and package.json "version" in sync.
//
// 1.28.8 — Manche : choix « Notes neutres » retiré du menu (il reste dans Réglages)
// 1.28.7 — Manche, accords : la partition et l’écoute reprennent toutes les notes de la position choisie
// 1.28.6 — en-tête téléphone : bouton lecture rond (44), boutons qui ne rétrécissent plus ni ne sortent de l’écran
// 1.28.5 — Doigté portrait : seul le nom de la gamme reste en haut à gauche ; position / schéma et détails de la note en bas à gauche
// 1.28.4 — paysage : détails de la note de nouveau dans l’en-tête
// 1.28.3 — décompte affiché dans le bouton Tempo ; détails de la note déplacés tout en bas (portrait) ; manche collé sous l’en-tête
// 1.28.2 — Manche : mention « Touchez une note pour l’écouter » supprimée
// 1.28.1 — Doigté : mention « exercice · nombre de notes » supprimée de la ligne d’information
// 1.28.0 — bouton rond Tempo dans l’en-tête : feuille « Tempo et lecture » (tempo, raccourcis, débit, boucle, métronome) ; menu en bouton rond sur téléphone
// 1.27.3 — en-tête : bouton Écouter / Jouer sans texte sur téléphone, bandeau orange « FRETSTUDIO · … » supprimé
// 1.27.2 — rosace : points du bouton recentrés ; relatif mineur de la tonalité choisie seulement entouré
// 1.27.1 — correctif web : le choix d’une tonalité dans la rosace plantait (position du clic absente sur le web)
// 1.27.0 — tonalité : bouton rond dans l’en-tête (Manche, Doigté) ouvrant une rosace en cercle des quintes ; sélecteur retiré des menus
// 1.26.1 — Doigté : sélecteur Gammes / Arpèges 4 sons au même style que Gammes / Accords de Manche
// 1.26.0 — Doigté : arpèges 4 sons (∆, 7, m7, Ø), 5 schémas Do / La / Sol / Fa / Ré, sur une position ou en horizontal (vers la caisse ou vers le sillet, d’un schéma au schéma voisin)
// 1.25.0 — Horizontal : triades sur 2 ou 3 cordes, triades 7e sur 2, 3 ou 4 cordes (répartition des notes choisie pour le plus petit écart)
// 1.24.0 — application bilingue : français / anglais (Réglages → Langue ; langue de l’appareil par défaut)
// 1.23.1 — nombre de cases du manche : 22 par défaut
// 1.23.0 — Réglages : nombre de cases du manche (20 à 24) ; le manche, les positions, l’écoute et les exercices s’adaptent
// 1.22.4 — Horizontal : plus de notes orphelines (un groupe n’existe que si toutes ses notes sont sur le manche, en bas comme en haut)
// 1.22.3 — correctif : le mode Horizontal plantait (fonction scaleCellsOnStrings supprimée par erreur en 1.21.0)
// 1.22.2 — décompte automatique : 1 mesure, ou une demi-mesure (affichée 3/4 puis 4/4) quand le tempo est sous 70 ; bouton Décompte supprimé
// 1.22.1 — partition : indication de tempo au-dessus de la clé (noire ou blanche = BPM)
// 1.22.0 — partition : chiffrage de mesure (4/4, 2/2 pour les triolets de noires) et nouvelle clé de sol ; triolets de noires : pulsation, tempo, décompte et métronome à la blanche ; décompte en mesures ; Manche : tempo, boucle, décompte et métronome dans le menu
// 1.21.0 — Doigté : débit des notes « Lent » (par défaut : un groupe sur 2 temps — noires, triolets de noires, croches ; tempos 110 / 85 / 70) ou « Normal » ; décompte 4 temps, 2 temps ou aucun ; la partition écrit les vraies valeurs de notes
// 1.20.2 — retour du tempo à la noire (annulation de la 1.20.1 : croches 80, triolets 60, doubles croches 50)
// 1.20.0 — tous les filtres passent dans le menu (bouton « Gamme / Accord » dans Manche, « Exercice » dans Doigté), visible en portrait et en paysage ; panneau du bas supprimé en portrait ; partition + tablature affichées par défaut (paysage : tablature si la hauteur le permet)
// 1.19.2 — note active : orange un peu moins foncé, plus proche du groupe à venir
// 1.19.1 — manche : la note active est entourée en orange foncé
// 1.19.0 — Horizontal : départ sur la fondamentale (position 1), « Tout le manche » affiche toutes les notes de la gamme sur les cordes choisies ; Doigté : le groupe de notes à venir est entouré en orange sur le manche
// 1.18.2 — Horizontal : cordes graves par défaut, exercice Gamme désactivé, le parcours part de la note la plus grave du degré choisi (E case 0, F# case 2…), étendue effective
// 1.18.1 — Doigté : tempo par défaut selon l’exercice (croches 80, triolets 60, doubles croches 50)
// 1.18.0 — Doigté : exercice horizontal (les groupes restent sur les mêmes cordes et montent le long du manche) ; choix des cordes, du premier accord et de l’étendue ; manche : seules les notes du parcours sont allumées
// 1.17.2 — exercice Tierces : plus de symboles m3 / M3 au-dessus de la partition
// 1.17.1 — Manche : en mode Gamme, la position 1 est affichée par défaut
// 1.17.0 — Manche : avec une position sélectionnée, la partition et « Écouter » couvrent toutes les notes de la position ; sélecteur de départ (note la plus grave / tonique)
// 1.16.2 — accueil : texte des fonctionnalités aligné à gauche, cadre centré
// 1.16.1 — accueil centré (web), partition sans rangée d’accords quand il n’y en a pas, menu Gamme : bas du panneau sans bande noire
// 1.16.0 — partition + tablature sous le manche (Manche et Doigté) synchronisées avec la surbrillance et l’écoute ; BPM à la noire saisi au clavier ; rythme réel (croches, triolets, doubles croches) ; métronome optionnel ; descente alignée sur les temps
// 1.15.1 — décompte en claves (4 sons garantis, un lecteur dédié par temps) ; séquenceur testé
// 1.15.0 — Doigté : lecture sans délai ni dérive (notes préchargées, horloge absolue, affichage allégé) et décompte de 4 temps avec cloche
// 1.14.0 — description des fonctionnalités sur la page d’accueil
// 1.13.2 — fond photo de studio aussi sur Oreille et Réglages
// 1.13.1 — nouveau fond d’écran : photo de studio de musique (noir et blanc), embarquée dans l’app
// 1.13.0 — page d’accueil (logo + version), nouveau logo FretStudio comme icône / écran de démarrage ; Manche devient le 2e onglet
// 1.12.1 — Doigté en paysage : le manche tient dans l’écran (infos dans l’en-tête, bande de notes réduite) et menu Gamme accessible
// 1.12.0 — nouvelle section Doigté (entre Manche et Oreille) : montée/descente en gamme, tierces, triades 1-3-5, triades 7e 1-3-5-7 sur une position, avec lecture, tempo, boucle
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
export const APP_VERSION = "1.28.8";
