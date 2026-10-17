/**
 * Catalogue d'exercices — source de vérité de la table Exercise (hors exercices perso).
 * Synchronisé en base par lib/data/exercises-catalog.ts (upsert par slug).
 *  - Poids du corps : des ÉCHELLES de difficulté (1–10) reliées par harderVariantSlug.
 *  - Barre et haltères : charge externe, sans échelle.
 * Les alias rapprochent les saisies libres (« DC », « pompe »…) ; un alias ne doit appartenir qu'à un seul exercice.
 * Augmenter CATALOG_VERSION à chaque modification du contenu.
 */
import type { Equipment, LoadType, MuscleGroup } from "@prisma/client";
import type { ExerciseSeed } from "@/types/training";

export const CATALOG_VERSION = 1;

// ═════════ Poids du corps : échelles ═════════

const PUSH_UPS: ExerciseSeed[] = [
  {
    slug: "pompes-genoux", name: "Pompes sur les genoux", difficulty: 1, harderVariantSlug: "pompes",
    aliases: ["pompes genoux", "pompes à genoux", "pompe genou", "knee push up"],
    equipment: "BODYWEIGHT", loadType: "BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["CHEST"], secondaryMuscles: ["TRICEPS", "SHOULDERS", "ABS"],
    instructions: "Genoux au sol, corps aligné des genoux à la tête. Descends la poitrine près du sol en gardant les coudes à environ 45° du buste.",
  },
  {
    slug: "pompes", name: "Pompes classiques", difficulty: 3, harderVariantSlug: "pompes-pieds-sureleves",
    aliases: ["pompes", "pompe", "pompes classiques", "push up", "push-up"],
    equipment: "BODYWEIGHT", loadType: "BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["CHEST"], secondaryMuscles: ["TRICEPS", "SHOULDERS", "ABS"],
    instructions: "Mains un peu plus larges que les épaules, corps gainé en planche. Descends jusqu'à frôler le sol puis pousse sans creuser le bas du dos.",
  },
  {
    slug: "pompes-pieds-sureleves", name: "Pompes pieds surélevés", difficulty: 4, harderVariantSlug: "pompes-diamant",
    aliases: ["pompes pieds surélevés", "pompes déclinées", "decline push up"],
    equipment: "BODYWEIGHT", loadType: "BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["CHEST"], secondaryMuscles: ["SHOULDERS", "TRICEPS", "ABS"],
    instructions: "Pieds posés sur un banc ou une chaise, mains au sol. Plus les pieds sont hauts, plus le haut des pectoraux et les épaules travaillent.",
  },
  {
    slug: "pompes-diamant", name: "Pompes diamant", difficulty: 5, harderVariantSlug: "pompes-archer",
    aliases: ["pompes diamant", "pompes serrées", "diamond push up"],
    equipment: "BODYWEIGHT", loadType: "BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["TRICEPS", "CHEST"], secondaryMuscles: ["SHOULDERS"],
    instructions: "Pouces et index se touchent sous la poitrine. Garde les coudes le long du corps à la descente.",
  },
  {
    slug: "pompes-archer", name: "Pompes archer", difficulty: 7, harderVariantSlug: "pompes-une-main-assistees",
    aliases: ["pompes archer", "archer push up"],
    equipment: "BODYWEIGHT", loadType: "BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["CHEST"], secondaryMuscles: ["TRICEPS", "SHOULDERS", "ABS"],
    instructions: "Mains très écartées : descends vers un côté en pliant ce bras, l'autre reste presque tendu. Alterne les côtés.",
  },
  {
    slug: "pompes-une-main-assistees", name: "Pompes sur une main assistées", difficulty: 9,
    aliases: ["pompes une main assistées", "pompe une main", "pompes sur une main", "one arm push up"],
    equipment: "BODYWEIGHT", loadType: "BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["CHEST"], secondaryMuscles: ["TRICEPS", "SHOULDERS", "ABS", "OBLIQUES"],
    instructions: "Une main travaille, l'autre se pose sur un support bas (ballon, marche) pour aider juste ce qu'il faut. Pieds écartés pour rester stable.",
  },
];

const PULL_UPS: ExerciseSeed[] = [
  {
    slug: "tractions-negatives", name: "Tractions négatives", difficulty: 3, harderVariantSlug: "tractions",
    aliases: ["tractions négatives", "négatives", "tractions excentriques", "negative pull up"],
    equipment: "PULLUP_BAR", loadType: "BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["LATS"], secondaryMuscles: ["BICEPS", "BACK", "FOREARMS"],
    instructions: "Monte menton au-dessus de la barre en t'aidant d'un appui, puis redescends le plus lentement possible (3 à 5 s) jusqu'aux bras tendus.",
  },
  {
    slug: "tractions", name: "Tractions pronation", difficulty: 5, harderVariantSlug: "tractions-supination",
    aliases: ["tractions", "traction", "tractions pronation", "pull up", "pull-up"],
    equipment: "PULLUP_BAR", loadType: "BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["LATS"], secondaryMuscles: ["BICEPS", "BACK", "FOREARMS"],
    instructions: "Paumes vers l'avant, mains un peu plus larges que les épaules. Tire jusqu'à passer le menton au-dessus de la barre, sans élan, puis redescends bras tendus.",
  },
  {
    slug: "tractions-supination", name: "Tractions supination", difficulty: 6, harderVariantSlug: "tractions-archer",
    aliases: ["tractions supination", "traction supination", "chin up", "chin-up"],
    equipment: "PULLUP_BAR", loadType: "WEIGHTED_BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["LATS", "BICEPS"], secondaryMuscles: ["BACK", "FOREARMS"],
    instructions: "Paumes vers toi, mains largeur d'épaules. Quand les séries deviennent faciles, ajoute du lest (ceinture ou sac à dos).",
  },
  {
    slug: "tractions-archer", name: "Tractions archer", difficulty: 8,
    aliases: ["tractions archer", "archer pull up"],
    equipment: "PULLUP_BAR", loadType: "BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["LATS"], secondaryMuscles: ["BICEPS", "BACK", "FOREARMS"],
    instructions: "Prise très large : monte vers une main en gardant l'autre bras presque tendu sur la barre. Alterne les côtés.",
  },
];

const DIPS: ExerciseSeed[] = [
  {
    slug: "dips-banc", name: "Dips sur banc", difficulty: 2, harderVariantSlug: "dips",
    aliases: ["dips sur banc", "dips banc", "dips arrière", "dips sur chaise", "bench dips"],
    equipment: "BENCH", loadType: "BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["TRICEPS"], secondaryMuscles: ["CHEST", "SHOULDERS"],
    instructions: "Mains sur le bord d'un banc derrière toi, jambes devant. Descends en pliant les coudes vers l'arrière jusqu'à 90°, puis pousse.",
  },
  {
    slug: "dips", name: "Dips à la chaise romaine", difficulty: 5, harderVariantSlug: "dips-lestes",
    aliases: ["dips", "dip", "dips chaise romaine", "dips barres parallèles"],
    equipment: "ROMAN_CHAIR", loadType: "BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["CHEST", "TRICEPS"], secondaryMuscles: ["SHOULDERS"],
    instructions: "En appui sur les barres, épaules basses. Descends jusqu'à ce que les épaules passent un peu sous les coudes, puis remonte bras tendus.",
  },
  {
    slug: "dips-lestes", name: "Dips lestés", difficulty: 7,
    aliases: ["dips lestés", "weighted dips"],
    equipment: "ROMAN_CHAIR", loadType: "WEIGHTED_BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["CHEST", "TRICEPS"], secondaryMuscles: ["SHOULDERS"],
    instructions: "Même mouvement que les dips, avec une charge à la ceinture ou entre les jambes. Augmente le lest par petits paliers.",
  },
];

const SQUATS: ExerciseSeed[] = [
  {
    slug: "squat-poids-du-corps", name: "Squat au poids du corps", difficulty: 1, harderVariantSlug: "squat-bulgare",
    aliases: ["squat poids du corps", "squat au poids du corps", "squat pdc", "air squat", "flexions de jambes"],
    equipment: "BODYWEIGHT", loadType: "BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["QUADS", "GLUTES"], secondaryMuscles: ["HAMSTRINGS", "ADDUCTORS"],
    instructions: "Pieds largeur d'épaules, poitrine haute. Descends en poussant les hanches en arrière jusqu'aux cuisses parallèles au sol, talons au sol.",
  },
  {
    slug: "squat-bulgare", name: "Squat bulgare", difficulty: 4, harderVariantSlug: "pistol-assiste",
    aliases: ["squat bulgare", "fente bulgare", "fentes bulgares", "bulgarian split squat"],
    equipment: "BODYWEIGHT", loadType: "BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["QUADS", "GLUTES"], secondaryMuscles: ["HAMSTRINGS", "ADDUCTORS"],
    instructions: "Pied arrière posé sur un banc ou une chaise. Descends le genou arrière vers le sol en gardant le genou avant au-dessus du pied.",
  },
  {
    slug: "pistol-assiste", name: "Pistol squat assisté", difficulty: 6, harderVariantSlug: "pistol",
    aliases: ["pistol squat assisté", "pistol assisté", "squat une jambe assisté"],
    equipment: "BODYWEIGHT", loadType: "BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["QUADS", "GLUTES"], secondaryMuscles: ["HAMSTRINGS", "ABS"],
    instructions: "Squat sur une jambe, l'autre tendue devant, en te tenant à un montant ou une sangle. Aide-toi le moins possible.",
  },
  {
    slug: "pistol", name: "Pistol squat", difficulty: 8,
    aliases: ["pistol squat", "pistol", "squat une jambe"],
    equipment: "BODYWEIGHT", loadType: "BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["QUADS", "GLUTES"], secondaryMuscles: ["HAMSTRINGS", "ABS", "CALVES"],
    instructions: "Sur une jambe, l'autre tendue devant : descends en contrôle jusqu'en bas, talon au sol, puis remonte sans appui.",
  },
];

const CORE: ExerciseSeed[] = [
  {
    slug: "planche", name: "Gainage planche", difficulty: 2, harderVariantSlug: "planche-lestee",
    aliases: ["gainage", "planche", "gainage planche", "gainage ventral", "plank"],
    equipment: "BODYWEIGHT", loadType: "TIMED",
    primaryMuscles: ["ABS"], secondaryMuscles: ["LOWER_BACK", "SHOULDERS", "GLUTES"],
    instructions: "Sur les avant-bras et la pointe des pieds, corps en ligne droite. Serre les fessiers et les abdos, respire calmement.",
  },
  {
    slug: "planche-lestee", name: "Gainage planche lestée", difficulty: 5,
    aliases: ["planche lestée", "gainage lesté", "weighted plank"],
    equipment: "BODYWEIGHT", loadType: "TIMED",
    primaryMuscles: ["ABS"], secondaryMuscles: ["LOWER_BACK", "SHOULDERS", "GLUTES"],
    instructions: "Même position, avec un disque posé sur le haut du dos (fais-le placer par quelqu'un). Garde le bassin bien aligné.",
  },
  {
    slug: "releves-genoux-chaise-romaine", name: "Relevés de genoux à la chaise romaine", difficulty: 3, harderVariantSlug: "releves-jambes-chaise-romaine",
    aliases: ["relevés de genoux", "relevés genoux chaise romaine", "relevé de genoux", "knee raise"],
    equipment: "ROMAN_CHAIR", loadType: "BODYWEIGHT", mechanic: "ISOLATION",
    primaryMuscles: ["ABS"], secondaryMuscles: ["OBLIQUES"],
    instructions: "Dos plaqué au dossier, avant-bras sur les appuis. Monte les genoux vers la poitrine en enroulant le bassin, redescends sans balancer.",
  },
  {
    slug: "releves-jambes-chaise-romaine", name: "Relevés de jambes tendues à la chaise romaine", difficulty: 5,
    aliases: ["relevés de jambes", "relevé de jambes", "relevés jambes tendues", "relevés de jambes chaise romaine", "leg raise"],
    equipment: "ROMAN_CHAIR", loadType: "BODYWEIGHT", mechanic: "ISOLATION",
    primaryMuscles: ["ABS"], secondaryMuscles: ["OBLIQUES"],
    instructions: "Jambes tendues, monte-les jusqu'à l'horizontale ou plus haut en décollant légèrement le bassin. Contrôle la descente.",
  },
  {
    slug: "extensions-lombaires", name: "Extensions lombaires à la chaise romaine", difficulty: 3,
    aliases: ["extensions lombaires", "extension lombaire", "lombaires", "hyperextensions", "back extension"],
    equipment: "ROMAN_CHAIR", loadType: "BODYWEIGHT", mechanic: "ISOLATION",
    primaryMuscles: ["LOWER_BACK"], secondaryMuscles: ["GLUTES", "HAMSTRINGS"],
    instructions: "Bassin calé sur l'appui, descends le buste dos droit puis remonte jusqu'à l'alignement avec les jambes, sans te cambrer au-delà.",
  },
];

const SHOULDERS_BW: ExerciseSeed[] = [
  {
    slug: "pompes-pike", name: "Pompes pike", difficulty: 4, harderVariantSlug: "hspu-assiste",
    aliases: ["pompes pike", "pike push up", "pompes piquées", "pompes en v"],
    equipment: "BODYWEIGHT", loadType: "BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["SHOULDERS"], secondaryMuscles: ["TRICEPS", "CHEST"],
    instructions: "Hanches hautes, corps en V inversé. Descends le sommet de la tête entre les mains, puis pousse vers le haut.",
  },
  {
    slug: "hspu-assiste", name: "Handstand push-up assisté", difficulty: 7,
    aliases: ["hspu", "hspu assisté", "handstand push up", "pompes en équilibre", "pompes poirier"],
    equipment: "BODYWEIGHT", loadType: "BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["SHOULDERS"], secondaryMuscles: ["TRICEPS", "TRAPS"],
    instructions: "En équilibre contre un mur, mains à 20 cm de celui-ci. Descends la tête vers un coussin en contrôle, puis pousse ; limite l'amplitude au début.",
  },
];

const ROWS_BW: ExerciseSeed[] = [
  {
    slug: "rowing-australien", name: "Rowing australien", difficulty: 3,
    aliases: ["rowing australien", "tractions australiennes", "australian row", "inverted row", "rowing inversé"],
    equipment: "BODYWEIGHT", loadType: "BODYWEIGHT", mechanic: "COMPOUND",
    primaryMuscles: ["BACK", "LATS"], secondaryMuscles: ["BICEPS", "TRAPS"],
    instructions: "Allongé sous une barre basse ou une table solide, corps gainé. Tire la poitrine vers la barre, serre les omoplates, redescends lentement.",
  },
];

// ═════════ Barre et haltères ═════════

const FREE_WEIGHTS: ExerciseSeed[] = [
  {
    slug: "squat-barre", name: "Squat barre",
    aliases: ["squat barre", "back squat", "squat arrière", "squat nuque"],
    equipment: "BARBELL", loadType: "EXTERNAL", mechanic: "COMPOUND",
    primaryMuscles: ["QUADS", "GLUTES"], secondaryMuscles: ["HAMSTRINGS", "LOWER_BACK", "ADDUCTORS"],
    instructions: "Barre sur le haut du dos, pieds largeur d'épaules. Descends dos neutre jusqu'aux cuisses au moins parallèles, genoux dans l'axe des pieds.",
  },
  {
    slug: "souleve-de-terre", name: "Soulevé de terre",
    aliases: ["soulevé de terre", "sdt", "deadlift"],
    equipment: "BARBELL", loadType: "EXTERNAL", mechanic: "COMPOUND",
    primaryMuscles: ["HAMSTRINGS", "GLUTES", "LOWER_BACK"], secondaryMuscles: ["BACK", "TRAPS", "QUADS", "FOREARMS"],
    instructions: "Barre au-dessus du milieu du pied, dos plat. Pousse le sol avec les jambes en gardant la barre collée aux tibias, puis verrouille les hanches.",
  },
  {
    slug: "souleve-de-terre-roumain", name: "Soulevé de terre roumain",
    aliases: ["soulevé de terre roumain", "sdt roumain", "rdl", "romanian deadlift"],
    equipment: "BARBELL", loadType: "EXTERNAL", mechanic: "COMPOUND",
    primaryMuscles: ["HAMSTRINGS", "GLUTES"], secondaryMuscles: ["LOWER_BACK", "FOREARMS"],
    instructions: "Genoux légèrement fléchis et fixes, recule les hanches en faisant glisser la barre le long des cuisses jusqu'à l'étirement des ischios, dos plat.",
  },
  {
    slug: "developpe-couche", name: "Développé couché barre",
    aliases: ["développé couché", "développé couché barre", "dc", "dc barre", "bench press", "bench"],
    equipment: "BARBELL", loadType: "EXTERNAL", mechanic: "COMPOUND",
    primaryMuscles: ["CHEST"], secondaryMuscles: ["TRICEPS", "SHOULDERS"],
    instructions: "Omoplates serrées, pieds bien ancrés. Descends la barre au bas des pectoraux en contrôle, puis pousse sans décoller les fessiers du banc.",
  },
  {
    slug: "developpe-couche-halteres", name: "Développé couché haltères",
    aliases: ["développé couché haltères", "dc haltères", "développé haltères", "dumbbell bench press"],
    equipment: "DUMBBELL", loadType: "EXTERNAL", mechanic: "COMPOUND",
    primaryMuscles: ["CHEST"], secondaryMuscles: ["TRICEPS", "SHOULDERS"],
    instructions: "Allongé sur un banc, haltères au niveau de la poitrine. Pousse en rapprochant légèrement les haltères en haut, descends lentement en ouvrant les coudes à 45°.",
  },
  {
    slug: "developpe-incline-halteres", name: "Développé incliné haltères",
    aliases: ["développé incliné haltères", "développé incliné", "dc incliné", "incliné haltères", "incline dumbbell press"],
    equipment: "DUMBBELL", loadType: "EXTERNAL", mechanic: "COMPOUND",
    primaryMuscles: ["CHEST", "SHOULDERS"], secondaryMuscles: ["TRICEPS"],
    instructions: "Banc incliné à 30–45°. Pousse les haltères au-dessus du haut de la poitrine, redescends jusqu'à un bon étirement des pectoraux.",
  },
  {
    slug: "developpe-militaire", name: "Développé militaire",
    aliases: ["développé militaire", "développé militaire barre", "dm", "military press", "overhead press", "ohp"],
    equipment: "BARBELL", loadType: "EXTERNAL", mechanic: "COMPOUND",
    primaryMuscles: ["SHOULDERS"], secondaryMuscles: ["TRICEPS", "TRAPS", "ABS"],
    instructions: "Debout, barre sur le haut de la poitrine. Pousse à la verticale en reculant la tête, fessiers et abdos serrés pour ne pas te cambrer.",
  },
  {
    slug: "developpe-epaules-halteres", name: "Développé épaules haltères",
    aliases: ["développé épaules haltères", "développé militaire haltères", "développé assis haltères", "shoulder press haltères"],
    equipment: "DUMBBELL", loadType: "EXTERNAL", mechanic: "COMPOUND",
    primaryMuscles: ["SHOULDERS"], secondaryMuscles: ["TRICEPS", "TRAPS"],
    instructions: "Assis dos calé, haltères à hauteur d'oreilles. Pousse au-dessus de la tête sans claquer les haltères, redescends en contrôle.",
  },
  {
    slug: "rowing-barre", name: "Rowing barre",
    aliases: ["rowing barre", "rowing buste penché", "barbell row"],
    equipment: "BARBELL", loadType: "EXTERNAL", mechanic: "COMPOUND",
    primaryMuscles: ["BACK", "LATS"], secondaryMuscles: ["BICEPS", "TRAPS", "LOWER_BACK"],
    instructions: "Buste penché à 45° environ, dos plat. Tire la barre vers le nombril en serrant les omoplates, redescends bras tendus.",
  },
  {
    slug: "rowing-haltere", name: "Rowing haltère",
    aliases: ["rowing haltère", "rowing un bras", "rowing unilatéral", "dumbbell row"],
    equipment: "DUMBBELL", loadType: "EXTERNAL", mechanic: "COMPOUND",
    primaryMuscles: ["LATS", "BACK"], secondaryMuscles: ["BICEPS", "TRAPS"],
    instructions: "Une main et un genou sur un banc, dos plat. Tire l'haltère vers la hanche en gardant le coude près du corps.",
  },
  {
    slug: "curl-barre", name: "Curl barre",
    aliases: ["curl barre", "curl barre ez", "curl ez", "barbell curl"],
    equipment: "BARBELL", loadType: "EXTERNAL", mechanic: "ISOLATION",
    primaryMuscles: ["BICEPS"], secondaryMuscles: ["FOREARMS"],
    instructions: "Debout, coudes collés au buste. Monte la barre sans balancer le corps, redescends lentement jusqu'aux bras tendus.",
  },
  {
    slug: "curl-halteres", name: "Curl haltères",
    aliases: ["curl haltères", "curl haltère", "curl biceps haltères", "dumbbell curl"],
    equipment: "DUMBBELL", loadType: "EXTERNAL", mechanic: "ISOLATION",
    primaryMuscles: ["BICEPS"], secondaryMuscles: ["FOREARMS"],
    instructions: "Paumes vers l'avant, coudes fixes. Monte en tournant légèrement le poignet vers l'extérieur, alterné ou simultané.",
  },
  {
    slug: "curl-marteau", name: "Curl marteau",
    aliases: ["curl marteau", "hammer curl"],
    equipment: "DUMBBELL", loadType: "EXTERNAL", mechanic: "ISOLATION",
    primaryMuscles: ["BICEPS", "FOREARMS"],
    instructions: "Prise neutre, pouces vers le haut. Monte les haltères sans bouger les coudes, redescends en contrôle.",
  },
  {
    slug: "extension-triceps-haltere", name: "Extension triceps haltère",
    aliases: ["extension triceps haltère", "extension triceps", "extension nuque", "extension verticale haltère", "overhead triceps extension"],
    equipment: "DUMBBELL", loadType: "EXTERNAL", mechanic: "ISOLATION",
    primaryMuscles: ["TRICEPS"],
    instructions: "Haltère tenu à deux mains au-dessus de la tête. Descends-le derrière la nuque en gardant les coudes serrés et pointés vers le plafond, puis tends les bras.",
  },
  {
    slug: "elevations-laterales", name: "Élévations latérales",
    aliases: ["élévations latérales", "élévation latérale", "lateral raise"],
    equipment: "DUMBBELL", loadType: "EXTERNAL", mechanic: "ISOLATION",
    primaryMuscles: ["SHOULDERS"], secondaryMuscles: ["TRAPS"],
    instructions: "Bras légèrement fléchis, monte les haltères sur les côtés jusqu'à hauteur d'épaules, coudes menant le mouvement. Évite l'élan.",
  },
  {
    slug: "oiseau", name: "Oiseau",
    aliases: ["oiseau", "oiseau haltères", "élévations postérieures", "rear delt fly", "reverse fly"],
    equipment: "DUMBBELL", loadType: "EXTERNAL", mechanic: "ISOLATION",
    primaryMuscles: ["SHOULDERS"], secondaryMuscles: ["BACK", "TRAPS"],
    instructions: "Buste penché presque à l'horizontale, dos plat. Ouvre les bras sur les côtés en visant l'arrière des épaules, sans hausser les épaules.",
  },
  {
    slug: "fentes-halteres", name: "Fentes haltères",
    aliases: ["fentes haltères", "fentes", "fente", "fentes avant", "lunges"],
    equipment: "DUMBBELL", loadType: "EXTERNAL", mechanic: "COMPOUND",
    primaryMuscles: ["QUADS", "GLUTES"], secondaryMuscles: ["HAMSTRINGS", "ADDUCTORS"],
    instructions: "Un haltère dans chaque main, fais un grand pas et descends le genou arrière près du sol. Buste droit, pousse sur le talon avant pour revenir.",
  },
  {
    slug: "hip-thrust", name: "Hip thrust",
    aliases: ["hip thrust", "hip thrust barre", "barbell hip thrust"],
    equipment: "BARBELL", loadType: "EXTERNAL", mechanic: "COMPOUND",
    primaryMuscles: ["GLUTES"], secondaryMuscles: ["HAMSTRINGS"],
    instructions: "Haut du dos contre un banc, barre protégée sur les hanches. Monte le bassin jusqu'à l'alignement épaules-genoux en serrant les fessiers, menton rentré.",
  },
  {
    slug: "mollets-debout", name: "Mollets debout",
    aliases: ["mollets debout", "mollets", "extensions mollets", "élévations mollets", "calf raise"],
    equipment: "DUMBBELL", loadType: "EXTERNAL", mechanic: "ISOLATION",
    primaryMuscles: ["CALVES"],
    instructions: "Avant des pieds sur une marche, talons dans le vide. Monte le plus haut possible, marque une pause, puis descends jusqu'à l'étirement.",
  },
  {
    slug: "shrug", name: "Shrug",
    aliases: ["shrug", "shrug haltères", "haussements d'épaules", "haussement d'épaules"],
    equipment: "DUMBBELL", loadType: "EXTERNAL", mechanic: "ISOLATION",
    primaryMuscles: ["TRAPS"], secondaryMuscles: ["FOREARMS"],
    instructions: "Bras tendus, haltères le long du corps. Monte les épaules vers les oreilles sans rouler, tiens une seconde, redescends.",
  },
];

export const BODYWEIGHT_EXERCISES: ExerciseSeed[] = [...PUSH_UPS, ...PULL_UPS, ...DIPS, ...SQUATS, ...CORE, ...SHOULDERS_BW, ...ROWS_BW];
export const EXERCISE_CATALOG: ExerciseSeed[] = [...BODYWEIGHT_EXERCISES, ...FREE_WEIGHTS];

const BY_SLUG = new Map(EXERCISE_CATALOG.map((e) => [e.slug, e]));
export const catalogEntry = (slug: string) => BY_SLUG.get(slug);

/** Échelle complète d'un exercice, du plus facile au plus dur (un seul élément s'il n'a pas de variante). */
export function ladderOf(slug: string): ExerciseSeed[] {
  const start = BY_SLUG.get(slug);
  if (!start) return [];
  const easier = (s: string) => EXERCISE_CATALOG.find((e) => e.harderVariantSlug === s);
  let root = start;
  for (let e = easier(root.slug); e && e !== start; e = easier(e.slug)) root = e;
  const out: ExerciseSeed[] = [];
  for (let e: ExerciseSeed | undefined = root; e && !out.includes(e); e = e.harderVariantSlug ? BY_SLUG.get(e.harderVariantSlug) : undefined) out.push(e);
  return out;
}

/** Échelles du poids du corps, chacune du plus facile au plus dur. */
export const BODYWEIGHT_LADDERS: ExerciseSeed[][] = BODYWEIGHT_EXERCISES
  .filter((e) => !EXERCISE_CATALOG.some((o) => o.harderVariantSlug === e.slug))
  .map((e) => ladderOf(e.slug));

// ═════════ Libellés ═════════

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  BARBELL: "Barre", DUMBBELL: "Haltères", KETTLEBELL: "Kettlebell", MACHINE: "Machine", CABLE: "Poulie", BAND: "Élastique",
  BODYWEIGHT: "Sans matériel", PULLUP_BAR: "Barre de traction", RINGS: "Anneaux", BENCH: "Banc", ROMAN_CHAIR: "Chaise romaine", OTHER: "Autre",
};
export const LOAD_TYPE_LABELS: Record<LoadType, string> = {
  EXTERNAL: "Charge (barre, haltères, machine)", BODYWEIGHT: "Poids du corps", WEIGHTED_BODYWEIGHT: "Poids du corps, lest possible",
  ASSISTED: "Assisté (élastique)", TIMED: "Au temps (gainage)",
};
export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  CHEST: "Pectoraux", BACK: "Haut du dos", LATS: "Grands dorsaux", TRAPS: "Trapèzes", SHOULDERS: "Épaules", BICEPS: "Biceps",
  TRICEPS: "Triceps", FOREARMS: "Avant-bras", ABS: "Abdominaux", OBLIQUES: "Obliques", LOWER_BACK: "Lombaires", GLUTES: "Fessiers",
  QUADS: "Quadriceps", HAMSTRINGS: "Ischio-jambiers", CALVES: "Mollets", ADDUCTORS: "Adducteurs", FULL_BODY: "Corps entier",
};
