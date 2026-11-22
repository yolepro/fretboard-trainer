// Single source of truth for the version shown in the app.
// Bump the minor number (middle digit) at each feature change so a reload can be verified on screen.
// Keep app.json and package.json "version" in sync.
//
// 1.52.0 — Android : la gamme (Explorer, exercices) est mixée à l’avance en un seul fichier son (décompte, notes, métronome) et jouée par un seul lecteur ; le rythme ne dépend plus du fil JavaScript. Mixage préparé pendant les temps morts après chaque changement ; repli sur la lecture note à note si le fichier ne se charge pas
// 1.51.1 — Trouve le degré › Intermédiaire : « Arpège 7 » (3, 5, 7) retiré, doublon des Piliers (1, 3, 5, 7)
// 1.51.0 — Une seule façon de choisir un jeu : carte dépliable partagée (GameCard) avec pastilles = un réglage par feuille, longueur, record et Démarrer · <jeu>. Oreille devient une liste de jeux (Joue sur ta guitare : Manche, Écoute & rejoue, Degrés d’accord, Intervalles ; Accords : ses 4 jeux), sans sélecteur de sections ni cadre ; Trouve la gamme et Perso passent en carte à pastilles ; Trouve le degré : la tonalité se change par sa pastille. Jeux décrits dans src/ear/games.ts et src/challenge/games.ts
// 1.50.0 — Réglages › Mes résultats : ce qui est enregistré par famille (Oreille, Challenges, Accords : records et parties) ; « Effacer mes résultats… » ouvre une feuille où l’on coche les familles à remettre à zéro (records, parties, points faibles), bouton « Tout effacer » / « Effacer : … » ; les écrans ouverts rechargent leurs records après effacement
// 1.49.1 — Corrections (tests sur simulateur) : paysage — le X des jeux d’Oreille et l’icône Résultats ne passent plus sous la pastille d’onglets, listes et réglages décalés de l’encoche ; Réinitialiser demande confirmation et efface aussi les records des Challenges et d’Accords ; choix d’accords recalculés après rotation ; plus de pause au lancement à cause de la demande du micro ; records d’Accords par jeu dans Mes résultats
// 1.49.0 — Vocabulaire : « tour » pour une étape de partie (Tour 3/5, Tours 3·5·10, 12 tours en 60 s), « manche » réservé à la guitare ; « partie » au lieu de « challenge » dans Oreille ; boutons « Démarrer · <jeu> » partout
// 1.48.2 — Oreille › Accords : titre de section « ACCORDS » comme les familles de S’exercer
// 1.48.1 — Oreille › Accords : explication en texte simple (plus de cadre qui ressemblait à un jeu), mise en page alignée sur S’exercer › Challenges
// 1.48.0 — Oreille › Accords : choix des jeux comme dans S’exercer (aucun présélectionné, le jeu choisi se déplie avec ses questions, son record et le bouton Démarrer) ; « façon de jouer » déplacée dans Réglages › Entraînement
// 1.47.4 — Oreille › Accords : l’accord précédent s’éteint (fondu) avant le suivant et après une bonne réponse ; arrêt aussi en quittant / Stop ; Safari iPhone : horloge audio réveillée au démarrage
// 1.47.3 — Oreille › Accords : les notes de l’accord sonnent ensemble (lecture polyphonique ; avant, chaque note coupait la précédente), échantillons préchargés
// 1.47.2 — Oreille › Accords : retour possible depuis les résultats (la section restait bloquée sur son bilan) ; titre du bilan = nom de la section, flèche de retour vers les jeux
// 1.47.1 — Oreille : glissière Jouer / Résultats remplacée par une icône Résultats dans l’en-tête (comme S’exercer), masquée sur le bilan ; bilans : « Changer les réglages » devient « Retour aux jeux »
// 1.47.0 — Oreille : nouvelle section « Accords » (un accord est joué, choisir son type : majeur / mineur, 4 triades avec quintes diminuée et augmentée, accords 7, tout ; arpégé et/ou plaqué ; correction réécoutable)
// 1.46.1 — Challenges : phrase « Réponse : … » retirée ; Réglages : test du micro et diapason déplacés dans Audio
// 1.46.0 — Challenges : pause automatique (chrono arrêté, micro coupé) quand on change d’onglet ou que l’appli passe en arrière-plan, bouton Reprendre ; Débutant : tonalité au choix (C par défaut) ; Intermédiaire « tonalité au hasard » : option toniques sans ♯ ni ♭
// 1.45.1 — Réglages › Entraînement : test du micro (niveau du signal, note reconnue, fréquence, écart en cents, netteté, avec les seuils utilisés par les jeux)
// 1.45.0 — Challenges : note touchée = la note jouée, note trouvée à la guitare = « tic » très court ; micro plus tolérant (seuil de netteté abaissé pour les bonnes notes, correction des erreurs d’octave, signal plus faible accepté) ; positions 1 → 5 qui démarrent au hasard, tirage mieux mélangé
// 1.44.2 — Challenges : la liste des jeux s’affiche aussi quand aucun jeu n’est ouvert
// 1.44.1 — Challenges : jeux « tout le manche » démarrés une fois le téléphone tourné ; aucun jeu présélectionné (on peut refermer un jeu) ; dépliage animé du jeu choisi ; chrono visible en paysage (marge du menu + zone sûre)
// 1.44.0 — Trouve le degré : le jeu sélectionné s’ouvre avec ses réglages, ses manches et le bouton Démarrer ; Résultats en icône dans l’en-tête ; « Répondre » déplacé dans Réglages › Entraînement ; « Les piliers » aussi en Débutant (1-3-5)
// 1.43.2 — Trouve le degré : « Les piliers » passe en Intermédiaire (1-3-5-7, tonalité au hasard), placé avant « Les couleurs » ; « Les 7 degrés » après « Les couleurs »
// 1.43.1 — Challenges en paysage : tout le manche sur toute la largeur (cases aux vraies proportions, position encadrée et éclairée, le reste assombri) et consigne sur une seule ligne
// 1.43.0 — Challenges : petit son à chaque note trouvée ; nouveau manche « mini-carte + zoom » (tout le manche en petit aux vraies proportions avec la position encadrée, la position en grand avec une case de contexte de chaque côté et les repères 3-5-7-9-12)
// 1.42.1 — Challenges : colonne des cordes à vide touchable sur le web (elle était de largeur nulle : manche bloquée) ; degrés tirés « en sac » (chacun sort avant qu’un autre revienne) ; après 3 erreurs (5 sur tout le manche) la réponse s’affiche, chrono en pause, puis manche suivante
// 1.42.0 — « Trouve le degré » : niveaux Débutant / Intermédiaire / Expert avec catégories (manches réglables par niveau) + Perso ; tout le manche (5 positions, toniques affichées) ; contre-la-montre 60 s ; records par niveau/catégorie ; carte « Degré sur tout le manche » dans la bibliothèque
// 1.41.1 — Challenges : « Trouve le degré » toujours un degré par manche (option « tous à la fois » retirée) ; manche : la case 0 (corde à vide) est une colonne courte avant le sillet
// 1.41.0 — Challenges : « Trouve le degré » mélange les degrés (un degré différent à chaque manche, ou tous à la fois), 5/10/20 manches ; « Trouve la gamme » : 1 manche par défaut, et avec plusieurs manches une gamme différente à chaque manche
// 1.40.0 (refonte) — S’exercer : famille Challenges (Trouve le degré, Trouve la gamme) : position à remplir en jouant (micro) ou en touchant, tonique affichée pour les degrés, ordre libre ou montant, manches 3/5/10, records, résultats par degré et carte du manche
// 1.39.0 (refonte) — Oreille : « Travailler cette zone » sur la carte du manche, étiquette « Point faible · raison » pendant le challenge, encadré « Tes progrès » au bilan ; paysage : chrono et bouton Arrêter à côté du menu
// 1.38.0 (refonte) — Oreille : mode « Mes points faibles » (score de faiblesse : ratés récents, lenteur vs ta médiane, oubli ; 7 notes sur 10 parmi les points faibles) ; choix Au hasard / Mes points faibles + bouton dans Mes notes
// 1.37.1 (refonte) — Oreille : bouton « Voir mes résultats » sur le bilan de fin de challenge
// 1.37.0 (refonte) — Oreille : onglet Résultats (records 5/10/20 avec date, courbe des dernières parties, carte du manche Vitesse/Justesse, tops rapides/lentes/sûres/fragiles) ; historique local des réponses, effaçable dans Réglages
// 1.36.1 (refonte) — Oreille : bonne note à la mauvaise hauteur → « trop grave / trop aiguë, joue-la plus aiguë / grave (sur la corde …) », sans numéro d’octave
// 1.36.0 (refonte) — Oreille : après 2 ratés, la réponse reste affichée jusqu’à ce que la bonne note soit jouée (chrono en pause pendant ce temps ; « Passer » reste possible)
// 1.35.2 (refonte) — Oreille : son de réussite plus doux (deux notes rondes montantes, moins fort)
// 1.35.1 (refonte) — Oreille : son cristal quand la note est juste, son grave et doux quand elle est fausse (micro en pause pendant le son)
// 1.35.0 (refonte) — Oreille/Manche : après 2 ratés, petit manche (cases 0–12) sous la note pendant 3 s ; encadré « Joue la note sur ta guitare » retiré
// 1.34.5 (refonte) — paysage : métronome et Jouer regroupés dans un carré arrondi au style des pastilles de réglage
// 1.34.4 (refonte) — rangées de sélecteurs qui défilent : un « > » discret à droite tant qu’il reste des choix cachés (non cliquable, disparaît en fin de rangée)
// 1.34.3 (refonte) — Explorer portrait : le titre n’affiche plus la tonalité et la gamme / l’accord (déjà sur les pastilles)
// 1.34.2 (refonte) — Explorer : sélecteur Gammes / Accords retiré de l’écran (il reste dans le menu de la pastille Gamme / Accord)
// 1.34.1 (refonte) — portrait : les pastilles ne sont plus écrasées quand l’écran est plein ; Explorer : partition, couleurs et intervalles défilent entre le manche et la barre de lecture
// 1.34.0 (refonte) — Explorer harmonisé avec S’exercer : portrait = titre, Gammes / Accords, pastilles (tonalité, gamme, position, affichage), barre de lecture en bas ; paysage = une rangée en haut (Explorer, tonalité, Gamme · abrégé, position, affichage, tempo + ▶), couleurs des degrés dans Affichage
// 1.33.0 (refonte) — S’exercer s’ouvre sur la bibliothèque d’exercices (cartes par famille : Gammes, Arpèges, Triades ; filtres) ; une carte ouvre l’écran d’exercice réglé ; bouton retour ; le titre montre la description de l’exercice
// 1.32.0 (refonte) — paysage S’exercer : une rangée en haut (exercice, tonalité, gamme abrégée, position, tempo + ▶ dans une pastille), plus de rangée en bas ; Explorer : tempo + ▶ dans une pastille, gamme abrégée en paysage ; note jouée plus écrite (trop rapide)
// 1.31.4 (refonte) — correctif : toucher un onglet plantait (navigation absente sur le web) ; repli sur le routeur
// 1.31.3 (refonte) — paysage : barre d’onglets compacte en haut à droite (icônes), toute la hauteur pour le manche ; barre d’onglets maison partout (plus la barre native iOS 26)
// 1.31.2 (refonte) — reprend la 1.30.5 de main : backend FastAPI / MongoDB supprimés, app 100 % locale
// 1.31.1 (refonte) — feuille Tempo : − / valeur / + tiennent sur petit écran, valeur centrée
// 1.31.0 (branche refonte-ecran-exercice) — onglets Explorer / S’exercer ; S’exercer : titre = exercice, pastilles (tonalité, gamme, position, variante, affichage) qui ouvrent chacune leur réglage, barre de lecture en bas (boucle, métronome, tempo, ▶) ; en paysage pastilles + lecture sur une seule rangée
// 1.30.5 — suppression du backend FastAPI et de la base MongoDB (jamais utilisés) : l’app est 100 % locale
// 1.30.4 — menus : même transparence que la rosace (80 %, sans flou)
// 1.30.3 — menu Exercice : hauteur fixe (le haut du menu ne bouge plus entre Gammes / Arpèges / Paires de triades), rubriques des paires dans le même ordre
// 1.30.2 — popups de réglage unifiés (même cadre, en-tête, marges et ordre des rubriques) ; cadre en transparence (flou sur iOS / web)
// 1.30.1 — métronome : sons programmés sur l’horloge audio (Web Audio) sur le web ; une boucle dure toujours un nombre entier de temps (plus de demi-temps au raccord)
// 1.30.0 — Doigté : nouvelle matière « Paires de triades » (IV et V de la tonalité, 5 positions, variantes Up / Down / Alterné, en triolets) ; « Arpèges 4 sons » renommé « Arpèges » ; noms d’accords des triades renversées sur la partition
// 1.29.2 — tous les exercices : la descente est l’exact miroir de la montée (groupe du haut rejoué à l’envers)
// 1.29.1 — arpège sur 2 cordes : la descente reprend toute la montée à l’envers (la note du haut est jouée deux fois)
// 1.29.0 — Arpèges horizontaux : « 3 sons sur 2 cordes » (triade sur Mi-La, Ré-Sol, Si-Mi), avec ou sans la 7e en tête de groupe, pour ∆, 7, m7 et Ø
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
export const APP_VERSION = "1.52.0";
