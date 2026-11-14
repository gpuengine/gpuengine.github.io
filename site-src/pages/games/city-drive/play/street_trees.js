// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const TALL_TREE_MIN_HEIGHT_METERS = 8.5;
const ROAD_OVERHANG_CLEARANCE_METERS = 4.6;
const FULL_TURN = Math.PI * 2;
const BLOSSOM_CARD_SHARE = 0.72;
const CROWN_CORE_SHRINK = 0.88;

const TREE_LOD_SETTINGS = [
  { cardCount: 230, cardHalfSize: 0.26, barkSides: 16, rootCount: 7, rootSides: 6, limbCount: 5, coreSlices: 9, coreStacks: 5 },
  { cardCount: 60, cardHalfSize: 0.46, barkSides: 8, rootCount: 4, rootSides: 4, limbCount: 3, coreSlices: 7, coreStacks: 4 },
  { cardCount: 14, cardHalfSize: 0.85, barkSides: 4, rootCount: 0, rootSides: 3, limbCount: 0, coreSlices: 6, coreStacks: 3 }
];
const GROUND_ANCHOR_Y = -1;
const TRUNK_FLARE_RINGS = [
  { anchorY: -1.08, rise: 0, radius: 0.7, buttressDepth: 0.6 },
  { anchorY: GROUND_ANCHOR_Y, rise: 0.12, radius: 0.64, buttressDepth: 0.55 },
  { anchorY: GROUND_ANCHOR_Y, rise: 0.4, radius: 0.5, buttressDepth: 0.32 },
  { anchorY: GROUND_ANCHOR_Y, rise: 0.85, radius: 0.43, buttressDepth: 0.14 }
];
const TRUNK_SHAFT_RINGS = [
  { anchorY: -0.6, radius: 0.41, buttressDepth: 0.05 },
  { anchorY: -0.25, radius: 0.39, buttressDepth: 0.03 },
  { anchorY: 0, radius: 0.37, buttressDepth: 0.02 }
];
const BUTTRESS_ANGULAR_WIDTH = 0.38;
const BUTTRESS_MEAN_BULGE = 0.3;
const ROOT_PROFILE = [
  { along: 0, radius: 0.3 },
  { along: 0.22, radius: 0.24 },
  { along: 0.5, radius: 0.15 },
  { along: 0.78, radius: 0.08 },
  { along: 1, radius: 0.035 }
];
const ROOT_START_REACH = 0.22;
const ROOT_TIP_DEPTH = 0.14;

const CROWN_FORMS = {
  rounded: {
    trunkTop: 0.3, limbStyle: "spreading", cardKind: "facingCard",
    lobes: [lobe([0, 0.48, 0], 0.82, 0.48), lobe([0.42, 0.40, 0], 0.55, 0.30), lobe([-0.42, 0.50, 0.1], 0.55, 0.30), lobe([0.05, 0.38, 0.42], 0.55, 0.30), lobe([-0.1, 0.50, -0.42], 0.55, 0.30), lobe([0, 0.72, 0], 0.5, 0.26)],
    cores: [lobe([0, 0.48, 0], 0.62, 0.36)]
  },
  vase: {
    trunkTop: 0.05, limbStyle: "vase", cardKind: "facingCard",
    lobes: [0, 1, 2, 3, 4].map(index => lobe([Math.cos(index * 1.2566) * 0.55, 0.6, Math.sin(index * 1.2566) * 0.55], 0.48, 0.28)).concat([lobe([0, 0.74, 0], 0.6, 0.24)]),
    cores: [lobe([0, 0.64, 0], 0.72, 0.24)]
  },
  columnar: {
    trunkTop: 0.7, limbStyle: "none", cardKind: "facingCard",
    lobes: [lobe([0, 0.28, 0], 1.0, 0.27), lobe([0, 0.55, 0], 0.85, 0.26), lobe([0, 0.80, 0], 0.6, 0.2)],
    cores: [lobe([0, 0.28, 0], 0.72, 0.22), lobe([0, 0.55, 0], 0.62, 0.22), lobe([0, 0.80, 0], 0.42, 0.16)]
  },
  spire: {
    trunkTop: 0.6, limbStyle: "none", cardKind: "uprightCard",
    lobes: [lobe([0, 0.45, 0], 1.0, 0.46), lobe([0, 0.86, 0], 0.5, 0.14)],
    cores: [lobe([0, 0.46, 0], 0.82, 0.44)]
  },
  conical: {
    trunkTop: 0.85, limbStyle: "none", cardKind: "uprightCard",
    lobes: [],
    cores: [{ ...lobe([0, 0.49, 0], 0.82, 0.5), isCone: true }]
  },
  layered: {
    trunkTop: 0.65, limbStyle: "layered", cardKind: "facingCard",
    lobes: [lobe([0.3, 0.25, 0], 0.75, 0.2), lobe([-0.22, 0.52, 0.2], 0.68, 0.2), lobe([0.05, 0.78, -0.1], 0.48, 0.2), lobe([-0.4, 0.38, -0.3], 0.42, 0.16), lobe([0.35, 0.62, 0.35], 0.4, 0.16)],
    cores: [lobe([0.2, 0.25, 0], 0.5, 0.14), lobe([-0.15, 0.52, 0.13], 0.46, 0.14)]
  },
  weeping: {
    trunkTop: 0.3, limbStyle: "spreading", cardKind: "facingCard", hasHangingStrands: true,
    lobes: [lobe([0, 0.5, 0], 0.9, 0.5)],
    cores: [lobe([0, 0.5, 0], 0.68, 0.38)]
  },
  oval: {
    trunkTop: 0.4, limbStyle: "spreading", cardKind: "facingCard",
    lobes: [lobe([0, 0.30, 0], 0.78, 0.30), lobe([0.1, 0.55, -0.1], 0.86, 0.30), lobe([-0.08, 0.78, 0.06], 0.62, 0.24), lobe([0.3, 0.45, 0.3], 0.45, 0.24), lobe([-0.3, 0.6, -0.25], 0.45, 0.24)],
    cores: [lobe([0, 0.52, 0], 0.62, 0.42)]
  },
  broadSpreading: {
    trunkTop: 0.12, limbStyle: "spreading", cardKind: "facingCard",
    lobes: [lobe([0, 0.45, 0], 0.7, 0.3), lobe([0.62, 0.38, 0.1], 0.5, 0.22), lobe([-0.6, 0.42, -0.1], 0.5, 0.22), lobe([0.1, 0.36, 0.62], 0.48, 0.2), lobe([-0.12, 0.40, -0.6], 0.48, 0.2), lobe([0, 0.66, 0], 0.5, 0.2)],
    cores: [lobe([0, 0.44, 0], 0.72, 0.26)]
  }
};

const TREE_SPECIES = Object.freeze({
  londonPlane: {
    leafCell: "broadleaf", form: "rounded", heightRangeMeters: [10, 18], crownWidthRatio: 0.62, clearTrunkRatio: 0.32,
    trunkColor: [0.58, 0.55, 0.46],
    foliageColors: [[0.22, 0.45, 0.20], [0.30, 0.53, 0.24], [0.26, 0.49, 0.22]]
  },
  pinOak: {
    leafCell: "broadleaf", form: "rounded", heightRangeMeters: [10, 17], crownWidthRatio: 0.58, clearTrunkRatio: 0.30,
    trunkColor: [0.30, 0.25, 0.21],
    foliageColors: [[0.14, 0.36, 0.17], [0.20, 0.44, 0.21], [0.17, 0.40, 0.19]]
  },
  littleleafLinden: {
    leafCell: "broadleaf", form: "rounded", heightRangeMeters: [7, 13], crownWidthRatio: 0.50, clearTrunkRatio: 0.26,
    trunkColor: [0.34, 0.27, 0.21],
    foliageColors: [[0.30, 0.52, 0.22], [0.38, 0.60, 0.27]]
  },
  redMaple: {
    leafCell: "broadleaf", form: "rounded", heightRangeMeters: [7, 13], crownWidthRatio: 0.56, clearTrunkRatio: 0.28,
    trunkColor: [0.36, 0.33, 0.30],
    foliageColors: [[0.80, 0.20, 0.13], [0.90, 0.38, 0.15], [0.70, 0.16, 0.12]]
  },
  ginkgo: {
    leafCell: "fineLeaf", form: "layered", heightRangeMeters: [8, 15], crownWidthRatio: 0.42, clearTrunkRatio: 0.24,
    trunkColor: [0.36, 0.30, 0.24],
    foliageColors: [[0.94, 0.78, 0.22], [0.98, 0.86, 0.38]]
  },
  honeyLocust: {
    leafCell: "fineLeaf", form: "layered", heightRangeMeters: [8, 14], crownWidthRatio: 0.66, clearTrunkRatio: 0.36,
    trunkColor: [0.24, 0.20, 0.17],
    foliageColors: [[0.50, 0.64, 0.24], [0.62, 0.72, 0.30], [0.42, 0.58, 0.22]]
  },
  americanElm: {
    leafCell: "broadleaf", form: "vase", heightRangeMeters: [12, 19], crownWidthRatio: 0.72, clearTrunkRatio: 0.30,
    trunkColor: [0.34, 0.30, 0.26],
    foliageColors: [[0.20, 0.44, 0.21], [0.28, 0.52, 0.25]]
  },
  columnarHornbeam: {
    leafCell: "broadleaf", form: "columnar", heightRangeMeters: [8, 14], crownWidthRatio: 0.32, clearTrunkRatio: 0.12,
    trunkColor: [0.42, 0.42, 0.40],
    foliageColors: [[0.24, 0.48, 0.24], [0.32, 0.56, 0.28]]
  },
  italianCypress: {
    leafCell: "needle", form: "spire", heightRangeMeters: [7, 13], crownWidthRatio: 0.16, clearTrunkRatio: 0.04,
    trunkColor: [0.30, 0.24, 0.20],
    foliageColors: [[0.10, 0.28, 0.16], [0.14, 0.34, 0.19]]
  },
  blueSpruce: {
    leafCell: "needle", form: "conical", heightRangeMeters: [9, 16], crownWidthRatio: 0.42, clearTrunkRatio: 0.04,
    trunkColor: [0.30, 0.22, 0.18],
    foliageColors: [[0.22, 0.38, 0.40], [0.28, 0.46, 0.46]]
  },
  weepingWillow: {
    leafCell: "fineLeaf", form: "weeping", heightRangeMeters: [9, 15], crownWidthRatio: 0.78, clearTrunkRatio: 0.28,
    trunkColor: [0.32, 0.27, 0.20],
    foliageColors: [[0.48, 0.62, 0.26], [0.58, 0.70, 0.32]]
  },
  yoshinoCherry: {
    leafCell: "blossom", form: "rounded", heightRangeMeters: [5, 8], crownWidthRatio: 0.95, clearTrunkRatio: 0.30,
    trunkColor: [0.28, 0.18, 0.16],
    foliageColors: [[0.38, 0.56, 0.26]],
    blossomColors: [[1.0, 0.88, 0.92], [0.98, 0.76, 0.84]]
  },
  kwanzanCherry: {
    leafCell: "blossom", form: "vase", heightRangeMeters: [5, 8.5], crownWidthRatio: 0.90, clearTrunkRatio: 0.32,
    trunkColor: [0.30, 0.19, 0.17],
    foliageColors: [[0.36, 0.54, 0.26]],
    blossomColors: [[0.96, 0.52, 0.70], [1.0, 0.68, 0.82]]
  },
  calleryPear: {
    leafCell: "blossom", form: "rounded", heightRangeMeters: [7, 11], crownWidthRatio: 0.55, clearTrunkRatio: 0.22,
    trunkColor: [0.30, 0.27, 0.24],
    foliageColors: [[0.30, 0.50, 0.24]],
    blossomColors: [[0.98, 0.98, 0.95], [0.92, 0.95, 0.88]]
  },
  saucerMagnolia: {
    leafCell: "blossom", form: "rounded", heightRangeMeters: [5, 8], crownWidthRatio: 0.90, clearTrunkRatio: 0.22,
    trunkColor: [0.50, 0.48, 0.46],
    foliageColors: [[0.34, 0.52, 0.26]],
    blossomColors: [[0.99, 0.88, 0.90], [0.88, 0.50, 0.68]]
  },
  easternRedbud: {
    leafCell: "blossom", form: "vase", heightRangeMeters: [4.5, 7], crownWidthRatio: 1.0, clearTrunkRatio: 0.26,
    trunkColor: [0.26, 0.20, 0.18],
    foliageColors: [[0.34, 0.52, 0.24]],
    blossomColors: [[0.86, 0.36, 0.66], [0.94, 0.52, 0.78]]
  },
  jacaranda: {
    leafCell: "blossom", form: "layered", heightRangeMeters: [7, 11], crownWidthRatio: 0.90, clearTrunkRatio: 0.34,
    trunkColor: [0.32, 0.26, 0.22],
    foliageColors: [[0.30, 0.48, 0.24]],
    blossomColors: [[0.60, 0.46, 0.88], [0.72, 0.60, 0.94]]
  },
  sugarMaple: {
    leafCell: "broadleaf", form: "oval", heightRangeMeters: [10, 17], crownWidthRatio: 0.60, clearTrunkRatio: 0.30,
    trunkColor: [0.36, 0.31, 0.26],
    foliageColors: [[0.92, 0.50, 0.12], [0.96, 0.66, 0.18], [0.80, 0.36, 0.10]]
  },
  norwayMaple: {
    leafCell: "broadleaf", form: "rounded", heightRangeMeters: [9, 15], crownWidthRatio: 0.62, clearTrunkRatio: 0.28,
    trunkColor: [0.30, 0.27, 0.24],
    foliageColors: [[0.12, 0.30, 0.14], [0.16, 0.36, 0.16], [0.20, 0.40, 0.18]]
  },
  zelkova: {
    leafCell: "fineLeaf", form: "vase", heightRangeMeters: [10, 17], crownWidthRatio: 0.70, clearTrunkRatio: 0.32,
    trunkColor: [0.52, 0.50, 0.46],
    foliageColors: [[0.30, 0.50, 0.22], [0.38, 0.58, 0.26], [0.70, 0.50, 0.20]]
  },
  sweetgum: {
    leafCell: "broadleaf", form: "oval", heightRangeMeters: [10, 16], crownWidthRatio: 0.50, clearTrunkRatio: 0.28,
    trunkColor: [0.30, 0.26, 0.22],
    foliageColors: [[0.62, 0.14, 0.20], [0.80, 0.30, 0.14], [0.40, 0.20, 0.36], [0.30, 0.48, 0.20]]
  },
  tulipTree: {
    leafCell: "broadleaf", form: "oval", heightRangeMeters: [14, 22], crownWidthRatio: 0.45, clearTrunkRatio: 0.34,
    trunkColor: [0.40, 0.38, 0.34],
    foliageColors: [[0.34, 0.56, 0.24], [0.44, 0.62, 0.24], [0.70, 0.72, 0.26]]
  },
  whiteBirch: {
    leafCell: "fineLeaf", form: "oval", heightRangeMeters: [8, 13], crownWidthRatio: 0.42, clearTrunkRatio: 0.22,
    trunkColor: [0.86, 0.84, 0.80],
    foliageColors: [[0.44, 0.62, 0.22], [0.56, 0.70, 0.28], [0.86, 0.76, 0.26]]
  },
  floweringDogwood: {
    leafCell: "blossom", form: "broadSpreading", heightRangeMeters: [4, 7], crownWidthRatio: 1.0, clearTrunkRatio: 0.26,
    trunkColor: [0.28, 0.22, 0.18],
    foliageColors: [[0.32, 0.50, 0.24]],
    blossomColors: [[0.98, 0.97, 0.94], [0.98, 0.80, 0.86]]
  },
  crabapple: {
    leafCell: "blossom", form: "rounded", heightRangeMeters: [4.5, 7], crownWidthRatio: 0.95, clearTrunkRatio: 0.26,
    trunkColor: [0.30, 0.22, 0.18],
    foliageColors: [[0.30, 0.48, 0.22]],
    blossomColors: [[0.92, 0.40, 0.56], [0.98, 0.70, 0.80], [0.86, 0.20, 0.30]]
  },
  japaneseMaple: {
    leafCell: "fineLeaf", form: "broadSpreading", heightRangeMeters: [3.5, 6], crownWidthRatio: 1.1, clearTrunkRatio: 0.24,
    trunkColor: [0.32, 0.24, 0.20],
    foliageColors: [[0.62, 0.10, 0.12], [0.76, 0.18, 0.14], [0.52, 0.10, 0.16]]
  },
  easternWhitePine: {
    leafCell: "needle", form: "conical", heightRangeMeters: [12, 20], crownWidthRatio: 0.45, clearTrunkRatio: 0.06,
    trunkColor: [0.28, 0.22, 0.18],
    foliageColors: [[0.16, 0.32, 0.20], [0.20, 0.38, 0.22]]
  }
});

const PARK_TREE_SPECIES = [
  "londonPlane", "pinOak", "americanElm", "weepingWillow", "blueSpruce", "yoshinoCherry",
  "redMaple", "littleleafLinden", "jacaranda", "saucerMagnolia", "ginkgo", "honeyLocust",
  "sugarMaple", "sweetgum", "tulipTree", "whiteBirch", "floweringDogwood", "japaneseMaple",
  "easternWhitePine", "zelkova", "norwayMaple", "crabapple"
];

const PROMENADE_TREE_SPECIES = ["yoshinoCherry", "kwanzanCherry", "littleleafLinden", "calleryPear", "crabapple", "floweringDogwood"];


const TREE_SPECIES_NAMES = Object.keys(TREE_SPECIES);

let treeInstanceSink = null;

function collectTreeInstances(build) {
  const trees = [];
  treeInstanceSink = trees;
  try {
    return { result: build(), trees };
  } finally {
    treeInstanceSink = null;
  }
}

function chooseTreeFromSpecies(speciesNames, { pickSeed, heightSeed }) {
  return describeTreeChoice(speciesNames[Math.floor(pickSeed * speciesNames.length) % speciesNames.length], heightSeed);
}

function roadsideCrownLimits(heightMeters, { overhangCrownRadiusMeters, tightCrownRadiusMeters, tightClearanceMeters = 0 }) {
  if (heightMeters >= TALL_TREE_MIN_HEIGHT_METERS) {
    return { minClearanceMeters: ROAD_OVERHANG_CLEARANCE_METERS, maxCrownRadiusMeters: overhangCrownRadiusMeters };
  }
  return { minClearanceMeters: tightClearanceMeters, maxCrownRadiusMeters: tightCrownRadiusMeters };
}

function plantStreetTree(site) {
  const tree = describeTreeGeometry(site);
  const trunkFootprint = tree.trunkWidth * 1.6;
  registerSolidVolume({ centerX: site.x, centerZ: site.z, sizeAcross: trunkFootprint, sizeAlong: trunkFootprint, yaw: 0, bottomY: site.y, topY: site.y + tree.clearTrunkHeight });
  if (!treeInstanceSink) return;
  treeInstanceSink.push({
    speciesIndex: TREE_SPECIES_NAMES.indexOf(site.speciesName),
    values: [
      site.x, site.y + terrainHeightAt(site.x, site.z), site.z, site.seed * FULL_TURN,
      tree.clearTrunkHeight, tree.crownHeight, tree.crownRadius, tree.trunkWidth,
      site.leanX ?? 0, site.leanZ ?? 0, 0.5 * Math.sqrt(tree.crownRadius * tree.crownHeight), site.seed
    ]
  });
}

function buildFoliageAssets() {
  return { treeSpeciesMeshes: buildTreeMeshLibrary(), leafAtlasMipChain: generateLeafAtlasMipChain() };
}

function buildTreeMeshLibrary() {
  return TREE_SPECIES_NAMES.map((speciesName, speciesIndex) => {
    return TREE_LOD_SETTINGS.map((lodSettings, lod) => buildSpeciesMesh(TREE_SPECIES[speciesName], lodSettings, makeRng(1000 + speciesIndex * 37 + lod * 7)));
  });
}

function describeTreeChoice(speciesName, heightSeed) {
  const [shortestMeters, tallestMeters] = TREE_SPECIES[speciesName].heightRangeMeters;
  return { speciesName, heightMeters: shortestMeters + (tallestMeters - shortestMeters) * heightSeed };
}

function describeTreeGeometry(site) {
  const species = TREE_SPECIES[site.speciesName];
  const heightMeters = site.heightMeters;
  const naturalRadius = heightMeters * species.crownWidthRatio * 0.5;
  const crownRadius = Math.min(naturalRadius, site.maxCrownRadiusMeters ?? naturalRadius);
  const naturalClearance = heightMeters * species.clearTrunkRatio;
  const clearTrunkHeight = Math.max(0.6, Math.min(Math.max(naturalClearance, site.minClearanceMeters ?? 0), heightMeters - 2.0));
  return {
    crownRadius,
    clearTrunkHeight,
    crownHeight: heightMeters - clearTrunkHeight,
    trunkWidth: 0.16 + heightMeters * 0.026
  };
}

function lobe(center, radiusX, radiusY) {
  return { center, radiusX, radiusY };
}

function buildSpeciesMesh(species, lodSettings, rng) {
  const form = CROWN_FORMS[species.form];
  const builder = new TreeMeshBuilder();
  addTrunkAndLimbs(builder, { species, form, lodSettings, rng });
  const coreColor = crownCoreColor(species);
  for (const core of form.cores) {
    builder.addFoliageCore({
      ...core,
      radiusX: core.radiusX * CROWN_CORE_SHRINK,
      radiusY: core.radiusY * CROWN_CORE_SHRINK,
      slices: lodSettings.coreSlices,
      stacks: lodSettings.coreStacks,
      color: coreColor,
      occlusion: 0.62
    });
  }
  const strandCount = form.hasHangingStrands ? Math.round(lodSettings.cardCount * 0.3) : 0;
  for (let card = 0; card < lodSettings.cardCount - strandCount; card++) {
    addCrownCard(builder, { species, form, lodSettings, rng });
  }
  for (let strand = 0; strand < strandCount; strand++) {
    addHangingStrand(builder, { species, lodSettings, rng, angle: (strand / strandCount) * FULL_TURN + rng() * 0.3 });
  }
  return builder.build();
}

function addTrunkAndLimbs(builder, { species, form, lodSettings, rng }) {
  const bark = { sides: lodSettings.barkSides, color: species.trunkColor, occlusion: 0.85 };
  const roots = planRoots(lodSettings.rootCount, rng);
  builder.addTube(trunkRings(form, roots, rng), bark);
  for (const root of roots) {
    builder.addTube(rootRings(root), { ...bark, sides: lodSettings.rootSides, occlusion: 0.72 });
  }
  const limbSides = Math.max(3, Math.round(lodSettings.barkSides / 2));
  for (let limb = 0; limb < lodSettings.limbCount; limb++) {
    const points = limbPoints(form.limbStyle, limb, lodSettings.limbCount);
    if (points) builder.addTube(points, { ...bark, sides: limbSides });
  }
}

function planRoots(rootCount, rng) {
  const angleJitter = rootCount ? FULL_TURN / rootCount * 0.35 : 0;
  return Array.from({ length: rootCount }, (_, rootIndex) => ({
    angle: (rootIndex / rootCount) * FULL_TURN + (rng() - 0.5) * angleJitter,
    reach: 1.6 + rng() * 0.9,
    rise: 0.5 + rng() * 0.3,
    thickness: 0.8 + rng() * 0.4,
    wander: (rng() - 0.5) * 0.5
  }));
}

function trunkRings(form, roots, rng) {
  const wobble = { phaseA: rng() * FULL_TURN, phaseB: rng() * FULL_TURN };
  const flare = TRUNK_FLARE_RINGS.map(ring => ({
    anchor: [0, ring.anchorY, 0],
    shift: [0, ring.rise, 0],
    radius: ring.radius,
    radiusScaleAt: trunkCrossSection(roots, ring.buttressDepth, wobble)
  }));
  const shaft = TRUNK_SHAFT_RINGS.map(ring => ({
    anchor: [0, ring.anchorY, 0],
    radius: ring.radius,
    radiusScaleAt: trunkCrossSection(roots, ring.buttressDepth, wobble)
  }));
  const crownJoin = form.trunkTop > 0.08 ? [{ anchor: [0, form.trunkTop, 0], radius: 0.26 }] : [];
  return [...flare, ...shaft, ...crownJoin];
}

function trunkCrossSection(roots, buttressDepth, wobble) {
  return azimuth => {
    const buttress = roots.reduce((strongest, root) => Math.max(strongest, buttressBulge(azimuth, root)), 0);
    const barkWobble = 0.035 * Math.sin(3 * azimuth + wobble.phaseA) + 0.025 * Math.sin(5 * azimuth + wobble.phaseB);
    return 1 + buttressDepth * (buttress - BUTTRESS_MEAN_BULGE) + barkWobble;
  };
}

function buttressBulge(azimuth, root) {
  const separation = Math.atan2(Math.sin(azimuth - root.angle), Math.cos(azimuth - root.angle));
  return root.thickness * Math.exp(-((separation / BUTTRESS_ANGULAR_WIDTH) ** 2));
}

function rootRings(root) {
  return ROOT_PROFILE.map(({ along, radius }) => {
    const heading = root.angle + root.wander * along;
    const outward = ROOT_START_REACH + along * root.reach;
    const height = root.rise * (1 - along) ** 2 - ROOT_TIP_DEPTH * along;
    return {
      anchor: [0, GROUND_ANCHOR_Y, 0],
      shift: [Math.cos(heading) * outward, height, Math.sin(heading) * outward],
      radius: radius * root.thickness
    };
  });
}

function limbPoints(limbStyle, limb, limbCount) {
  const angle = (limb / limbCount) * FULL_TURN + 0.4;
  const directionX = Math.cos(angle), directionZ = Math.sin(angle);
  const along = (distance, height, radius) => ({ anchor: [directionX * distance, height, directionZ * distance], radius });
  if (limbStyle === "spreading") {
    const startHeight = 0.05 + (limb % 3) * 0.05;
    return [along(0, startHeight, 0.3), along(0.3, startHeight + 0.22, 0.2), along(0.62, startHeight + 0.45, 0.09)];
  }
  if (limbStyle === "vase") {
    return [along(0, 0, 0.32), along(0.32, 0.3, 0.22), along(0.6, 0.6, 0.1)];
  }
  if (limbStyle === "layered") {
    const startHeight = 0.12 + (limb / limbCount) * 0.5;
    return [along(0, startHeight, 0.2), along(0.55, startHeight + 0.12, 0.07)];
  }
  return null;
}

function addCrownCard(builder, { species, form, lodSettings, rng }) {
  const placement = form.lobes.length ? sampleLobeSurface(form.lobes, rng) : sampleConeSurface(rng);
  const usesBlossomCell = !!species.blossomColors && rng() < BLOSSOM_CARD_SHARE;
  const halfWidth = lodSettings.cardHalfSize * (0.8 + rng() * 0.4);
  builder.addCard({
    anchor: placement.anchor,
    halfWidth,
    halfHeight: halfWidth * (0.85 + rng() * 0.3),
    kind: TREE_VERTEX_KIND[form.cardKind],
    leafColor: pickCardColor(species.foliageColors, rng),
    bloomColor: usesBlossomCell ? pickCardColor(species.blossomColors, rng) : pickCardColor(species.foliageColors, rng),
    occlusion: placement.occlusion,
    atlasCell: LEAF_ATLAS_CELL[usesBlossomCell ? "blossom" : (species.blossomColors ? "broadleaf" : species.leafCell)],
    isMirrored: rng() < 0.5
  });
}

function addHangingStrand(builder, { species, lodSettings, rng, angle }) {
  const reach = 0.82 + rng() * 0.14;
  builder.addCard({
    anchor: [Math.cos(angle) * reach, -0.15 + rng() * 0.3, Math.sin(angle) * reach],
    halfWidth: lodSettings.cardHalfSize * 0.55,
    halfHeight: lodSettings.cardHalfSize * 1.9,
    kind: TREE_VERTEX_KIND.uprightCard,
    leafColor: pickCardColor(species.foliageColors, rng),
    bloomColor: pickCardColor(species.foliageColors, rng),
    occlusion: 0.75 + rng() * 0.2,
    atlasCell: LEAF_ATLAS_CELL.fineLeaf,
    isMirrored: rng() < 0.5
  });
}

function sampleLobeSurface(lobes, rng) {
  const weights = lobes.map(candidate => candidate.radiusX * candidate.radiusX * candidate.radiusY);
  let pick = rng() * weights.reduce((sum, weight) => sum + weight, 0);
  let chosen = lobes[lobes.length - 1];
  for (let index = 0; index < lobes.length; index++) {
    pick -= weights[index];
    if (pick <= 0) { chosen = lobes[index]; break; }
  }
  const direction = randomUnitVector(rng);
  const shellDepth = 0.45 + 0.55 * Math.sqrt(rng());
  const anchor = [
    clamp(chosen.center[0] + direction[0] * chosen.radiusX * shellDepth, -1.05, 1.05),
    Math.max(0.02, chosen.center[1] + direction[1] * chosen.radiusY * shellDepth),
    clamp(chosen.center[2] + direction[2] * chosen.radiusX * shellDepth, -1.05, 1.05)
  ];
  const undersideShade = direction[1] < -0.4 ? 0.1 : 0.0;
  return { anchor, occlusion: clamp(0.42 + 0.45 * shellDepth + 0.18 * anchor[1] - undersideShade, 0.35, 1.0) };
}

function sampleConeSurface(rng) {
  const height = 1 - Math.sqrt(rng());
  const angle = rng() * FULL_TURN;
  const radius = (1 - height) * 0.95 * (0.75 + rng() * 0.25);
  return {
    anchor: [Math.cos(angle) * radius, Math.max(0.02, height), Math.sin(angle) * radius],
    occlusion: clamp(0.5 + 0.35 * height + rng() * 0.15, 0.35, 1.0)
  };
}

function randomUnitVector(rng) {
  const height = rng() * 2 - 1;
  const angle = rng() * FULL_TURN;
  const ringRadius = Math.sqrt(1 - height * height);
  return [Math.cos(angle) * ringRadius, height, Math.sin(angle) * ringRadius];
}

function pickCardColor(palette, rng) {
  const base = palette[Math.floor(rng() * palette.length) % palette.length];
  const brightness = 0.88 + rng() * 0.24;
  return [Math.min(1, base[0] * brightness), Math.min(1, base[1] * brightness), Math.min(1, base[2] * brightness)];
}

function crownCoreColor(species) {
  const leaf = species.foliageColors[0];
  const bloom = species.blossomColors ? species.blossomColors[1] : leaf;
  return [(leaf[0] + bloom[0]) * 0.42, (leaf[1] + bloom[1]) * 0.42, (leaf[2] + bloom[2]) * 0.42];
}
