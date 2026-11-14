// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar
const SURFACE_TEXTURE_SIZE=1024,SURFACE_TEXTURE_FORMAT="rgba8unorm",SURFACE_DETAIL_LAYER=Object.freeze({asphalt:0,paving:1,ground:2,bark:3,setts:4,herringbone:5,moss:6}),PAVING_TILE_METERS=7.2727,SETT_TILE_METERS=4,HERRINGBONE_TILE_METERS=3.84,MOSS_TILE_METERS=.6,SURFACE_DETAIL_LAYER_COUNT=Object.keys(SURFACE_DETAIL_LAYER).length,SURFACE_GENERATION_UNIFORM_BYTES=16,FULLSCREEN_TRIANGLE_VERTEX_COUNT=3,TRANSPARENT_BLACK=Object.freeze({r:0,g:0,b:0,a:0}),SURFACE_FULLSCREEN_WGSL=`
@vertex
fn vs_fullscreen(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4<f32> {
  var corners = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  return vec4<f32>(corners[vertexIndex], 0.0, 1.0);
}

struct SurfaceTexels {
  @location(0) albedoHeight : vec4<f32>,
  @location(1) relief : vec4<f32>,
};
`,SURFACE_GENERATION_WGSL=SURFACE_FULLSCREEN_WGSL+`
@group(0) @binding(0) var<uniform> generation : vec4<f32>;

const LAYER_ASPHALT : i32 = ${SURFACE_DETAIL_LAYER.asphalt};
const LAYER_PAVING : i32 = ${SURFACE_DETAIL_LAYER.paving};
const LAYER_GROUND : i32 = ${SURFACE_DETAIL_LAYER.ground};
const LAYER_SETTS : i32 = ${SURFACE_DETAIL_LAYER.setts};
const LAYER_HERRINGBONE : i32 = ${SURFACE_DETAIL_LAYER.herringbone};
const LAYER_MOSS : i32 = ${SURFACE_DETAIL_LAYER.moss};

const PAVING_SLABS_PER_TILE = 4.0;
const PAVING_TILE_METERS = ${PAVING_TILE_METERS};
const PAVING_SLAB_METERS = PAVING_TILE_METERS / PAVING_SLABS_PER_TILE;
const MOSS_TILE_METERS = ${MOSS_TILE_METERS};
const MOSS_CUSHIONS_PER_METER = 26.0;
const MOSS_ROSETTES_PER_METER = 240.0;
const MOSS_FIBERS_PER_METER = 900.0;
const MOSS_DRYNESS_PER_METER = 4.0;
const MOSS_FRINGE_PER_METER = 140.0;
const MOSS_LEAFLETS_PER_ROSETTE = 5.0;
const MOSS_CUSHION_WARP = 1.1;
const TEXELS_PER_SPRIG_MINIMUM = 2.2;
const SETT_ROWS_PER_TILE = 28.0;
const SETTS_PER_ROW = 18.0;
const SETT_TILE_METERS = ${SETT_TILE_METERS};
const HERRINGBONE_CELLS_PER_TILE = 32;
const HERRINGBONE_TILE_METERS = ${HERRINGBONE_TILE_METERS};
const HERRINGBONE_BRICK_LENGTH_CELLS = 2.0;
const HERRINGBONE_DIAGONAL_PERIOD = 4;
const BARK_PLATE_PERIOD = vec2<i32>(8, 12);
const BARK_CRACK_PERIOD = vec2<i32>(20, 28);
const BARK_PLATE_STRETCH = vec2<f32>(1.0, 0.4);
const BARK_PLATE_ROW_REACH = 3;
const BARK_WARP_REACH = vec2<f32>(0.06, 0.09);

struct SurfaceSample {
  albedo : vec3<f32>,
  height : f32,
  gloss : f32,
  crevice : f32,
};

struct PaverCell {
  brickId : f32,
  edgeMeters : f32,
  centerOffset : vec2<f32>,
};

struct MossSample {
  albedo : vec3<f32>,
  height : f32,
};

struct MossCover {
  amount : f32,
  albedo : vec3<f32>,
  height : f32,
};

struct NearestFeature {
  offset : vec2<f32>,
  distance : f32,
  edgeDistance : f32,
  cellId : f32,
};

struct BarkPlate {
  edgeDistance : f32,
  centerDistance : f32,
  plateId : f32,
};

struct CellSample {
  nearest : f32,
  secondNearest : f32,
  cellId : f32,
};

fn hashCell(cell : vec2<i32>, seed : u32) -> f32 {
  var h = (u32(cell.x) * 1597334677u) ^ (u32(cell.y) * 3812015801u) ^ (seed * 2654435761u);
  h = (h ^ (h >> 16u)) * 2246822519u;
  h = (h ^ (h >> 13u)) * 3266489917u;
  h = h ^ (h >> 16u);
  return f32(h) / 4294967295.0;
}

fn wrapCell(cell : vec2<i32>, period : vec2<i32>) -> vec2<i32> {
  return ((cell % period) + period) % period;
}

fn tiledNoise(uv : vec2<f32>, period : vec2<i32>, seed : u32) -> f32 {
  let scaled = uv * vec2<f32>(period);
  let base = vec2<i32>(floor(scaled));
  let f = fract(scaled);
  let w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  let a = hashCell(wrapCell(base, period), seed);
  let b = hashCell(wrapCell(base + vec2<i32>(1, 0), period), seed);
  let c = hashCell(wrapCell(base + vec2<i32>(0, 1), period), seed);
  let d = hashCell(wrapCell(base + vec2<i32>(1, 1), period), seed);
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

fn tiledFbm(uv : vec2<f32>, period : vec2<i32>, octaves : i32, seed : u32) -> f32 {
  var total = 0.0;
  var weight = 0.0;
  var amplitude = 0.5;
  var octavePeriod = period;
  for (var octave = 0; octave < octaves; octave++) {
    total += amplitude * tiledNoise(uv, octavePeriod, seed + u32(octave) * 101u);
    weight += amplitude;
    amplitude *= 0.5;
    octavePeriod *= 2;
  }
  return total / weight;
}

fn tiledCells(uv : vec2<f32>, period : vec2<i32>, seed : u32) -> CellSample {
  let scaled = uv * vec2<f32>(period);
  let base = vec2<i32>(floor(scaled));
  var result = CellSample(8.0, 8.0, 0.0);
  for (var offsetY = -1; offsetY <= 1; offsetY++) {
    for (var offsetX = -1; offsetX <= 1; offsetX++) {
      let neighbor = base + vec2<i32>(offsetX, offsetY);
      let wrapped = wrapCell(neighbor, period);
      let jitter = vec2<f32>(hashCell(wrapped, seed), hashCell(wrapped, seed + 7u));
      let featureDistance = length(vec2<f32>(neighbor) + 0.1 + jitter * 0.8 - scaled);
      if (featureDistance < result.nearest) {
        result.secondNearest = result.nearest;
        result.nearest = featureDistance;
        result.cellId = hashCell(wrapped, seed + 13u);
      } else if (featureDistance < result.secondNearest) {
        result.secondNearest = featureDistance;
      }
    }
  }
  return result;
}

fn tiledNearestFeature(uv : vec2<f32>, period : vec2<i32>, seed : u32) -> NearestFeature {
  let scaled = uv * vec2<f32>(period);
  let base = vec2<i32>(floor(scaled));
  var nearest = NearestFeature(vec2<f32>(8.0), 8.0, 8.0, 0.0);
  var secondDistance = 8.0;
  for (var offsetY = -1; offsetY <= 1; offsetY++) {
    for (var offsetX = -1; offsetX <= 1; offsetX++) {
      let neighbor = base + vec2<i32>(offsetX, offsetY);
      let wrapped = wrapCell(neighbor, period);
      let jitter = vec2<f32>(hashCell(wrapped, seed), hashCell(wrapped, seed + 7u));
      let toFragment = scaled - (vec2<f32>(neighbor) + 0.1 + jitter * 0.8);
      let featureDistance = length(toFragment);
      if (featureDistance < nearest.distance) {
        secondDistance = nearest.distance;
        nearest = NearestFeature(toFragment, featureDistance, 0.0, hashCell(wrapped, seed + 13u));
      } else if (featureDistance < secondDistance) {
        secondDistance = featureDistance;
      }
    }
  }
  nearest.edgeDistance = secondDistance - nearest.distance;
  return nearest;
}

fn thinLine(field : f32, halfWidth : f32) -> f32 {
  return 1.0 - smoothstep(0.0, halfWidth, abs(field - 0.5));
}

fn cellsPerTile(featuresPerMeter : f32, tileMeters : f32) -> vec2<i32> {
  let finestAllowed = generation.y / TEXELS_PER_SPRIG_MINIMUM;
  return vec2<i32>(i32(max(1.0, round(min(featuresPerMeter * tileMeters, finestAllowed)))));
}

fn mossDetail(uv : vec2<f32>, tileMeters : f32, seed : u32) -> MossSample {
  let cushionPeriod = cellsPerTile(MOSS_CUSHIONS_PER_METER, tileMeters);
  let warpReach = MOSS_CUSHION_WARP / f32(cushionPeriod.x);
  let cushionWarp = vec2<f32>(tiledFbm(uv, cushionPeriod, 3, seed + 41u), tiledFbm(uv, cushionPeriod, 3, seed + 43u)) - 0.5;
  let cushion = tiledNearestFeature(uv + cushionWarp * warpReach, cushionPeriod, seed);
  let rosette = tiledNearestFeature(uv, cellsPerTile(MOSS_ROSETTES_PER_METER, tileMeters), seed + 7u);
  let fibers = tiledNoise(uv, cellsPerTile(MOSS_FIBERS_PER_METER, tileMeters), seed + 11u);
  let dryness = smoothstep(0.58, 0.82, tiledFbm(uv, cellsPerTile(MOSS_DRYNESS_PER_METER, tileMeters), 4, seed + 17u));

  let cushionDome = 1.0 - smoothstep(0.1, 0.95, cushion.distance);
  let cushionGap = 0.35 + 0.65 * smoothstep(0.0, 0.14, cushion.edgeDistance);
  let leafletAngle = atan2(rosette.offset.y, rosette.offset.x) + rosette.cellId * 6.2831853;
  let leafletReach = 0.40 + 0.16 * cos(leafletAngle * MOSS_LEAFLETS_PER_ROSETTE);
  let leaflet = 1.0 - smoothstep(leafletReach, leafletReach + 0.14, rosette.distance);
  let leafletTip = leaflet * smoothstep(0.05, 0.3, rosette.distance);
  let rosetteHeart = 1.0 - smoothstep(0.0, 0.12, rosette.distance);

  let crevice = vec3<f32>(0.06, 0.11, 0.04);
  let cushionTone = mix(vec3<f32>(0.14, 0.27, 0.07), vec3<f32>(0.25, 0.39, 0.10), cushion.cellId);
  let leafletGreen = mix(cushionTone, cushionTone * vec3<f32>(1.25, 1.2, 1.1), rosette.cellId);
  let sunlitTip = mix(vec3<f32>(0.46, 0.55, 0.18), vec3<f32>(0.56, 0.60, 0.22), fibers);
  let driedStrands = vec3<f32>(0.40, 0.35, 0.18) * (0.8 + fibers * 0.4);

  let canopy = leaflet * cushionGap * (0.55 + cushionDome * 0.45);
  var albedo = mix(crevice, leafletGreen * (0.75 + fibers * 0.3), canopy);
  albedo = mix(albedo, sunlitTip, leafletTip * cushionDome * 0.6);
  albedo = mix(albedo, leafletGreen * 0.6, rosetteHeart * 0.5);
  albedo = mix(albedo, driedStrands, dryness * canopy * 0.6);

  let height = cushionDome * cushionGap * 0.55 + leaflet * 0.3 + fibers * 0.08 + leafletTip * 0.07;
  return MossSample(albedo, clamp(height, 0.0, 1.0));
}

fn jointMoss(uv : vec2<f32>, metersFromJoint : f32, tileMeters : f32, seed : u32) -> MossCover {
  let colonies = smoothstep(0.5, 0.78, tiledFbm(uv, cellsPerTile(1.6, tileMeters), 4, seed));
  let reachMeters = 0.003 + colonies * 0.026;
  let fringe = tiledFbm(uv, cellsPerTile(MOSS_FRINGE_PER_METER, tileMeters), 3, seed + 3u) - 0.5;
  let raggedDistance = metersFromJoint + fringe * reachMeters * 0.9;
  let amount = colonies * (1.0 - smoothstep(reachMeters * 0.35, reachMeters, raggedDistance));
  let moss = mossDetail(uv, tileMeters, seed + 29u);
  let edgeThinning = smoothstep(0.0, 0.5, amount) * (0.55 + moss.height * 0.6);
  return MossCover(clamp(edgeThinning, 0.0, 1.0), moss.albedo, moss.height);
}

fn coverWithMoss(surface : SurfaceSample, moss : MossCover) -> SurfaceSample {
  let cushionHeight = 0.5 + moss.height * 0.4;
  return SurfaceSample(
    mix(surface.albedo, moss.albedo, moss.amount),
    mix(surface.height, max(surface.height, cushionHeight), moss.amount),
    mix(surface.gloss, 0.04, moss.amount),
    surface.crevice * (1.0 - moss.amount * 0.8)
  );
}

fn mossSurface(uv : vec2<f32>) -> SurfaceSample {
  let moss = mossDetail(uv, MOSS_TILE_METERS, 601u);
  return SurfaceSample(moss.albedo, moss.height, 0.05, 1.0 - moss.height);
}

fn asphaltSurface(uv : vec2<f32>) -> SurfaceSample {
  let coarseStones = tiledCells(uv, vec2<i32>(110), 11u);
  let fineStones = tiledCells(uv, vec2<i32>(260), 23u);
  let binderGrain = tiledFbm(uv, vec2<i32>(64), 4, 31u);
  let oxidation = tiledFbm(uv, vec2<i32>(4), 4, 41u);
  let tarBleed = tiledFbm(uv, vec2<i32>(12), 3, 53u);

  let coarseRadius = 0.30 + coarseStones.cellId * 0.16;
  let coarseStoneMask = smoothstep(coarseRadius, coarseRadius - 0.12, coarseStones.nearest) * step(0.35, coarseStones.cellId);
  let fineStoneMask = smoothstep(0.38, 0.22, fineStones.nearest) * step(0.45, fineStones.cellId);
  let exposedStone = max(coarseStoneMask, fineStoneMask * 0.8) * (0.55 + tarBleed * 0.6);

  let stoneHue = mix(vec3<f32>(1.0, 0.97, 0.93), vec3<f32>(0.93, 0.96, 1.0), fract(coarseStones.cellId * 7.3));
  let stoneColor = stoneHue * (0.27 + fract(coarseStones.cellId * 3.1 + fineStones.cellId) * 0.14);
  let binderColor = vec3<f32>(0.18 + binderGrain * 0.06 + oxidation * 0.05);
  let albedo = mix(binderColor, stoneColor, clamp(exposedStone, 0.0, 1.0));

  let crackField = max(thinLine(tiledFbm(uv, vec2<i32>(5), 5, 67u), 0.010), thinLine(tiledFbm(uv, vec2<i32>(9), 5, 71u), 0.007) * 0.7);
  let surfaceHeight = binderGrain * 0.25 + coarseStoneMask * 0.55 + fineStoneMask * 0.30;
  return SurfaceSample(albedo, surfaceHeight, mix(0.40, 0.14, clamp(exposedStone, 0.0, 1.0)), crackField);
}

fn pavingSurface(uv : vec2<f32>) -> SurfaceSample {
  let slabCoord = uv * PAVING_SLABS_PER_TILE;
  let slabCell = vec2<i32>(floor(slabCoord));
  let slabLocal = fract(slabCoord);
  let slabPeriod = vec2<i32>(i32(PAVING_SLABS_PER_TILE));
  let slabId = hashCell(wrapCell(slabCell, slabPeriod), 101u);
  let slabTiltAngle = hashCell(wrapCell(slabCell, slabPeriod), 103u) * 6.2832;

  let edgeDistance = min(min(slabLocal.x, 1.0 - slabLocal.x), min(slabLocal.y, 1.0 - slabLocal.y)) * PAVING_SLAB_METERS;
  let cornerDistance = length(min(slabLocal, 1.0 - slabLocal)) * PAVING_SLAB_METERS;
  let jointMask = 1.0 - smoothstep(0.003, 0.007, edgeDistance);
  let bevel = smoothstep(0.004, 0.022, edgeDistance);
  let cornerChip = (1.0 - smoothstep(0.02, 0.05 + slabId * 0.04, cornerDistance)) * step(0.7, fract(slabId * 5.7));

  let concreteGrain = tiledFbm(uv, vec2<i32>(96), 4, 113u);
  let aggregate = tiledCells(uv, vec2<i32>(420), 127u);
  let speckle = smoothstep(0.30, 0.15, aggregate.nearest) * (aggregate.cellId - 0.5);
  let staining = tiledFbm(uv, vec2<i32>(3), 4, 131u);
  let slabCrack = thinLine(tiledFbm(uv, vec2<i32>(12), 4, 137u), 0.008) * step(0.82, slabId) * bevel;

  let slabHue = stoneHueVariation(slabId);
  var albedo = vec3<f32>(0.52) * slabHue * (0.92 + slabId * 0.14) * (0.92 + concreteGrain * 0.16) * (0.90 + staining * 0.16) + vec3<f32>(speckle * 0.18);
  albedo = mix(albedo, vec3<f32>(0.20, 0.19, 0.18), max(jointMask, cornerChip * 0.6));
  albedo *= 1.0 - slabCrack * 0.5;

  let tilt = dot(slabLocal - 0.5, vec2<f32>(cos(slabTiltAngle), sin(slabTiltAngle))) * 0.06;
  let surfaceHeight = bevel * (0.62 + tilt + concreteGrain * 0.08 + speckle * 0.05) - slabCrack * 0.25 - cornerChip * 0.2;
  let stone = SurfaceSample(albedo, clamp(surfaceHeight, 0.0, 1.0), 0.22 + concreteGrain * 0.1, max(jointMask, slabCrack));
  return coverWithMoss(stone, jointMoss(uv, edgeDistance, PAVING_TILE_METERS, 149u));
}

fn stoneHueVariation(stoneId : f32) -> vec3<f32> {
  let warmGrey = vec3<f32>(1.02, 1.0, 0.97);
  let coolGrey = vec3<f32>(0.97, 0.99, 1.02);
  let rosyGranite = vec3<f32>(1.04, 0.98, 0.96);
  let hueChoice = fract(stoneId * 7.31);
  return select(mix(warmGrey, coolGrey, hueChoice / 0.9), rosyGranite, hueChoice > 0.9);
}

fn settCell(uv : vec2<f32>) -> PaverCell {
  let rowCoord = uv.y * SETT_ROWS_PER_TILE;
  let row = i32(floor(rowCoord));
  let rowPeriod = vec2<i32>(1, i32(SETT_ROWS_PER_TILE));
  let rowShift = hashCell(wrapCell(vec2<i32>(0, row), rowPeriod), 401u);
  let columnCoord = uv.x * SETTS_PER_ROW + rowShift;
  let column = i32(floor(columnCoord));
  let settPeriod = vec2<i32>(i32(SETTS_PER_ROW), i32(SETT_ROWS_PER_TILE));
  let local = vec2<f32>(fract(columnCoord), fract(rowCoord));
  let settMeters = vec2<f32>(SETT_TILE_METERS / SETTS_PER_ROW, SETT_TILE_METERS / SETT_ROWS_PER_TILE);
  let edgeMeters = min(min(local.x, 1.0 - local.x) * settMeters.x, min(local.y, 1.0 - local.y) * settMeters.y);
  return PaverCell(hashCell(wrapCell(vec2<i32>(column, row), settPeriod), 409u), edgeMeters, local - 0.5);
}

fn settsSurface(uv : vec2<f32>) -> SurfaceSample {
  let sett = settCell(uv);
  let jointMask = 1.0 - smoothstep(0.005, 0.011, sett.edgeMeters);
  let roundedShoulder = smoothstep(0.004, 0.04, sett.edgeMeters);
  let crown = 1.0 - dot(sett.centerOffset, sett.centerOffset) * (0.9 + sett.brickId * 0.6);
  let sunkenSett = step(0.9, fract(sett.brickId * 13.7)) * 0.18;

  let graniteGrain = tiledCells(uv, vec2<i32>(380), 421u);
  let crystals = smoothstep(0.32, 0.12, graniteGrain.nearest) * (graniteGrain.cellId - 0.45);
  let mottling = tiledFbm(uv, vec2<i32>(40), 4, 431u);
  let jointGrit = tiledNoise(uv, vec2<i32>(512), 433u);

  let topPolish = roundedShoulder * smoothstep(0.2, 0.9, crown);
  var albedo = vec3<f32>(0.46) * stoneHueVariation(sett.brickId) * (0.78 + sett.brickId * 0.36) * (0.9 + mottling * 0.2) + vec3<f32>(crystals * 0.22);
  albedo *= 0.92 + topPolish * 0.1;
  albedo = mix(albedo, vec3<f32>(0.17, 0.16, 0.14) * (0.8 + jointGrit * 0.4), jointMask);

  let surfaceHeight = roundedShoulder * (0.5 + crown * 0.35 + mottling * 0.06 - sunkenSett) + crystals * 0.03;
  let stone = SurfaceSample(albedo, clamp(surfaceHeight, 0.0, 1.0), 0.16 + topPolish * 0.3, jointMask);
  return coverWithMoss(stone, jointMoss(uv, sett.edgeMeters, SETT_TILE_METERS, 439u));
}

fn herringboneCell(uv : vec2<f32>) -> PaverCell {
  let cellCoord = uv * f32(HERRINGBONE_CELLS_PER_TILE);
  let cell = vec2<i32>(floor(cellCoord));
  let local = fract(cellCoord);
  let diagonalPhase = ((cell.x - cell.y) % HERRINGBONE_DIAGONAL_PERIOD + HERRINGBONE_DIAGONAL_PERIOD) % HERRINGBONE_DIAGONAL_PERIOD;
  let isHorizontalBrick = diagonalPhase <= 1;
  let isSecondHalf = diagonalPhase == 1 || diagonalPhase == 2;
  let halfOffset = select(0.0, 1.0, isSecondHalf);
  let originShift = select(vec2<i32>(0, select(0, 1, isSecondHalf)), vec2<i32>(select(0, 1, isSecondHalf), 0), isHorizontalBrick);
  let brickOrigin = wrapCell(cell - originShift, vec2<i32>(HERRINGBONE_CELLS_PER_TILE));
  let along = select(local.y, local.x, isHorizontalBrick) + halfOffset;
  let across = select(local.x, local.y, isHorizontalBrick);
  let cellMeters = HERRINGBONE_TILE_METERS / f32(HERRINGBONE_CELLS_PER_TILE);
  let edgeMeters = min(min(along, HERRINGBONE_BRICK_LENGTH_CELLS - along), min(across, 1.0 - across)) * cellMeters;
  let brickId = hashCell(brickOrigin, select(503u, 509u, isHorizontalBrick));
  let centerOffset = vec2<f32>(along / HERRINGBONE_BRICK_LENGTH_CELLS - 0.5, across - 0.5);
  return PaverCell(brickId, edgeMeters, centerOffset);
}

fn herringboneSurface(uv : vec2<f32>) -> SurfaceSample {
  let paver = herringboneCell(uv);
  let jointMask = 1.0 - smoothstep(0.003, 0.007, paver.edgeMeters);
  let chamfer = smoothstep(0.003, 0.012, paver.edgeMeters);
  let cornerDistance = length(abs(paver.centerOffset) - vec2<f32>(0.5)) * 0.12;
  let cornerChip = (1.0 - smoothstep(0.004, 0.018, cornerDistance)) * step(0.75, fract(paver.brickId * 9.3));

  let clayGrain = tiledFbm(uv, vec2<i32>(128), 4, 521u);
  let firingFlash = smoothstep(0.35, 0.0, abs(paver.centerOffset.x + (paver.brickId - 0.5) * 0.6)) * step(0.7, fract(paver.brickId * 4.1));
  let jointSand = tiledNoise(uv, vec2<i32>(512), 529u);

  let paverTone = mix(vec3<f32>(1.03, 0.99, 0.96), vec3<f32>(0.95, 0.97, 1.0), fract(paver.brickId * 5.9));
  var albedo = vec3<f32>(0.5) * paverTone * (0.80 + paver.brickId * 0.34) * (0.92 + clayGrain * 0.16);
  albedo *= 1.0 - firingFlash * 0.18;
  albedo = mix(albedo, vec3<f32>(0.30, 0.28, 0.24) * (0.85 + jointSand * 0.3), max(jointMask, cornerChip * 0.5));

  let tilt = (paver.brickId - 0.5) * paver.centerOffset.x * 0.08;
  let surfaceHeight = chamfer * (0.6 + tilt + clayGrain * 0.08) - cornerChip * 0.2;
  let paverSurface = SurfaceSample(albedo, clamp(surfaceHeight, 0.0, 1.0), 0.2 + clayGrain * 0.08, jointMask);
  return coverWithMoss(paverSurface, jointMoss(uv, paver.edgeMeters, HERRINGBONE_TILE_METERS, 541u));
}

fn groundSurface(uv : vec2<f32>) -> SurfaceSample {
  let soil = tiledFbm(uv, vec2<i32>(48), 5, 211u);
  let pebbles = tiledCells(uv, vec2<i32>(140), 223u);
  let pebbleMask = smoothstep(0.30, 0.18, pebbles.nearest) * step(0.55, pebbles.cellId);
  let grit = tiledNoise(uv, vec2<i32>(512), 229u);
  let clumps = smoothstep(0.55, 0.72, tiledFbm(uv, vec2<i32>(24), 4, 239u));
  let soilColor = vec3<f32>(0.46, 0.42, 0.36) * (0.80 + soil * 0.35 + (grit - 0.5) * 0.12);
  let pebbleColor = vec3<f32>(0.58, 0.56, 0.53) * (0.85 + pebbles.cellId * 0.3);
  var albedo = mix(soilColor, pebbleColor, pebbleMask);
  albedo = mix(albedo, albedo * vec3<f32>(0.82, 0.95, 0.78), clumps * 0.6);
  let surfaceHeight = soil * 0.45 + pebbleMask * 0.35 + clumps * 0.15 + grit * 0.05;
  return SurfaceSample(albedo, surfaceHeight, 0.08 + pebbleMask * 0.12, (1.0 - soil) * 0.3);
}

fn barkPlateAt(uv : vec2<f32>, period : vec2<i32>, seed : u32) -> BarkPlate {
  let scaled = uv * vec2<f32>(period);
  let base = vec2<i32>(floor(scaled));
  var nearest = 1e4;
  var secondNearest = 1e4;
  var plateId = 0.0;
  for (var offsetY = -BARK_PLATE_ROW_REACH; offsetY <= BARK_PLATE_ROW_REACH; offsetY++) {
    for (var offsetX = -1; offsetX <= 1; offsetX++) {
      let neighbor = base + vec2<i32>(offsetX, offsetY);
      let wrapped = wrapCell(neighbor, period);
      let jitter = vec2<f32>(hashCell(wrapped, seed), hashCell(wrapped, seed + 7u));
      let featureDistance = length((vec2<f32>(neighbor) + 0.1 + jitter * 0.8 - scaled) * BARK_PLATE_STRETCH);
      if (featureDistance < nearest) {
        secondNearest = nearest;
        nearest = featureDistance;
        plateId = hashCell(wrapped, seed + 13u);
      } else if (featureDistance < secondNearest) {
        secondNearest = featureDistance;
      }
    }
  }
  return BarkPlate(secondNearest - nearest, nearest, plateId);
}

fn barkSurface(uv : vec2<f32>) -> SurfaceSample {
  let warp = vec2<f32>(tiledFbm(uv, vec2<i32>(3, 2), 4, 301u), tiledFbm(uv, vec2<i32>(3, 2), 4, 303u)) - 0.5;
  let fineWarp = vec2<f32>(tiledFbm(uv, vec2<i32>(12, 8), 3, 305u), tiledFbm(uv, vec2<i32>(12, 8), 3, 306u)) - 0.5;
  let warpedUv = uv + warp * BARK_WARP_REACH * 2.0 + fineWarp * BARK_WARP_REACH * 0.35;

  let plate = barkPlateAt(warpedUv, BARK_PLATE_PERIOD, 307u);
  let fissureWidth = 0.05 + tiledFbm(uv, vec2<i32>(6, 4), 3, 309u) * 0.12;
  let plateTop = smoothstep(fissureWidth * 0.25, fissureWidth * 1.8, plate.edgeDistance);
  let plateDome = smoothstep(0.0, 0.45, plate.edgeDistance);

  let crackPlate = barkPlateAt(warpedUv + fineWarp * 0.02, BARK_CRACK_PERIOD, 313u);
  let crack = (1.0 - smoothstep(0.0, 0.035, crackPlate.edgeDistance)) * step(0.35, crackPlate.plateId) * plateTop;

  let grain = tiledFbm(warpedUv, vec2<i32>(40, 24), 4, 311u);
  let fibers = tiledFbm(warpedUv, vec2<i32>(64, 10), 3, 317u);
  let flakeShape = smoothstep(0.45, 0.62, tiledFbm(warpedUv, vec2<i32>(16, 16), 4, 319u));
  let flake = flakeShape * step(0.72, plate.plateId) * plateTop;
  let lichenBlotch = smoothstep(0.62, 0.72, tiledFbm(uv, vec2<i32>(5, 8), 5, 331u));
  let lichenCrust = tiledNoise(uv, vec2<i32>(256), 337u);
  let lichen = lichenBlotch * plateTop * (0.6 + lichenCrust * 0.4);

  let plateTone = mix(vec3<f32>(1.04, 1.0, 0.95), vec3<f32>(0.96, 0.98, 1.02), fract(plate.plateId * 5.3));
  let plateColor = vec3<f32>(0.44, 0.41, 0.37) * plateTone * (0.74 + plate.plateId * 0.3 + grain * 0.22 + fibers * 0.1);
  let fissureColor = vec3<f32>(0.10, 0.085, 0.07) * (0.8 + grain * 0.4);
  let freshInnerBark = vec3<f32>(0.56, 0.43, 0.31) * (0.85 + grain * 0.3);
  let lichenColor = vec3<f32>(0.58, 0.62, 0.50) * (0.85 + lichenCrust * 0.3);

  var albedo = mix(fissureColor, plateColor, plateTop);
  albedo = mix(albedo, freshInnerBark, flake * 0.75);
  albedo *= 1.0 - crack * 0.55;
  albedo = mix(albedo, lichenColor, lichen * 0.55);

  let surfaceHeight = plateTop * 0.55 + plateDome * 0.18 + grain * 0.12 + fibers * 0.05 - crack * 0.14 - flake * 0.06 + lichen * 0.04;
  let crevice = clamp(1.0 - plateTop + crack * 0.5, 0.0, 1.0);
  return SurfaceSample(albedo, clamp(surfaceHeight, 0.0, 1.0), 0.05 + lichen * 0.03, crevice);
}

fn surfaceForLayer(layer : i32, uv : vec2<f32>) -> SurfaceSample {
  if (layer == LAYER_ASPHALT) {
    return asphaltSurface(uv);
  }
  if (layer == LAYER_PAVING) {
    return pavingSurface(uv);
  }
  if (layer == LAYER_GROUND) {
    return groundSurface(uv);
  }
  if (layer == LAYER_SETTS) {
    return settsSurface(uv);
  }
  if (layer == LAYER_HERRINGBONE) {
    return herringboneSurface(uv);
  }
  if (layer == LAYER_MOSS) {
    return mossSurface(uv);
  }
  return barkSurface(uv);
}

fn reliefStrengthForLayer(layer : i32) -> f32 {
  if (layer == LAYER_ASPHALT) {
    return 2.0;
  }
  if (layer == LAYER_PAVING) {
    return 2.0;
  }
  if (layer == LAYER_GROUND) {
    return 3.0;
  }
  if (layer == LAYER_SETTS) {
    return 3.0;
  }
  if (layer == LAYER_HERRINGBONE) {
    return 2.0;
  }
  if (layer == LAYER_MOSS) {
    return 6.0;
  }
  return 5.0;
}

@fragment
fn fs_generate(@builtin(position) position : vec4<f32>) -> SurfaceTexels {
  let layer = i32(generation.x);
  let texelSize = 1.0 / generation.y;
  let uv = position.xy * texelSize;
  let surface = surfaceForLayer(layer, uv);
  let heightAlongU = surfaceForLayer(layer, uv + vec2<f32>(texelSize, 0.0)).height;
  let heightAlongV = surfaceForLayer(layer, uv + vec2<f32>(0.0, texelSize)).height;
  let strength = reliefStrengthForLayer(layer);
  let normal = normalize(vec3<f32>((surface.height - heightAlongU) * strength, (surface.height - heightAlongV) * strength, 1.0));
  var texels : SurfaceTexels;
  texels.albedoHeight = vec4<f32>(clamp(surface.albedo, vec3<f32>(0.0), vec3<f32>(1.0)), surface.height);
  texels.relief = vec4<f32>(normal.xy * 0.5 + 0.5, clamp(surface.gloss, 0.0, 1.0), clamp(surface.crevice, 0.0, 1.0));
  return texels;
}
`,SURFACE_DOWNSAMPLE_WGSL=SURFACE_FULLSCREEN_WGSL+`
@group(0) @binding(0) var sourceAlbedo : texture_2d<f32>;
@group(0) @binding(1) var sourceRelief : texture_2d<f32>;

fn averageFootprint(source : texture_2d<f32>, topLeft : vec2<i32>) -> vec4<f32> {
  return (textureLoad(source, topLeft, 0) +
          textureLoad(source, topLeft + vec2<i32>(1, 0), 0) +
          textureLoad(source, topLeft + vec2<i32>(0, 1), 0) +
          textureLoad(source, topLeft + vec2<i32>(1, 1), 0)) * 0.25;
}

@fragment
fn fs_downsample(@builtin(position) position : vec4<f32>) -> SurfaceTexels {
  let topLeft = vec2<i32>(position.xy) * 2;
  var texels : SurfaceTexels;
  texels.albedoHeight = averageFootprint(sourceAlbedo, topLeft);
  texels.relief = averageFootprint(sourceRelief, topLeft);
  return texels;
}
`;function createSurfaceDetailTextures(e){const l=Math.log2(1024)+1,t={albedo:createSurfaceTextureArray(e,l),relief:createSurfaceTextureArray(e,l)},r=e.createCommandEncoder();return renderSurfaceBaseLevels(e,r,t),renderSurfaceMipLevels(e,r,t,l),e.queue.submit([r.finish()]),{albedoView:t.albedo.createView({dimension:"2d-array"}),reliefView:t.relief.createView({dimension:"2d-array"})}}function createSurfaceTextureArray(e,l){return e.createTexture({size:[1024,1024,SURFACE_DETAIL_LAYER_COUNT],mipLevelCount:l,format:SURFACE_TEXTURE_FORMAT,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT})}function renderSurfaceBaseLevels(e,l,t){const r=createSurfacePipeline(e,SURFACE_GENERATION_WGSL,"fs_generate");for(let a=0;a<SURFACE_DETAIL_LAYER_COUNT;a++){const s=e.createBuffer({size:SURFACE_GENERATION_UNIFORM_BYTES,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(s,0,new Float32Array([a,1024,0,0]));const o=e.createBindGroup({layout:r.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:s}}]});drawFullscreenPass(l,r,o,surfaceLevelTargets(t,0,a))}}function renderSurfaceMipLevels(e,l,t,r){const a=createSurfacePipeline(e,SURFACE_DOWNSAMPLE_WGSL,"fs_downsample");for(let s=0;s<SURFACE_DETAIL_LAYER_COUNT;s++)for(let o=1;o<r;o++){const i=e.createBindGroup({layout:a.getBindGroupLayout(0),entries:[{binding:0,resource:surfaceLevelView(t.albedo,o-1,s)},{binding:1,resource:surfaceLevelView(t.relief,o-1,s)}]});drawFullscreenPass(l,a,i,surfaceLevelTargets(t,o,s))}}function createSurfacePipeline(e,l,t){const r=e.createShaderModule({code:l});return e.createRenderPipeline({layout:"auto",vertex:{module:r,entryPoint:"vs_fullscreen"},fragment:{module:r,entryPoint:t,targets:[{format:SURFACE_TEXTURE_FORMAT},{format:SURFACE_TEXTURE_FORMAT}]},primitive:{topology:"triangle-list"}})}function surfaceLevelTargets(e,l,t){return[surfaceLevelView(e.albedo,l,t),surfaceLevelView(e.relief,l,t)]}function surfaceLevelView(e,l,t){return e.createView({dimension:"2d",baseMipLevel:l,mipLevelCount:1,baseArrayLayer:t,arrayLayerCount:1})}function drawFullscreenPass(e,l,t,r){const a=e.beginRenderPass({colorAttachments:r.map(s=>({view:s,clearValue:TRANSPARENT_BLACK,loadOp:"clear",storeOp:"store"}))});a.setPipeline(l),a.setBindGroup(0,t),a.draw(FULLSCREEN_TRIANGLE_VERTEX_COUNT,1,0,0),a.end()}
