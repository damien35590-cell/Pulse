/**
 * Catalogue d'exercices Pulse — données de référence.
 *
 * Sources :
 *  - Lafay, « Méthode de musculation – 110 exercices sans matériel » (tome 1, 2004) : codes, variantes,
 *    niveaux de difficulté (1 à 4 barres), pages, contenu des niveaux 1 à 7.
 *  - Lafay, « Optimisation Turbo » (tome 2, 2007) : exercices bonus, consignes « Ajouter des haltères ».
 *  - SuperPhysique (superphysique.org, article « Exercices avec barre vs avec haltères ») : noms classiques
 *    et exemple de split.
 *
 * Fichier : lib/workout/catalog-data.ts (helpers dans lib/workout/catalog.ts).
 * Usage strictement personnel (Pulse n'est pas diffusée). Les descriptifs sont rédigés pour Pulse,
 * pas recopiés des livres.
 */

export type ExerciseSource = 'lafay' | 'lafay-turbo' | 'superphysique';

/** Matériel requis. « Mon matériel » filtre le catalogue sur ces valeurs. */
export type Equipment =
  | 'aucun'
  | 'chaises'        // deux ou trois chaises stables
  | 'support'        // tabouret, canapé, cale de 15 à 45 cm
  | 'meuble-haut'    // meuble, rebord ou étagère d'environ 1 m
  | 'mur'
  | 'table'          // table solide ou barre basse (tirages horizontaux)
  | 'barres-dips'    // chaise romaine
  | 'barre-traction' // chaise romaine
  | 'baton'          // manche à balai
  | 'sangles'
  | 'halteres'
  | 'barre'
  | 'banc';

/** Matériel actuel de Damien (chaise romaine + maison). À exposer dans les réglages. */
export const DEFAULT_EQUIPMENT: Equipment[] = [
  'aucun', 'chaises', 'support', 'meuble-haut', 'mur', 'table', 'barres-dips', 'barre-traction', 'baton',
];

/** Muscles dessinés sur la carte du corps (components/body/body-map.tsx) ; libellés français dans lib/workout/body.ts. */
export type MuscleId =
  | 'chest' | 'front_delts' | 'side_delts' | 'rear_delts' | 'biceps' | 'triceps' | 'forearms'
  | 'abs' | 'obliques' | 'traps' | 'lats' | 'upper_back' | 'lower_back'
  | 'glutes' | 'quads' | 'hamstrings' | 'adductors' | 'calves' | 'neck';

/** Principaux : moteurs du mouvement. Secondaires : synergistes et stabilisateurs qui travaillent nettement. */
export interface Muscles { primary: MuscleId[]; secondary: MuscleId[] }
const mu = (primary: MuscleId[], secondary: MuscleId[] = []): Muscles => ({ primary, secondary });

// Muscles partagés par une famille ; une variante qui sollicite autre chose a les siens.
const PUSH = mu(['chest'], ['triceps', 'front_delts', 'abs']);          // pompes mains larges ou largeur d'épaules
const PUSH_CLOSE = mu(['chest', 'triceps'], ['front_delts', 'abs']);    // pompes mains serrées
const PUSH_DECLINE = mu(['chest', 'front_delts'], ['triceps', 'abs']);  // pieds hauts, rotation autour des épaules
const DIPS = mu(['chest', 'triceps'], ['front_delts']);
const CHIN_UP = mu(['lats', 'biceps'], ['upper_back', 'forearms']);     // tractions supination, prise serrée ou neutre
const PULL_WIDE = mu(['lats'], ['upper_back', 'biceps', 'forearms']);   // tractions prise large
const ROW_UNDER = mu(['upper_back', 'lats', 'biceps'], ['rear_delts', 'forearms']);
const ROW_OVER = mu(['upper_back', 'lats'], ['rear_delts', 'traps', 'biceps', 'forearms']);
const SINGLE_LEG = mu(['quads', 'glutes'], ['hamstrings', 'adductors']);
const SIDE_SQUAT = mu(['quads', 'adductors', 'glutes'], ['hamstrings']);
const WALL_SIT = mu(['quads'], ['glutes']);
const PIKE = mu(['front_delts', 'triceps'], ['side_delts', 'chest']);
const TRICEPS_EXT = mu(['triceps'], ['abs']);
const SIDE_BEND = mu(['obliques'], ['lower_back']);
const ONE_ARM = mu(['chest', 'triceps', 'front_delts'], ['abs', 'obliques']);
const ROTATION = mu(['obliques'], ['abs']);
const NECK = mu(['neck']);
const CRUNCH = mu(['abs'], ['obliques']);
const BENCH = mu(['chest'], ['triceps', 'front_delts']);
const CURL = mu(['biceps'], ['forearms']);
const LUNGE = mu(['quads', 'glutes'], ['hamstrings', 'adductors']);

/** reps = répétitions ; time = maintien ou durée en secondes (chrono au lieu du compteur). */
export type ExerciseMode = 'reps' | 'time';

export interface CatalogExercise {
  id: string;                 // code Lafay ('A3') ou slug ('rowing-un-bras-haltere')
  code?: string;              // Lafay uniquement, affiché en badge
  family: string;             // id de famille
  name: string;               // nom générique affiché
  subtitle?: string;          // ce qui distingue la variante, en quelques mots
  source: ExerciseSource;
  level?: 1 | 2 | 3 | 4;      // barres de difficulté du livre (1 débutant → 4 haut niveau)
  muscles: Muscles;
  equipment: Equipment[];
  mode: ExerciseMode;
  unilateral?: boolean;       // saisie par côté (droite / gauche)
  description: string;        // 3 phrases max : départ, mouvement, repère technique
  bookPage?: number;
}

export interface ExerciseFamily {
  id: string;
  letter?: string;            // Lafay uniquement
  name: string;
  source: ExerciseSource;
  /** Sous-catégories, chacune dans l'ordre de progression (du plus facile au plus dur) ; ordered: false = variantes sans ordre de difficulté. */
  groups: { name: string; progression: string[]; ordered?: false }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// FAMILLES
// ─────────────────────────────────────────────────────────────────────────────

export const FAMILIES: ExerciseFamily[] = [
  // Lafay
  { id: 'A', letter: 'A', name: 'Pompes', source: 'lafay', groups: [
    { name: 'Pompes larges', progression: ['A', 'A1', 'A2'] },
    { name: 'Pompes serrées', progression: ['A3', 'A4', 'A5', 'A6', 'A9', 'A12'] },
    { name: 'Pompes largeur d\'épaules', progression: ['A8', 'A7'] },
    { name: 'Pompes circulaires', progression: ['A10', 'A11'], ordered: false },
  ] },
  { id: 'B', letter: 'B', name: 'Dips', source: 'lafay', groups: [
    { name: 'Dips', progression: ['B1', 'B2', 'B'] },
  ] },
  { id: 'C', letter: 'C', name: 'Tractions supination', source: 'lafay', groups: [
    { name: 'Tractions', progression: ['C1', 'C2', 'C3', 'C'] },
    { name: 'Tirage sous table, paumes vers soi', progression: ['C4', 'C5', 'C6'] },
    { name: 'Tirage sous table, paumes vers l\'avant', progression: ['C7', 'C8', 'C9'] },
  ] },
  { id: 'D', letter: 'D', name: 'Dips entre deux chaises', source: 'lafay', groups: [
    { name: 'Dips arrière', progression: ['D'] },
  ] },
  { id: 'E', letter: 'E', name: 'Flexions de jambes', source: 'lafay', groups: [
    { name: 'Flexion sur une jambe', progression: ['E', 'E1', 'E3', 'E7', 'E2'] },
    { name: 'Jambes écartées', progression: ['E4', 'E5'] },
    { name: 'Squat trois positions', progression: ['E6'] },
  ] },
  { id: 'F', letter: 'F', name: 'Squat sauté et chaise', source: 'lafay', groups: [
    { name: 'Squat sauté', progression: ['F'] },
    { name: 'Maintien isométrique', progression: ['F1', 'F2', 'F3'] },
  ] },
  { id: 'G', letter: 'G', name: 'Crunch', source: 'lafay', groups: [{ name: 'Crunch', progression: ['G'] }] },
  { id: 'H', letter: 'H', name: 'Relevés de genoux suspendu', source: 'lafay', groups: [{ name: 'Relevés de genoux', progression: ['H'] }] },
  { id: 'I', letter: 'I', name: 'Tractions pronation', source: 'lafay', groups: [
    { name: 'Tractions prise large', progression: ['I', 'I1', 'I7', 'I2', 'I4'] },
    { name: 'Tractions prise serrée ou neutre', progression: ['I3', 'I5'], ordered: false },
    { name: 'Tirage sous table', progression: ['I6', 'I8'], ordered: false },
  ] },
  { id: 'J', letter: 'J', name: 'Pompes piquées (épaules)', source: 'lafay', groups: [
    { name: 'Mains à plat', progression: ['J', 'J1'] },
    { name: 'Sur les poings', progression: ['J2', 'J3'] },
  ] },
  { id: 'K', letter: 'K', name: 'Triceps', source: 'lafay', groups: [
    { name: 'Extensions triceps', progression: ['K2', 'K', 'K1', 'K3'] },
  ] },
  { id: 'L', letter: 'L', name: 'Pompes en rotation', source: 'lafay', groups: [{ name: 'Pompes en rotation', progression: ['L'] }] },
  { id: 'M', letter: 'M', name: 'Lombaires', source: 'lafay', groups: [{ name: 'Lombaires', progression: ['M1', 'M'] }] },
  { id: 'N', letter: 'N', name: 'Obliques', source: 'lafay', groups: [{ name: 'Flexions latérales', progression: ['N1', 'N'] }] },
  { id: 'O', letter: 'O', name: 'Crunch avec rotation', source: 'lafay', groups: [{ name: 'Crunch avec rotation', progression: ['O'] }] },
  { id: 'P', letter: 'P', name: 'Relevé de buste', source: 'lafay', groups: [{ name: 'Relevé de buste', progression: ['P'] }] },
  { id: 'Q', letter: 'Q', name: 'Pompes à un bras', source: 'lafay', groups: [{ name: 'Pompes à un bras', progression: ['Q', 'Q1', 'Q2'] }] },
  { id: 'R', letter: 'R', name: 'Abaissement des épaules', source: 'lafay', groups: [{ name: 'Abaissement des épaules', progression: ['R'] }] },
  { id: 'S', letter: 'S', name: 'Nuque', source: 'lafay', groups: [{ name: 'Nuque', progression: ['S'] }] },
  { id: 'T', letter: 'T', name: 'Rotations assis', source: 'lafay', groups: [{ name: 'Rotations assis', progression: ['T'] }] },
  { id: 'U', letter: 'U', name: 'Enroulement de colonne', source: 'lafay', groups: [{ name: 'Enroulement', progression: ['U'] }] },
  { id: 'V', letter: 'V', name: 'Essuie-glace', source: 'lafay', groups: [{ name: 'Essuie-glace', progression: ['V'] }] },
  { id: 'W', letter: 'W', name: 'Mollets sur une jambe', source: 'lafay', groups: [{ name: 'Mollets', progression: ['W'] }] },
  { id: 'X', letter: 'X', name: 'Rotations debout', source: 'lafay', groups: [{ name: 'Rotations debout', progression: ['X'] }] },
  { id: 'Y', letter: 'Y', name: 'Cou latéral', source: 'lafay', groups: [{ name: 'Cou', progression: ['Y'] }] },
  { id: 'Z', letter: 'Z', name: 'Pont', source: 'lafay', groups: [{ name: 'Pont', progression: ['Z'] }] },
  { id: 'turbo', name: 'Bonus Turbo', source: 'lafay-turbo', groups: [
    { name: 'Bonus', progression: ['turbo-curl-sangles', 'turbo-vacuum', 'turbo-nordic'], ordered: false },
  ] },
  // SuperPhysique (familles par groupe musculaire, pas de code)
  { id: 'sp-pecs', name: 'Pectoraux', source: 'superphysique', groups: [{ name: 'Développés', progression: ['developpe-couche-barre', 'developpe-couche-halteres', 'developpe-incline-halteres', 'pull-over-haltere'], ordered: false }] },
  { id: 'sp-dos', name: 'Dos', source: 'superphysique', groups: [{ name: 'Tirages', progression: ['rowing-un-bras-haltere', 'rowing-barre-pronation', 'rowing-yates-supination', 'shrug-halteres'], ordered: false }] },
  { id: 'sp-epaules', name: 'Épaules', source: 'superphysique', groups: [{ name: 'Épaules', progression: ['elevations-laterales', 'elevation-laterale-un-bras-incline', 'oiseau-haltere', 'developpe-militaire', 'developpe-assis-halteres'], ordered: false }] },
  { id: 'sp-bras', name: 'Bras', source: 'superphysique', groups: [
    { name: 'Biceps', progression: ['curl-halteres', 'curl-barre', 'curl-incline-halteres'], ordered: false },
    { name: 'Triceps', progression: ['extension-nuque-un-bras', 'tate-press'], ordered: false },
  ] },
  { id: 'sp-jambes', name: 'Jambes', source: 'superphysique', groups: [{ name: 'Jambes', progression: ['gobelet-squat', 'fentes-halteres', 'squat-bulgare', 'squat-barre', 'squat-avant', 'souleve-de-terre-jambes-tendues', 'mollets-debout-une-jambe'], ordered: false }] },
  { id: 'sp-abdos', name: 'Abdominaux', source: 'superphysique', groups: [{ name: 'Gainage et abdos', progression: ['gainage', 'gainage-oblique', 'enroulement-de-bassin'], ordered: false }] },
];

// ─────────────────────────────────────────────────────────────────────────────
// EXERCICES LAFAY (tome 1)
// ─────────────────────────────────────────────────────────────────────────────

const L = (e: Omit<CatalogExercise, 'id' | 'source' | 'family'> & { code: string }): CatalogExercise => ({
  id: e.code,
  family: e.code.replace(/[0-9]+$/, ''),
  source: 'lafay',
  ...e,
});

export const LAFAY_EXERCISES: CatalogExercise[] = [
  // A — Pompes
  L({ code: 'A', name: 'Pompes', subtitle: 'Au sol, mains larges', level: 1, muscles: PUSH, equipment: ['aucun'], mode: 'reps', bookPage: 138,
    description: 'Mains au sol à presque deux fois la largeur des épaules, corps gainé de la tête aux pieds. Descendre jusqu\'à frôler le sol avec la poitrine, remonter bras tendus. Ventre rentré, ne jamais cambrer.' }),
  L({ code: 'A1', name: 'Pompes', subtitle: 'Mains et pieds sur des chaises', level: 2, muscles: PUSH, equipment: ['chaises'], mode: 'reps', bookPage: 139,
    description: 'Mains écartées sur deux chaises, pieds sur une troisième à la même hauteur. Descendre le plus bas possible sans forcer l\'épaule, remonter bras tendus. Corps droit en permanence.' }),
  L({ code: 'A2', name: 'Pompes pieds surélevés', subtitle: 'Mains sur chaises, pieds à ~1 m', level: 2, muscles: PUSH_DECLINE, equipment: ['chaises', 'meuble-haut'], mode: 'reps', bookPage: 140,
    description: 'Mains larges sur deux chaises, pieds posés sur un meuble d\'environ 1 m. Descendre puis remonter en gardant le corps rigide. Si 1 m est trop dur, commencer à 60 cm et monter par paliers.' }),
  L({ code: 'A3', name: 'Pompes serrées', subtitle: 'Mains sur support de 45 cm', level: 1, muscles: PUSH_CLOSE, equipment: ['support'], mode: 'reps', bookPage: 141,
    description: 'Mains à 40 cm l\'une de l\'autre sur un support de 45 cm (deux chaises côte à côte), pieds au sol. Toucher le support avec la poitrine, remonter. Le corps reste droit.' }),
  L({ code: 'A4', name: 'Pompes serrées', subtitle: 'Mains sur support de 35 cm', level: 2, muscles: PUSH_CLOSE, equipment: ['support'], mode: 'reps', bookPage: 142,
    description: 'Même technique qu\'A3 avec un support plus bas (35 cm). Poitrine au contact du support à chaque répétition, ventre rentré.' }),
  L({ code: 'A5', name: 'Pompes serrées', subtitle: 'Mains sur support de 25 cm', level: 2, muscles: PUSH_CLOSE, equipment: ['support'], mode: 'reps', bookPage: 142,
    description: 'Même technique qu\'A3 avec un support de 25 cm. Garder le même écart de mains et un corps parfaitement aligné.' }),
  L({ code: 'A6', name: 'Pompes serrées', subtitle: 'Mains et pieds à même hauteur', level: 2, muscles: PUSH_CLOSE, equipment: ['support'], mode: 'reps', bookPage: 142,
    description: 'Mains et pieds sur deux supports de même hauteur (15 cm minimum), mains serrées. Descendre poitrine entre les mains, remonter. Corps bien droit, aucune cambrure.' }),
  L({ code: 'A7', name: 'Pompes', subtitle: 'Mains largeur d\'épaules, pieds surélevés', level: 2, muscles: PUSH, equipment: ['chaises'], mode: 'reps', bookPage: 143,
    description: 'Comme A1 mais mains à la largeur des épaules. Descendre profondément entre les chaises, remonter bras tendus.' }),
  L({ code: 'A8', name: 'Pompes', subtitle: 'Mains largeur d\'épaules, pieds au sol', level: 1, muscles: PUSH, equipment: ['chaises'], mode: 'reps', bookPage: 144,
    description: 'Mains sur deux chaises à la largeur des épaules, pieds au sol. Descendre le plus bas possible, cible le bas des pectoraux.' }),
  L({ code: 'A9', name: 'Pompes très serrées', subtitle: 'Mains sur 20 cm, pieds sur chaise', level: 3, muscles: mu(['triceps', 'chest'], ['front_delts', 'abs']), equipment: ['support', 'chaises'], mode: 'reps', bookPage: 145,
    description: 'Mains à 15 cm maximum sur un support de 20 cm, pieds sur une chaise. Toucher le support avec le haut de la poitrine, remonter. Corps droit.' }),
  L({ code: 'A10', name: 'Pompes circulaires', subtitle: 'Rotation autour des épaules', level: 2, muscles: PUSH_DECLINE, equipment: ['chaises'], mode: 'reps', bookPage: 146,
    description: 'Position d\'A7. Au lieu de descendre droit, faire tourner le corps autour de l\'axe des épaules tout en fléchissant et tendant les bras.' }),
  L({ code: 'A11', name: 'Pompes circulaires', subtitle: 'Rotation en sens inverse', level: 2, muscles: PUSH_DECLINE, equipment: ['chaises'], mode: 'reps', bookPage: 147,
    description: 'Comme A10, cercle dans l\'autre sens. Mouvement continu et contrôlé.' }),
  L({ code: 'A12', name: 'Pompes serrées pieds hauts', subtitle: 'Mains sur chaises, pieds à 1 m–1,10 m', level: 3, muscles: mu(['chest', 'triceps', 'front_delts'], ['abs']), equipment: ['chaises', 'meuble-haut'], mode: 'reps', bookPage: 148,
    description: 'Deux chaises côte à côte, mains à 40 cm, pieds sur un meuble d\'1 m à 1,10 m. Descendre poitrine au contact, remonter. Corps droit.' }),

  // B — Dips
  L({ code: 'B', name: 'Dips', subtitle: 'Amplitude complète', level: 2, muscles: DIPS, equipment: ['barres-dips'], mode: 'reps', bookPage: 149,
    description: 'En appui sur les barres parallèles, pieds décollés (jambes pliées si besoin). Descendre en flexion complète, remonter bras tendus.' }),
  L({ code: 'B1', name: 'Dips', subtitle: 'Demi-amplitude', level: 1, muscles: DIPS, equipment: ['barres-dips'], mode: 'reps', bookPage: 150,
    description: 'Partir bras tendus et descendre seulement jusqu\'à ce que les bras soient parallèles au sol, puis remonter. Ne pas descendre plus bas.' }),
  L({ code: 'B2', name: 'Dips', subtitle: 'Partie moyenne, rapide', level: 2, muscles: DIPS, equipment: ['barres-dips'], mode: 'reps', bookPage: 151,
    description: 'Autour de la position bras parallèles : descendre un peu en dessous, remonter un peu au-dessus, sans jamais tendre ni descendre à fond. Le plus vite possible.' }),

  // C — Tractions supination et tirages
  L({ code: 'C', name: 'Tractions', subtitle: 'Supination, amplitude complète', level: 2, muscles: CHIN_UP, equipment: ['barre-traction'], mode: 'reps', bookPage: 152,
    description: 'Mains largeur d\'épaules, paumes vers soi, suspendu bras tendus. Monter le menton au-dessus de la barre, redescendre bras tendus.' }),
  L({ code: 'C1', name: 'Tractions', subtitle: 'Moitié haute', level: 1, muscles: CHIN_UP, equipment: ['barre-traction'], mode: 'reps', bookPage: 153,
    description: 'Sauter pour démarrer menton au-dessus de la barre. Descendre jusqu\'aux bras parallèles au sol, remonter. Sans barre : remplacer par C5.' }),
  L({ code: 'C2', name: 'Tractions', subtitle: 'Partie moyenne, rapide', level: 2, muscles: CHIN_UP, equipment: ['barre-traction'], mode: 'reps', bookPage: 154,
    description: 'Comme C1 en descendant un peu plus bas et en remontant un peu plus haut, sans tendre les bras ni passer le menton. Le plus vite possible.' }),
  L({ code: 'C3', name: 'Tractions', subtitle: 'Deux tiers du mouvement', level: 2, muscles: CHIN_UP, equipment: ['barre-traction'], mode: 'reps', bookPage: 155,
    description: 'Technique de C sur les deux tiers de l\'amplitude : descendre assez bas sans tendre complètement les bras.' }),
  L({ code: 'C4', name: 'Tirage sous table', subtitle: 'Paumes vers soi, jambes repliées', level: 1, muscles: ROW_UNDER, equipment: ['table'], mode: 'reps', bookPage: 156,
    description: 'Allongé sous une table ou une barre basse, pieds rapprochés sous les fesses, genoux écartés. Tirer jusqu\'à toucher la barre avec le bas des pectoraux, haut du dos cambré, tête neutre.' }),
  L({ code: 'C5', name: 'Tirage sous table', subtitle: 'Paumes vers soi, jambes tendues', level: 2, muscles: ROW_UNDER, equipment: ['table'], mode: 'reps', bookPage: 157,
    description: 'Comme C4, jambes tendues devant soi, talons au sol. Corps gainé, poitrine vers la barre.' }),
  L({ code: 'C6', name: 'Tirage sous table', subtitle: 'Paumes vers soi, pieds sur chaise', level: 3, muscles: ROW_UNDER, equipment: ['table', 'chaises'], mode: 'reps', bookPage: 158,
    description: 'Comme C4, pieds posés sur une chaise d\'environ 45 cm. Corps aligné du talon aux épaules.' }),
  L({ code: 'C7', name: 'Tirage sous table', subtitle: 'Paumes vers l\'avant, jambes repliées', level: 1, muscles: ROW_OVER, equipment: ['table'], mode: 'reps', bookPage: 159,
    description: 'Comme C4 en prise pronation. Cible l\'épaisseur du haut du dos.' }),
  L({ code: 'C8', name: 'Tirage sous table', subtitle: 'Paumes vers l\'avant, jambes tendues', level: 2, muscles: ROW_OVER, equipment: ['table'], mode: 'reps', bookPage: 160,
    description: 'Jambes de C5, mains de C7. Tirer la poitrine vers la barre sans casser la ligne du corps.' }),
  L({ code: 'C9', name: 'Tirage sous table', subtitle: 'Paumes vers l\'avant, pieds sur chaise', level: 3, muscles: ROW_OVER, equipment: ['table', 'chaises'], mode: 'reps', bookPage: 161,
    description: 'Jambes de C6, mains de C7. Version la plus dure du tirage horizontal.' }),

  // D
  L({ code: 'D', name: 'Dips entre deux chaises', subtitle: 'Talons sur une chaise', level: 1, muscles: mu(['triceps'], ['front_delts', 'chest']), equipment: ['chaises'], mode: 'reps', bookPage: 162,
    description: 'Mains agrippées aux bords d\'une chaise derrière soi, talons sur une autre chaise à environ 1 m, jambes légèrement pliées. Descendre le plus bas possible, remonter bras tendus.' }),

  // E — Flexions de jambes
  L({ code: 'E', name: 'Flexion sur une jambe', subtitle: 'Petite amplitude, tenu au cadre de porte', level: 1, muscles: SINGLE_LEG, equipment: ['aucun'], mode: 'reps', unilateral: true, bookPage: 163,
    description: 'Debout dans un cadre de porte, mains posées du bout des doigts à hauteur de taille. Sur une jambe, petite flexion bien au-dessus de la parallèle, remonter jambe tendue. Une jambe entière puis l\'autre.' }),
  L({ code: 'E1', name: 'Flexion sur une jambe', subtitle: 'Jusqu\'à la parallèle', level: 2, muscles: SINGLE_LEG, equipment: ['aucun'], mode: 'reps', unilateral: true, bookPage: 164,
    description: 'Même position qu\'E, l\'autre jambe levée devant soi. Descendre jusqu\'à cuisse parallèle au sol, remonter sans tirer avec les bras.' }),
  L({ code: 'E2', name: 'Flexion sur une jambe', subtitle: 'Amplitude complète', level: 3, muscles: SINGLE_LEG, equipment: ['aucun'], mode: 'reps', unilateral: true, bookPage: 165,
    description: 'Technique d\'E1 en descendant le plus bas possible, puis remonter jusqu\'à jambe tendue.' }),
  L({ code: 'E3', name: 'Flexion sur une jambe', subtitle: 'Partie moyenne, rapide', level: 2, muscles: SINGLE_LEG, equipment: ['aucun'], mode: 'reps', unilateral: true, bookPage: 166,
    description: 'Descendre un peu sous la position moyenne et remonter sans tendre la jambe. Très vite, sans jamais se relever complètement.' }),
  L({ code: 'E4', name: 'Flexions latérales jambes écartées', subtitle: 'Alterné droite / gauche, durée', level: 1, muscles: SIDE_SQUAT, equipment: ['aucun'], mode: 'time', bookPage: 167,
    description: 'Debout jambes très écartées, plier une jambe en gardant l\'autre tendue, descendre au plus bas, remonter, puis changer de côté. Objectif : 3 minutes sans pause.' }),
  L({ code: 'E5', name: 'Flexions latérales jambes écartées', subtitle: 'Un côté à la fois, durée', level: 2, muscles: SIDE_SQUAT, equipment: ['aucun'], mode: 'time', unilateral: true, bookPage: 168,
    description: 'Comme E4 mais toujours sur la même jambe. Objectif : 3 minutes d\'un côté, repos 1 min 30 maximum, puis l\'autre côté.' }),
  L({ code: 'E6', name: 'Squat trois positions', subtitle: 'Pieds serrés, moyens, très écartés', level: 2, muscles: mu(['quads', 'glutes'], ['adductors', 'hamstrings']), equipment: ['aucun'], mode: 'time', bookPage: 169,
    description: 'Squats profonds avec 2 s de maintien en bas : 1 min pieds joints, 1 min pieds écartés pointes ouvertes, 1 min jambes très écartées, sans pause.' }),
  L({ code: 'E7', name: 'Flexion sur une jambe dos au mur', subtitle: 'Deux tiers du mouvement', level: 3, muscles: SINGLE_LEG, equipment: ['mur'], mode: 'reps', unilateral: true, bookPage: 170,
    description: 'Dos à un mur, descendre bien sous la parallèle sans plier complètement la jambe. Les mains touchent le mur une fraction de seconde pour l\'équilibre, la cuisse fait le travail.' }),

  // F — Squat sauté et isométrie
  L({ code: 'F', name: 'Squat sauté', level: 1, muscles: mu(['quads', 'glutes'], ['calves', 'hamstrings']), equipment: ['aucun'], mode: 'reps', bookPage: 171,
    description: 'Sauter le plus verticalement possible, atterrir sur l\'avant du pied en amortissant jusqu\'aux cuisses parallèles, et rebondir aussitôt. Plafond : 4 × 20, ensuite sauter plus haut.' }),
  L({ code: 'F1', name: 'Chaise contre le mur', subtitle: 'Maintien', level: 2, muscles: WALL_SIT, equipment: ['mur'], mode: 'time', bookPage: 172,
    description: 'Dos plaqué au mur, cuisses parallèles au sol. Tenir le plus longtemps possible. Objectif : 3 minutes.' }),
  L({ code: 'F2', name: 'Position du cavalier', subtitle: 'Maintien jambes écartées', level: 2, muscles: mu(['quads', 'glutes'], ['adductors', 'calves']), equipment: ['aucun'], mode: 'time', bookPage: 173,
    description: 'Debout jambes écartées, dos droit, cuisses presque parallèles au sol. Tenir. Objectif : 3 minutes d\'affilée.' }),
  L({ code: 'F3', name: 'Chaise sur une jambe', subtitle: 'Maintien unilatéral', level: 3, muscles: WALL_SIT, equipment: ['mur'], mode: 'time', unilateral: true, bookPage: 174,
    description: 'Comme F1, une seule jambe au sol, la cheville de l\'autre posée sur le genou. Objectif : 3 minutes par jambe.' }),

  // G, H
  L({ code: 'G', name: 'Crunch', level: 1, muscles: CRUNCH, equipment: ['aucun'], mode: 'reps', bookPage: 175,
    description: 'Allongé, cuisses à angle droit. S\'enrouler en rapprochant la poitrine du bassin sans décoller le bas du dos. Souffler et rentrer le ventre en montant.' }),
  L({ code: 'H', name: 'Relevés de genoux suspendu', level: 2, muscles: mu(['abs'], ['obliques', 'forearms']), equipment: ['barre-traction'], mode: 'reps', bookPage: 176,
    description: 'Suspendu à la barre, ramener les genoux pliés vers la poitrine, ventre rentré. Redescendre jusqu\'aux cuisses parallèles au sol, sans relâcher le ventre.' }),

  // I — Tractions pronation
  L({ code: 'I', name: 'Tractions prise large', subtitle: 'Nuque à la barre, petite amplitude', level: 2, muscles: PULL_WIDE, equipment: ['barre-traction'], mode: 'reps', bookPage: 177,
    description: 'Prise pronation à presque deux fois la largeur des épaules. Démarrer nuque contre la barre (sauter), descendre à peine et remonter, très vite. Barre longue à 1,80 m minimum.' }),
  L({ code: 'I1', name: 'Tractions prise large', subtitle: 'Jusqu\'aux bras parallèles', level: 2, muscles: PULL_WIDE, equipment: ['barre-traction'], mode: 'reps', bookPage: 178,
    description: 'Comme I, descendre jusqu\'aux bras parallèles au sol, jamais plus bas, et remonter le plus vite possible.' }),
  L({ code: 'I2', name: 'Tractions prise large', subtitle: 'Complète, nuque à la barre', level: 3, muscles: PULL_WIDE, equipment: ['barre-traction'], mode: 'reps', bookPage: 179,
    description: 'Position d\'I1, descendre bras tendus puis remonter jusqu\'au contact de la nuque avec la barre.' }),
  L({ code: 'I3', name: 'Tractions pronation', subtitle: 'Mains largeur d\'épaules', level: 2, muscles: CHIN_UP, equipment: ['barre-traction'], mode: 'reps', bookPage: 180,
    description: 'Technique de C avec les paumes vers l\'avant. Amplitude au choix selon le besoin : complète, moitié ou deux tiers.' }),
  L({ code: 'I4', name: 'Tractions prise large', subtitle: 'Complète, menton au-dessus', level: 3, muscles: PULL_WIDE, equipment: ['barre-traction'], mode: 'reps', bookPage: 181,
    description: 'Comme I2 mais en passant le menton au-dessus de la barre, devant. Ne pas basculer la tête en arrière pour gagner les derniers centimètres.' }),
  L({ code: 'I5', name: 'Tractions prise neutre', subtitle: 'Paumes face à face', level: 2, muscles: CHIN_UP, equipment: ['barre-traction'], mode: 'reps', bookPage: 182,
    description: 'Paumes face à face (poignées, sangles ou anneaux). Descendre bras tendus, monter le menton au-dessus.' }),
  L({ code: 'I6', name: 'Tirage sous table', subtitle: 'Prise neutre', level: 1, muscles: mu(['upper_back', 'lats'], ['biceps', 'rear_delts', 'forearms']), equipment: ['table'], mode: 'reps', bookPage: 183,
    description: 'Technique de C4, paumes face à face (bords d\'une table). Jambes repliées, puis tendues, puis pieds surélevés au-delà de 15 répétitions.' }),
  L({ code: 'I7', name: 'Tractions prise large', subtitle: 'Deux tiers du mouvement', level: 3, muscles: PULL_WIDE, equipment: ['barre-traction'], mode: 'reps', bookPage: 184,
    description: 'Comme I1 sur les deux tiers : descendre jusqu\'aux bras presque tendus.' }),
  L({ code: 'I8', name: 'Tirage sous table', subtitle: 'Prise large pronation', level: 1, muscles: mu(['upper_back', 'rear_delts'], ['lats', 'biceps', 'traps']), equipment: ['table'], mode: 'reps', bookPage: 185,
    description: 'Technique de C4, mains à deux fois la largeur des épaules, paumes vers l\'avant.' }),

  // J — Pompes piquées
  L({ code: 'J', name: 'Pompes piquées pieds surélevés', subtitle: 'Mains larges', level: 3, muscles: PIKE, equipment: ['chaises', 'meuble-haut'], mode: 'reps', bookPage: 186,
    description: 'Mains larges sur deux chaises, pieds sur un support d\'1 m, fesses vers le plafond (corps plié). Descendre la tête entre les mains, remonter. Cible les épaules.' }),
  L({ code: 'J1', name: 'Pompes piquées pieds surélevés', subtitle: 'Mains un peu plus larges que les épaules', level: 3, muscles: PIKE, equipment: ['chaises', 'meuble-haut'], mode: 'reps', bookPage: 187,
    description: 'Comme J, mains plus rapprochées. Passer à J1 au-delà de 15 répétitions à J.' }),
  L({ code: 'J2', name: 'Pompes piquées pieds surélevés', subtitle: 'Sur les poings, mains larges', level: 3, muscles: PIKE, equipment: ['chaises', 'meuble-haut'], mode: 'reps', bookPage: 188,
    description: 'J sur les poings alignés, une serviette pliée sous les poings si le support est dur.' }),
  L({ code: 'J3', name: 'Pompes piquées pieds surélevés', subtitle: 'Sur les poings, mains rapprochées', level: 3, muscles: PIKE, equipment: ['chaises', 'meuble-haut'], mode: 'reps', bookPage: 189,
    description: 'J1 sur les poings.' }),

  // K — Triceps
  L({ code: 'K', name: 'Extension triceps au sol', subtitle: 'Coudes au sol, amplitude réglable', level: 1, muscles: TRICEPS_EXT, equipment: ['aucun'], mode: 'reps', bookPage: 190,
    description: 'Coudes au sol écartés largeur d\'épaules, mains à plat un peu en avant de la tête. Tendre les bras sans décoller les paumes. Amplitude 1/3, 1/2, 2/3 ou complète ; coudes serrés.' }),
  L({ code: 'K1', name: 'Extension triceps à la table', subtitle: 'Pieds à ~1,30 m', level: 2, muscles: TRICEPS_EXT, equipment: ['table'], mode: 'reps', bookPage: 191,
    description: 'Mains sur le bord d\'une table ou barre à 1 m, sur la pointe des pieds à environ 1,30 m. Flexion complète des bras puis extension, sans à-coups. 20 répétitions : support plus bas.' }),
  L({ code: 'K2', name: 'Extension triceps au mur', subtitle: 'Hauteur des mains réglable', level: 1, muscles: mu(['triceps']), equipment: ['mur'], mode: 'reps', bookPage: 192,
    description: 'Face au mur, mains à environ 1,50 m, sur la pointe des pieds. Fléchir jusqu\'à toucher le mur avec la tête et les avant-bras, revenir. 15 répétitions à la 1re série : mains 10 cm plus bas.' }),
  L({ code: 'K3', name: 'Extension triceps prise supination', subtitle: 'Barre basse entre deux chaises', level: 4, muscles: TRICEPS_EXT, equipment: ['chaises', 'table'], mode: 'reps', bookPage: 194,
    description: 'Comme K1, paumes tournées vers soi sur une barre ou une sangle à 45 cm du sol, chaises calées contre un mur.' }),

  // L à Z
  L({ code: 'L', name: 'Pompes en rotation', subtitle: 'Alterné droite / gauche', level: 2, muscles: mu(['chest', 'triceps'], ['front_delts', 'abs']), equipment: ['aucun'], mode: 'reps', bookPage: 195,
    description: 'Départ de pompe A. Descendre en basculant le poids sur le bras droit qui fléchit, remonter, puis à gauche. Descendre le plus bas possible.' }),
  L({ code: 'M', name: 'Extension lombaire sur support', level: 2, muscles: mu(['lower_back'], ['glutes', 'hamstrings']), equipment: ['meuble-haut'], mode: 'reps', bookPage: 196,
    description: 'Allongé sur le ventre sur un support d\'environ 1,10 m, hanches qui dépassent, pieds calés. Descendre le buste puis remonter jusqu\'à l\'horizontale, dos droit.' }),
  L({ code: 'M1', name: 'Good morning au poids du corps', level: 1, muscles: mu(['hamstrings', 'lower_back'], ['glutes']), equipment: ['aucun'], mode: 'reps', bookPage: 197,
    description: 'Debout jambes légèrement pliées, bras dans le prolongement du buste. Se pencher jusqu\'au buste parallèle au sol, remonter. Ne jamais arrondir le dos.' }),
  L({ code: 'N', name: 'Flexion latérale sur support', level: 3, muscles: SIDE_BEND, equipment: ['support'], mode: 'reps', unilateral: true, bookPage: 198,
    description: 'Couché sur le côté sur un support de 40 cm minimum, buste dans le vide à partir des hanches, pieds calés. Descendre le buste sur le côté puis remonter le plus haut possible.' }),
  L({ code: 'N1', name: 'Flexion latérale au sol', level: 1, muscles: SIDE_BEND, equipment: ['aucun'], mode: 'reps', unilateral: true, bookPage: 199,
    description: 'Allongé sur le côté sur un tapis, monter le buste le plus haut possible sans à-coups.' }),
  L({ code: 'O', name: 'Crunch avec rotation', level: 2, muscles: mu(['abs', 'obliques']), equipment: ['aucun'], mode: 'reps', bookPage: 200,
    description: 'Sur le dos, jambes pliées, pieds à plat. Se relever en tournant pour amener le coude vers le genou opposé. Les épaules ne retouchent pas le sol.' }),
  L({ code: 'P', name: 'Relevé de buste', level: 2, muscles: CRUNCH, equipment: ['aucun'], mode: 'reps', bookPage: 201,
    description: 'Sur le dos, jambes fléchies. Se relever jusqu\'à toucher les cuisses, redescendre sans reposer les épaules. Aide des bras au début, puis mains derrière la tête au-delà de 15.' }),
  L({ code: 'Q', name: 'Pompes à un bras', subtitle: 'Main sur une chaise', level: 3, muscles: ONE_ARM, equipment: ['chaises'], mode: 'reps', unilateral: true, bookPage: 202,
    description: 'Une main sur une chaise, jambes tendues et écartées. Descendre le plus bas possible, l\'épaule arrive à hauteur de la main. Ne pas reculer les fesses.' }),
  L({ code: 'Q1', name: 'Pompes à un bras', subtitle: 'Main sur support de 25 cm', level: 4, muscles: ONE_ARM, equipment: ['support'], mode: 'reps', unilateral: true, bookPage: 203,
    description: 'Comme Q, corps le plus droit possible : la jambe du côté de l\'appui dans le prolongement, l\'autre à l\'équerre pour l\'équilibre.' }),
  L({ code: 'Q2', name: 'Pompes à un bras', subtitle: 'Au sol', level: 4, muscles: ONE_ARM, equipment: ['aucun'], mode: 'reps', unilateral: true, bookPage: 204,
    description: 'Technique de Q1 au sol, sans support.' }),
  L({ code: 'R', name: 'Abaissement des épaules', level: 2, muscles: mu(['traps'], ['lats']), equipment: ['barres-dips'], mode: 'reps', bookPage: 205,
    description: 'En appui bras tendus sur les barres parallèles, pieds décollés. Hausser les épaules puis les abaisser au maximum : le corps monte. Lent et concentré.' }),
  L({ code: 'S', name: 'Nuque sur banc', level: 2, muscles: NECK, equipment: ['banc'], mode: 'reps', bookPage: 206,
    description: 'Allongé sur un banc ou une chaise, tête dans le vide. Laisser descendre la tête en arrière sans forcer, remonter menton vers la poitrine. Deux séries, 40 s de repos.' }),
  L({ code: 'T', name: 'Rotations du buste assis', level: 1, muscles: ROTATION, equipment: ['baton'], mode: 'time', bookPage: 207,
    description: 'Assis, pieds calés, bâton derrière les épaules. Rotations droite-gauche le plus loin possible sans forcer la colonne. Respirer librement.' }),
  L({ code: 'U', name: 'Enroulement de colonne', level: 1, muscles: mu(['abs'], ['lower_back']), equipment: ['aucun'], mode: 'time', bookPage: 208,
    description: 'Sur le dos, jambes presque tendues au-dessus du ventre. Enrouler la colonne pour passer les pieds au-dessus de la tête. Serviette sous les épaules.' }),
  L({ code: 'V', name: 'Essuie-glace', level: 2, muscles: ROTATION, equipment: ['aucun'], mode: 'time', bookPage: 209,
    description: 'Sur le dos, jambes presque tendues à la verticale, bassin ramené vers la tête. Basculer les jambes d\'un côté à l\'autre sans creuser les reins. Objectif : 3 minutes.' }),
  L({ code: 'W', name: 'Mollets sur une jambe', level: 2, muscles: mu(['calves']), equipment: ['support'], mode: 'reps', unilateral: true, bookPage: 210,
    description: 'Sur une cale de 15 cm minimum, sur un pied, une main au mur pour l\'équilibre. Descendre talon au plus bas puis monter sur la pointe, lentement.' }),
  L({ code: 'X', name: 'Rotations du buste debout', level: 1, muscles: ROTATION, equipment: ['baton'], mode: 'time', bookPage: 211,
    description: 'Debout ou assis haut, bâton derrière les épaules, bassin bloqué. Rotations lentes et régulières, s\'arrêter dès la première résistance.' }),
  L({ code: 'Y', name: 'Rotation du cou allongé', level: 2, muscles: NECK, equipment: ['aucun'], mode: 'reps', bookPage: 212,
    description: 'Allongé sur le côté, coussin sous les côtes, bras dans le prolongement du corps. Tourner lentement la tête vers le haut, sans jamais forcer.' }),
  L({ code: 'Z', name: 'Pont', level: 2, muscles: mu(['lower_back'], ['glutes', 'triceps', 'front_delts']), equipment: ['aucun'], mode: 'reps', bookPage: 213,
    description: 'Sur le dos, pieds à plat, mains à plat près des oreilles. Monter le bassin puis tendre les bras pour arquer le dos. 10 répétitions en fin de séance.' }),
];

// ─────────────────────────────────────────────────────────────────────────────
// BONUS TURBO (tome 2) — pas de code dans le livre
// ─────────────────────────────────────────────────────────────────────────────

export const TURBO_EXERCISES: CatalogExercise[] = [
  { id: 'turbo-curl-sangles', family: 'turbo', name: 'Curl biceps aux sangles', source: 'lafay-turbo', muscles: CURL, equipment: ['sangles', 'barre-traction'], mode: 'reps', bookPage: 98,
    description: 'Deux sangles fixées au moins 20 cm au-dessus de la tête, paumes vers le haut, pieds sous la barre. Se laisser partir en arrière bras tendus, puis fléchir les avant-bras sans bouger les coudes. Allonger la sangle de 10 cm si c\'est trop facile.' },
  { id: 'turbo-vacuum', family: 'turbo', name: 'Transverse à quatre pattes', subtitle: 'Vacuum', source: 'lafay-turbo', muscles: mu(['abs']), equipment: ['aucun'], mode: 'reps', bookPage: 100,
    description: 'À quatre pattes, bas du dos légèrement creusé. Inspirer en laissant le ventre descendre, puis souffler fort en rentrant le ventre au maximum, tenir 2 s. Lent et contrôlé ; viser 15 répétitions sur 3 séries.' },
  { id: 'turbo-nordic', family: 'turbo', name: 'Ischios à genoux', subtitle: 'Nordic curl', source: 'lafay-turbo', muscles: mu(['hamstrings'], ['calves']), equipment: ['table'], mode: 'reps', bookPage: 102,
    description: 'À genoux sur un tapis, chevilles bloquées sous une barre basse. Descendre le buste en freinant au maximum, se réceptionner en pompe, remonter en s\'aidant des bras. Très difficile : progresser par l\'amplitude.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUPERPHYSIQUE — noms classiques, poids libres uniquement (pas de machines ni de poulies)
// ─────────────────────────────────────────────────────────────────────────────

const SP = (e: Omit<CatalogExercise, 'source'>): CatalogExercise => ({ source: 'superphysique', ...e });

export const SUPERPHYSIQUE_EXERCISES: CatalogExercise[] = [
  SP({ id: 'developpe-couche-barre', family: 'sp-pecs', name: 'Développé couché', subtitle: 'Barre', muscles: BENCH, equipment: ['barre', 'banc'], mode: 'reps',
    description: 'Allongé sur le banc, omoplates serrées, pieds au sol. Descendre la barre contrôlée jusqu\'au bas des pectoraux, pousser. Avec pareur ou sécurités.' }),
  SP({ id: 'developpe-couche-halteres', family: 'sp-pecs', name: 'Développé couché', subtitle: 'Haltères', muscles: BENCH, equipment: ['halteres', 'banc'], mode: 'reps',
    description: 'Comme à la barre avec une trajectoire convergente : plus d\'étirement en bas, plus de contraction en haut. Environ moitié du poids de la barre moins 15 % par haltère.' }),
  SP({ id: 'developpe-incline-halteres', family: 'sp-pecs', name: 'Développé incliné', subtitle: 'Haltères', muscles: mu(['chest', 'front_delts'], ['triceps']), equipment: ['halteres', 'banc'], mode: 'reps',
    description: 'Banc incliné à 30–45°. Descendre les haltères à hauteur du haut des pectoraux, coudes sous les poignets, pousser en rapprochant.' }),
  SP({ id: 'pull-over-haltere', family: 'sp-pecs', name: 'Pull-over', subtitle: 'Haltère', muscles: mu(['lats', 'chest'], ['triceps']), equipment: ['halteres', 'banc'], mode: 'reps',
    description: 'Allongé, un haltère tenu à deux mains au-dessus de la poitrine, bras presque tendus. Descendre derrière la tête en ouvrant la cage thoracique, revenir.' }),
  SP({ id: 'rowing-un-bras-haltere', family: 'sp-dos', name: 'Rowing un bras', subtitle: 'Haltère', muscles: mu(['lats', 'upper_back'], ['biceps', 'rear_delts', 'forearms']), equipment: ['halteres'], mode: 'reps', unilateral: true,
    description: 'Une main et un genou en appui, dos plat. Tirer l\'haltère vers la hanche en gardant le coude près du corps, redescendre bras tendu pour bien étirer.' }),
  SP({ id: 'rowing-barre-pronation', family: 'sp-dos', name: 'Rowing barre', subtitle: 'Pronation', muscles: mu(['upper_back', 'lats'], ['rear_delts', 'biceps', 'lower_back']), equipment: ['barre'], mode: 'reps',
    description: 'Buste penché à environ 45°, dos plat, genoux fléchis. Tirer la barre vers le nombril, coudes en arrière, redescendre contrôlé.' }),
  SP({ id: 'rowing-yates-supination', family: 'sp-dos', name: 'Rowing Yates', subtitle: 'Barre, supination', muscles: mu(['lats', 'upper_back'], ['biceps', 'lower_back']), equipment: ['barre'], mode: 'reps',
    description: 'Buste plus redressé (environ 30° vers l\'avant), paumes vers le haut. Tirer la barre au bas du ventre, coudes serrés.' }),
  SP({ id: 'shrug-halteres', family: 'sp-dos', name: 'Shrug', subtitle: 'Haltères, prise neutre', muscles: mu(['traps'], ['forearms']), equipment: ['halteres'], mode: 'reps',
    description: 'Debout, haltères le long du corps. Hausser les épaules vers les oreilles sans plier les bras, tenir 1 s, redescendre.' }),
  SP({ id: 'elevations-laterales', family: 'sp-epaules', name: 'Élévations latérales', subtitle: 'Haltères', muscles: mu(['side_delts'], ['traps']), equipment: ['halteres'], mode: 'reps',
    description: 'Debout, coudes légèrement fléchis. Monter les haltères sur les côtés jusqu\'à l\'horizontale, sans élan, redescendre lentement.' }),
  SP({ id: 'elevation-laterale-un-bras-incline', family: 'sp-epaules', name: 'Élévation latérale un bras', subtitle: 'Sur banc incliné', muscles: mu(['side_delts']), equipment: ['halteres', 'banc'], mode: 'reps', unilateral: true,
    description: 'Allongé sur le côté sur un banc incliné. Monter l\'haltère jusqu\'à la verticale du bras, redescendre contrôlé : tension constante.' }),
  SP({ id: 'oiseau-haltere', family: 'sp-epaules', name: 'Oiseau', subtitle: 'Haltères', muscles: mu(['rear_delts'], ['upper_back', 'traps']), equipment: ['halteres'], mode: 'reps',
    description: 'Buste penché presque à l\'horizontale. Écarter les bras sur les côtés coudes légèrement fléchis, serrer l\'arrière des épaules.' }),
  SP({ id: 'developpe-militaire', family: 'sp-epaules', name: 'Développé militaire', subtitle: 'Barre, debout', muscles: mu(['front_delts'], ['side_delts', 'triceps', 'traps']), equipment: ['barre'], mode: 'reps',
    description: 'Debout, gainé, barre au niveau des clavicules. Pousser au-dessus de la tête en passant le visage, verrouiller, redescendre.' }),
  SP({ id: 'developpe-assis-halteres', family: 'sp-epaules', name: 'Développé assis', subtitle: 'Haltères', muscles: mu(['front_delts'], ['side_delts', 'triceps']), equipment: ['halteres', 'banc'], mode: 'reps',
    description: 'Assis dos calé, haltères à hauteur d\'oreilles. Pousser vers le haut en rapprochant, redescendre sous le niveau des oreilles.' }),
  SP({ id: 'curl-halteres', family: 'sp-bras', name: 'Curl', subtitle: 'Haltères', muscles: CURL, equipment: ['halteres'], mode: 'reps',
    description: 'Debout, coudes collés au corps. Fléchir en tournant la paume vers le haut, redescendre bras tendu sans balancer.' }),
  SP({ id: 'curl-barre', family: 'sp-bras', name: 'Curl', subtitle: 'Barre droite ou EZ', muscles: CURL, equipment: ['barre'], mode: 'reps',
    description: 'Debout, prise largeur d\'épaules. Monter la barre sans avancer les coudes ni basculer le buste.' }),
  SP({ id: 'curl-incline-halteres', family: 'sp-bras', name: 'Curl incliné', subtitle: 'Haltères', muscles: CURL, equipment: ['halteres', 'banc'], mode: 'reps',
    description: 'Assis sur banc incliné, bras pendants en arrière du buste. Fléchir sans avancer les coudes : étirement maximal du biceps.' }),
  SP({ id: 'extension-nuque-un-bras', family: 'sp-bras', name: 'Extension nuque un bras', subtitle: 'Haltère', muscles: mu(['triceps']), equipment: ['halteres'], mode: 'reps', unilateral: true,
    description: 'Haltère tenu au-dessus de la tête, coude pointé vers le plafond. Descendre derrière la nuque, tendre le bras sans bouger le coude.' }),
  SP({ id: 'tate-press', family: 'sp-bras', name: 'Tate press', subtitle: 'Haltère', muscles: mu(['triceps']), equipment: ['halteres', 'banc'], mode: 'reps',
    description: 'Allongé, haltère au-dessus de la poitrine, coude ouvert vers l\'extérieur. Descendre l\'haltère vers le sternum, tendre.' }),
  SP({ id: 'gobelet-squat', family: 'sp-jambes', name: 'Gobelet squat', subtitle: 'Haltère', muscles: mu(['quads', 'glutes'], ['adductors', 'abs']), equipment: ['halteres'], mode: 'reps',
    description: 'Haltère tenu verticalement contre la poitrine. Descendre entre les genoux, buste droit, talons au sol, remonter.' }),
  SP({ id: 'fentes-halteres', family: 'sp-jambes', name: 'Fentes', subtitle: 'Haltères', muscles: LUNGE, equipment: ['halteres'], mode: 'reps', unilateral: true,
    description: 'Grand pas en avant, descendre le genou arrière près du sol, buste droit, repousser sur le talon avant.' }),
  SP({ id: 'squat-bulgare', family: 'sp-jambes', name: 'Squat bulgare', subtitle: 'Haltères', muscles: LUNGE, equipment: ['halteres', 'banc'], mode: 'reps', unilateral: true,
    description: 'Pied arrière posé sur un banc ou une chaise. Descendre verticalement sur la jambe avant, genou dans l\'axe du pied.' }),
  SP({ id: 'squat-barre', family: 'sp-jambes', name: 'Squat', subtitle: 'Barre', muscles: mu(['quads', 'glutes'], ['hamstrings', 'adductors', 'lower_back']), equipment: ['barre'], mode: 'reps',
    description: 'Barre sur les trapèzes, pieds largeur d\'épaules. Descendre hanches en arrière jusqu\'à la parallèle, dos neutre, remonter. Nécessite un rack.' }),
  SP({ id: 'squat-avant', family: 'sp-jambes', name: 'Squat avant', subtitle: 'Barre', muscles: mu(['quads'], ['glutes', 'abs', 'upper_back']), equipment: ['barre'], mode: 'reps',
    description: 'Barre posée sur l\'avant des épaules, coudes hauts. Descendre buste très droit, remonter. Nécessite un rack.' }),
  SP({ id: 'souleve-de-terre-jambes-tendues', family: 'sp-jambes', name: 'Soulevé de terre jambes tendues', subtitle: 'Barre ou haltères', muscles: mu(['hamstrings', 'glutes'], ['lower_back', 'forearms']), equipment: ['halteres'], mode: 'reps',
    description: 'Jambes presque tendues, dos plat. Descendre la charge le long des jambes en reculant les hanches jusqu\'à l\'étirement des ischios, remonter.' }),
  SP({ id: 'mollets-debout-une-jambe', family: 'sp-jambes', name: 'Mollets debout une jambe', subtitle: 'Haltère', muscles: mu(['calves']), equipment: ['halteres', 'support'], mode: 'reps', unilateral: true,
    description: 'Sur une marche, un haltère dans la main du côté qui travaille. Descendre talon au plus bas, monter sur la pointe, pause en haut.' }),
  SP({ id: 'gainage', family: 'sp-abdos', name: 'Gainage abdominal', muscles: mu(['abs'], ['obliques']), equipment: ['aucun'], mode: 'time',
    description: 'En appui sur les avant-bras et la pointe des pieds, corps aligné, fessiers serrés. Tenir le plus longtemps possible.' }),
  SP({ id: 'gainage-oblique', family: 'sp-abdos', name: 'Gainage oblique', muscles: mu(['obliques'], ['abs']), equipment: ['aucun'], mode: 'time', unilateral: true,
    description: 'Sur le côté, appui avant-bras et pieds, bassin haut. Tenir de chaque côté.' }),
  SP({ id: 'enroulement-de-bassin', family: 'sp-abdos', name: 'Enroulement de bassin', muscles: mu(['abs']), equipment: ['aucun'], mode: 'reps',
    description: 'Sur le dos, jambes pliées en l\'air. Enrouler le bassin pour décoller les fesses vers le haut, redescendre lentement.' }),
];

export const ALL_EXERCISES: CatalogExercise[] = [...LAFAY_EXERCISES, ...TURBO_EXERCISES, ...SUPERPHYSIQUE_EXERCISES];

// ─────────────────────────────────────────────────────────────────────────────
// MODÈLES DE PROGRAMME
// ─────────────────────────────────────────────────────────────────────────────

export interface TemplateExercise {
  exerciseId: string;
  /** Variantes équivalentes au choix (ex. A3 à A6 selon le niveau atteint). */
  alternatives?: string[];
  sets: number;
  /** Reps de départ (ou secondes si mode time). null = maximum possible. */
  reps: number | null;
  repsMax?: number;          // haut de fourchette (SuperPhysique)
  restSec: number;           // repos entre séries
  restAfterSec?: number;     // repos avant l'exercice suivant
  note?: string;
}

export interface TemplateSession { name: string; exercises: TemplateExercise[] }

export interface ProgramTemplate {
  id: string;
  name: string;
  source: ExerciseSource | 'perso';
  /** « inspiré de » quand le modèle est une adaptation et non le contenu exact d'une source. */
  inspired?: boolean;
  frequency: string;
  progression: string;
  sessions: TemplateSession[];
  requires?: Equipment[];
  bookRef?: string;
}

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  // ── Lafay, tome 1 ──
  {
    id: 'lafay-n1-p1', name: 'Lafay · Niveau 1, programme 1', source: 'lafay',
    frequency: '3 séances/semaine (lun-mer-ven)', bookRef: 'Tome 1 p. 40',
    progression: 'Pour qui fait 0 à 4 dips au test B. 2 séries la 1re semaine puis 3. A1 → A2 dès 8 reps ; ensuite A3 → A4 → A5 → A6. Retest B à 8 reps sur A6.',
    sessions: [{ name: 'Séance de base', exercises: [
      { exerciseId: 'A1', sets: 2, reps: null, restSec: 120, note: 'Remplacer par A2 dès 8 répétitions' },
      { exerciseId: 'D', sets: 2, reps: null, restSec: 120 },
      { exerciseId: 'C1', sets: 2, reps: null, restSec: 120, note: 'Rythme rapide. Trop dur : C4 → C5 → C6' },
      { exerciseId: 'E', sets: 2, reps: null, restSec: 120, note: 'Max 60 reps par série' },
      { exerciseId: 'F', sets: 2, reps: null, restSec: 120, note: 'Max 20 reps, puis sauter plus haut' },
      { exerciseId: 'G', sets: 2, reps: null, restSec: 120 },
      { exerciseId: 'K2', sets: 2, reps: 12, restSec: 120, note: 'Hauteur des mains pour 12 reps max' },
    ] }],
  },
  {
    id: 'lafay-n1-p2', name: 'Lafay · Niveau 1, programme 2', source: 'lafay',
    frequency: '3 séances/semaine (ou 2 en remise en forme)', bookRef: 'Tome 1 p. 42',
    progression: 'Pour qui fait 5 à 7 dips au test B. Objectif : 8 à 10 reps à B à la 1re série → niveau 2.',
    sessions: [{ name: 'Séance', exercises: [
      { exerciseId: 'B', sets: 3, reps: null, restSec: 120 },
      { exerciseId: 'A1', sets: 3, reps: null, restSec: 120, note: 'A2 dès 8 reps' },
      { exerciseId: 'D', sets: 1, reps: null, restSec: 120 },
      { exerciseId: 'C1', sets: 3, reps: null, restSec: 120, note: 'C3 dès 10 à 15 reps' },
      { exerciseId: 'E', sets: 3, reps: null, restSec: 120, note: 'E1 dès 15 reps' },
      { exerciseId: 'F', sets: 3, reps: null, restSec: 120 },
      { exerciseId: 'G', sets: 3, reps: null, restSec: 120 },
      { exerciseId: 'K2', sets: 3, reps: 12, restSec: 120 },
    ] }],
  },
  {
    id: 'lafay-n2', name: 'Lafay · Niveau 2', source: 'lafay',
    frequency: '3 séances/semaine (4 la 1re semaine)', bookRef: 'Tome 1 p. 45',
    progression: '+1 rép à chaque série à chaque séance. Niveau 3 à 6 × 8 sur la plupart des exercices si 6 × 9 bloque.',
    sessions: [{ name: 'Séance', exercises: [
      { exerciseId: 'B1', sets: 6, reps: 5, restSec: 25, restAfterSec: 25, note: 'Rythme rapide' },
      { exerciseId: 'A3', sets: 6, reps: 5, restSec: 25, restAfterSec: 25 },
      { exerciseId: 'A2', sets: 6, reps: 5, restSec: 25, restAfterSec: 180, note: 'Trop dur : moitié du mouvement, ou A1' },
      { exerciseId: 'C1', sets: 6, reps: 5, restSec: 25, restAfterSec: 180, note: 'Rythme rapide' },
      { exerciseId: 'E', sets: 6, reps: 5, restSec: 25, restAfterSec: 180, note: 'E1 à 6 × 10' },
      { exerciseId: 'F', sets: 4, reps: 5, restSec: 25, restAfterSec: 180 },
      { exerciseId: 'G', sets: 6, reps: 10, restSec: 25, restAfterSec: 90 },
      { exerciseId: 'H', sets: 6, reps: 1, restSec: 25, restAfterSec: 60 },
      { exerciseId: 'K2', sets: 3, reps: null, restSec: 60 },
    ] }],
  },
  {
    id: 'lafay-n3', name: 'Lafay · Niveau 3', source: 'lafay',
    frequency: '3 séances/semaine', bookRef: 'Tome 1 p. 49',
    progression: 'Viser 6 × 10 à B2 avant le niveau 4 ; passer quand même si blocage à 6 × 9.',
    sessions: [{ name: 'Séance', exercises: [
      { exerciseId: 'B2', sets: 6, reps: 4, restSec: 25, restAfterSec: 25 },
      { exerciseId: 'A3', alternatives: ['A4', 'A5'], sets: 6, reps: 4, restSec: 25, restAfterSec: 25 },
      { exerciseId: 'A2', sets: 6, reps: 4, restSec: 25, restAfterSec: 180, note: 'Ne pas descendre à fond ni tendre les bras. Rapide' },
      { exerciseId: 'C2', sets: 6, reps: 4, restSec: 25, restAfterSec: 180, note: 'Rapide' },
      { exerciseId: 'E3', sets: 6, reps: 4, restSec: 25, restAfterSec: 120, note: 'Une jambe entière puis l\'autre (2 min)' },
      { exerciseId: 'F', sets: 4, reps: 4, restSec: 25, restAfterSec: 180, note: 'Jamais plus de 4 × 20' },
      { exerciseId: 'G', sets: 6, reps: null, restSec: 25, restAfterSec: 90, note: 'Sur la lancée du niveau 2' },
      { exerciseId: 'H', sets: 6, reps: null, restSec: 25, note: 'Sur la lancée du niveau 2' },
      { exerciseId: 'K2', sets: 3, reps: null, restSec: 60 },
    ] }],
  },
  {
    id: 'lafay-n4', name: 'Lafay · Niveau 4', source: 'lafay',
    frequency: '3 séances/semaine puis 2 (lun-ven) dès la 3e semaine', bookRef: 'Tome 1 p. 53',
    progression: 'Idéal : 6 × 8 à B. Sert aussi de programme d\'entretien.',
    sessions: [{ name: 'Séance', exercises: [
      { exerciseId: 'B', sets: 6, reps: 3, restSec: 25, restAfterSec: 25 },
      { exerciseId: 'A3', alternatives: ['A4', 'A5', 'A6'], sets: 6, reps: 3, restSec: 25, restAfterSec: 25, note: 'Selon la fin du niveau 3' },
      { exerciseId: 'A2', sets: 6, reps: 3, restSec: 25, restAfterSec: 180 },
      { exerciseId: 'C3', sets: 6, reps: 3, restSec: 25, restAfterSec: 180 },
      { exerciseId: 'E2', sets: 6, reps: 3, restSec: 25, restAfterSec: 180, note: 'Jambe droite, 2 min, jambe gauche' },
      { exerciseId: 'F', sets: 4, reps: 5, restSec: 25, restAfterSec: 120 },
      { exerciseId: 'G', sets: 6, reps: null, restSec: 25 },
      { exerciseId: 'H', sets: 6, reps: null, restSec: 25 },
      { exerciseId: 'K2', sets: 3, reps: null, restSec: 60 },
    ] }],
  },
  {
    id: 'lafay-n5', name: 'Lafay · Niveau 5 (bilan)', source: 'lafay',
    frequency: 'Courte phase de test', bookRef: 'Tome 1 p. 57',
    progression: 'Séries au maximum pour fixer les reps de départ du niveau 6 (≈15 → 6 × 5, ≈20 → 6 × 7, ≈25 → 6 × 8).',
    sessions: [{ name: 'Séance', exercises: [
      { exerciseId: 'B', sets: 2, reps: null, restSec: 120 },
      { exerciseId: 'A2', sets: 2, reps: null, restSec: 120 },
      { exerciseId: 'C', sets: 2, reps: null, restSec: 120 },
      { exerciseId: 'E2', sets: 6, reps: null, restSec: 25 },
      { exerciseId: 'F', sets: 4, reps: null, restSec: 25 },
      { exerciseId: 'G', sets: 6, reps: null, restSec: 25 },
      { exerciseId: 'H', sets: 6, reps: null, restSec: 25 },
      { exerciseId: 'K2', sets: 3, reps: null, restSec: 60 },
      { exerciseId: 'Z', sets: 1, reps: 10, restSec: 0 },
    ] }],
  },
  {
    id: 'lafay-n6', name: 'Lafay · Niveau 6', source: 'lafay',
    frequency: '3 séances/semaine', bookRef: 'Tome 1 p. 59',
    progression: 'Objectif 6 × 10 à B1, A2, I, C1. Niveau 7 à la stagnation (ou si blocage à 6 × 8–9).',
    sessions: [{ name: 'Séance', exercises: [
      { exerciseId: 'B1', sets: 6, reps: 5, restSec: 25, restAfterSec: 25, note: 'Départ 5, 7 ou 8 selon le bilan. Rapide' },
      { exerciseId: 'A3', alternatives: ['A4', 'A5', 'A6'], sets: 6, reps: 4, restSec: 25, restAfterSec: 25, note: 'Rapide' },
      { exerciseId: 'A2', sets: 6, reps: 5, restSec: 25, restAfterSec: 240, note: 'Moitié du mouvement, bras parallèles au sol' },
      { exerciseId: 'I', sets: 6, reps: 3, restSec: 25, restAfterSec: 25 },
      { exerciseId: 'C1', sets: 6, reps: 3, restSec: 25, restAfterSec: 180, note: 'Rapide' },
      { exerciseId: 'E2', sets: 6, reps: null, restSec: 25 },
      { exerciseId: 'F', sets: 4, reps: null, restSec: 25 },
      { exerciseId: 'G', sets: 6, reps: null, restSec: 25 },
      { exerciseId: 'H', sets: 6, reps: null, restSec: 25 },
      { exerciseId: 'K2', sets: 3, reps: null, restSec: 60 },
      { exerciseId: 'Z', sets: 1, reps: 10, restSec: 0 },
    ] }],
  },
  {
    id: 'lafay-n7', name: 'Lafay · Niveau 7', source: 'lafay',
    frequency: '3 séances/semaine', bookRef: 'Tome 1 p. 61',
    progression: '+1 rép par série dès que possible. Niveau 8 vers 6 × 10 à B et I1. Les niveaux 8 à 13 (deux séances alternées) restent à saisir.',
    sessions: [{ name: 'Séance', exercises: [
      { exerciseId: 'B', sets: 6, reps: 5, restSec: 25, restAfterSec: 25 },
      { exerciseId: 'A3', alternatives: ['A4', 'A5', 'A6'], sets: 6, reps: null, restSec: 25, restAfterSec: 25 },
      { exerciseId: 'A2', sets: 6, reps: 5, restSec: 25, restAfterSec: 240, note: 'Exécution normale' },
      { exerciseId: 'I1', sets: 6, reps: 4, restSec: 25, restAfterSec: 25, note: 'Rapide' },
      { exerciseId: 'C3', sets: 6, reps: 4, restSec: 25, restAfterSec: 180 },
      { exerciseId: 'J', sets: 1, reps: null, restSec: 0, restAfterSec: 120, note: 'J1 au-delà de 15' },
      { exerciseId: 'K', sets: 1, reps: null, restSec: 0, restAfterSec: 120, note: 'Amplitude 1/2' },
      { exerciseId: 'L', sets: 1, reps: null, restSec: 0, restAfterSec: 120 },
      { exerciseId: 'I4', sets: 1, reps: null, restSec: 0, restAfterSec: 120 },
      { exerciseId: 'I5', sets: 1, reps: null, restSec: 0, restAfterSec: 180 },
      { exerciseId: 'E2', sets: 6, reps: null, restSec: 25 },
      { exerciseId: 'F', sets: 4, reps: null, restSec: 25 },
      { exerciseId: 'G', sets: 6, reps: null, restSec: 25 },
      { exerciseId: 'H', sets: 6, reps: null, restSec: 25 },
      { exerciseId: 'K2', sets: 3, reps: null, restSec: 60 },
      { exerciseId: 'Z', sets: 1, reps: 10, restSec: 0 },
    ] }],
  },

  // ── Lafay, tome 2 : ajouter des haltères ──
  {
    id: 'lafay-turbo-2plus1', name: 'Lafay Turbo · 2 séances méthode + 1 full body haltères', source: 'lafay-turbo',
    frequency: 'Lun : séance Lafay à 100 % · Mer : séance Lafay à 70 % · Ven : full body haltères', bookRef: 'Tome 2 p. 53',
    requires: ['halteres'],
    progression: 'Possible du niveau 2 au niveau 7. Full body : 1 à 2 exercices de base par groupe musculaire, 3 à 4 séries de 8 à 12, le plus lourd possible, 1 min à 1 min 30 de repos, 1 h 30 maximum échauffement compris.',
    sessions: [{ name: 'Full body haltères (vendredi)', exercises: [
      { exerciseId: 'developpe-couche-halteres', sets: 3, reps: 8, repsMax: 12, restSec: 75 },
      { exerciseId: 'rowing-un-bras-haltere', sets: 3, reps: 8, repsMax: 12, restSec: 75 },
      { exerciseId: 'elevations-laterales', sets: 3, reps: 8, repsMax: 12, restSec: 75 },
      { exerciseId: 'gobelet-squat', sets: 3, reps: 8, repsMax: 12, restSec: 75, note: 'Le livre cite le squat en demi-amplitude' },
      { exerciseId: 'curl-halteres', sets: 3, reps: 8, repsMax: 12, restSec: 75 },
      { exerciseId: 'gainage', sets: 3, reps: null, restSec: 60 },
    ] }],
  },
  {
    id: 'lafay-turbo-ajout', name: 'Lafay Turbo · Un exercice haltères par séance', source: 'lafay-turbo',
    frequency: 'Ajouté à chaque séance Lafay', bookRef: 'Tome 2 p. 53',
    requires: ['halteres'],
    progression: 'Placer l\'exercice haltères après H et avant K2. 2 séries d\'échauffement légères puis 2 séries sérieuses, 2 min de repos. Varier l\'exercice entre lundi, mercredi et vendredi.',
    sessions: [{ name: 'Bloc haltères (à insérer)', exercises: [
      { exerciseId: 'developpe-couche-halteres', sets: 2, reps: 8, repsMax: 12, restSec: 120, note: 'Précédé de 2 séries légères' },
    ] }],
  },

  // ── Programmes de Damien ──
  {
    id: 'perso-half-body-lafay', name: 'Half-body Lafay (chaise romaine)', source: 'perso',
    frequency: '2 à 3 séances/semaine en alternance Haut / Bas', bookRef: 'claude/programme-muscu-lafay.md',
    progression: 'Règle applyLafayProgress : +1 rép par série ; blocage 2 séances → −30 % et variante suivante.',
    sessions: [
      { name: 'Haut du corps', exercises: [
        { exerciseId: 'B1', alternatives: ['B2', 'B'], sets: 6, reps: 6, restSec: 30, restAfterSec: 120 },
        { exerciseId: 'A3', alternatives: ['A', 'A1', 'A2', 'A4', 'A5', 'A6'], sets: 6, reps: 6, restSec: 30, restAfterSec: 120 },
        { exerciseId: 'C1', alternatives: ['C2', 'C3', 'C'], sets: 6, reps: 6, restSec: 30 },
      ] },
      { name: 'Bas du corps + abdos', exercises: [
        { exerciseId: 'F', sets: 4, reps: 6, restSec: 30, restAfterSec: 120 },
        { exerciseId: 'G', sets: 6, reps: 10, restSec: 30, restAfterSec: 120 },
        { exerciseId: 'H', sets: 6, reps: 6, restSec: 30 },
      ] },
    ],
  },
  {
    id: 'perso-hybride-ab', name: 'Hybride Lafay + SuperPhysique (A/B)', source: 'perso', inspired: true,
    frequency: '3 séances/semaine : A-B-A puis B-A-B', requires: ['halteres'],
    progression: 'Poids du corps : +1 rép au total. Haltères : +charge une fois le haut de fourchette validé sur toutes les séries. Stagnation 3 séances → boucle −15 à 20 %.',
    sessions: [
      { name: 'A · Haut', exercises: [
        { exerciseId: 'B', alternatives: ['B1', 'B2'], sets: 6, reps: 6, restSec: 30, restAfterSec: 120 },
        { exerciseId: 'C', alternatives: ['C1', 'C2', 'C3'], sets: 6, reps: 6, restSec: 30, restAfterSec: 120 },
        { exerciseId: 'A2', sets: 6, reps: 6, restSec: 30, restAfterSec: 120 },
        { exerciseId: 'rowing-un-bras-haltere', sets: 3, reps: 8, repsMax: 12, restSec: 75 },
        { exerciseId: 'elevations-laterales', sets: 3, reps: 10, repsMax: 15, restSec: 60 },
        { exerciseId: 'curl-halteres', sets: 3, reps: 8, repsMax: 12, restSec: 60 },
      ] },
      { name: 'B · Bas + abdos', exercises: [
        { exerciseId: 'souleve-de-terre-jambes-tendues', sets: 3, reps: 8, repsMax: 12, restSec: 90 },
        { exerciseId: 'squat-bulgare', alternatives: ['fentes-halteres'], sets: 3, reps: 8, repsMax: 12, restSec: 90 },
        { exerciseId: 'gobelet-squat', sets: 3, reps: 10, repsMax: 15, restSec: 75 },
        { exerciseId: 'H', sets: 6, reps: 6, restSec: 30 },
        { exerciseId: 'mollets-debout-une-jambe', alternatives: ['W'], sets: 3, reps: 12, repsMax: 20, restSec: 45 },
        { exerciseId: 'gainage', sets: 3, reps: null, restSec: 45 },
      ] },
    ],
  },

  // ── SuperPhysique ──
  {
    id: 'superphysique-split-4j', name: 'SuperPhysique · Split 4 jours barre + haltères', source: 'superphysique', inspired: true,
    frequency: 'Lun · Mar · Jeu · Ven', requires: ['halteres', 'barre', 'banc'],
    bookRef: 'superphysique.org/articles/3972',
    progression: 'Séries et reps données à titre d\'exemple par l\'article. Exercices sur machine ou poulie retirés ; tractions et dips remplacés par leurs équivalents Lafay.',
    sessions: [
      { name: 'Lundi · Pectoraux, biceps, abdos', exercises: [
        { exerciseId: 'developpe-couche-barre', sets: 3, reps: 8, repsMax: 10, restSec: 120 },
        { exerciseId: 'developpe-incline-halteres', sets: 3, reps: 10, repsMax: 12, restSec: 90 },
        { exerciseId: 'B', sets: 3, reps: 15, repsMax: 20, restSec: 90, note: 'Prise large, buste penché' },
        { exerciseId: 'curl-barre', alternatives: ['curl-halteres'], sets: 3, reps: 8, repsMax: 10, restSec: 75 },
        { exerciseId: 'curl-incline-halteres', sets: 3, reps: 15, repsMax: 20, restSec: 60 },
        { exerciseId: 'gainage', sets: 3, reps: null, restSec: 45 },
        { exerciseId: 'gainage-oblique', sets: 3, reps: null, restSec: 45 },
      ] },
      { name: 'Mardi · Dos, triceps', exercises: [
        { exerciseId: 'I4', sets: 3, reps: 8, repsMax: 10, restSec: 120, note: 'Traction prise large devant' },
        { exerciseId: 'rowing-un-bras-haltere', sets: 3, reps: 10, repsMax: 12, restSec: 90 },
        { exerciseId: 'rowing-yates-supination', sets: 3, reps: 10, repsMax: 12, restSec: 90 },
        { exerciseId: 'extension-nuque-un-bras', sets: 3, reps: 12, repsMax: 15, restSec: 60 },
        { exerciseId: 'tate-press', sets: 3, reps: 8, repsMax: 10, restSec: 60 },
      ] },
      { name: 'Jeudi · Cuisses, abdos', exercises: [
        { exerciseId: 'squat-avant', alternatives: ['gobelet-squat'], sets: 4, reps: 8, repsMax: 10, restSec: 120 },
        { exerciseId: 'E1', alternatives: ['squat-bulgare'], sets: 3, reps: 10, repsMax: 12, restSec: 90, note: 'Squat à une jambe' },
        { exerciseId: 'souleve-de-terre-jambes-tendues', sets: 3, reps: 8, repsMax: 10, restSec: 90 },
        { exerciseId: 'G', sets: 3, reps: null, restSec: 45 },
        { exerciseId: 'enroulement-de-bassin', sets: 3, reps: null, restSec: 45 },
      ] },
      { name: 'Vendredi · Épaules, trapèzes, mollets', exercises: [
        { exerciseId: 'elevation-laterale-un-bras-incline', sets: 3, reps: 12, repsMax: 15, restSec: 60 },
        { exerciseId: 'oiseau-haltere', sets: 3, reps: 12, repsMax: 15, restSec: 60 },
        { exerciseId: 'developpe-militaire', alternatives: ['developpe-assis-halteres'], sets: 3, reps: 8, repsMax: 10, restSec: 120 },
        { exerciseId: 'shrug-halteres', sets: 3, reps: 8, repsMax: 10, restSec: 75 },
        { exerciseId: 'mollets-debout-une-jambe', alternatives: ['W'], sets: 3, reps: null, restSec: 45 },
      ] },
    ],
  },
];
