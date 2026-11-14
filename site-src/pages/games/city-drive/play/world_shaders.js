// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

function wgslFloat(value) {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

const BAYER_DITHER_WGSL = `
fn bayerDither4x4(fragCoord : vec2<f32>) -> f32 {
  let x = i32(fragCoord.x) & 3;
  let y = i32(fragCoord.y) & 3;
  let idx = y * 4 + x;
  var m = array<f32, 16>(
 0.0,  8.0,  2.0, 10.0,
12.0,  4.0, 14.0,  6.0,
 3.0, 11.0,  1.0,  9.0,
15.0,  7.0, 13.0,  5.0
  );
  return (m[idx] / 16.0) - 0.5;
}
`;

function buildWorldShaderCode() {
  return `
struct GlobalUniforms {
  viewProj : mat4x4<f32>,
  camPosAndTime : vec4<f32>,
  camForwardAndAspect : vec4<f32>,
  camRightAndFov : vec4<f32>,
  camUp : vec4<f32>,
  sunDirAndIntensity : vec4<f32>,
  skyTopColor : vec4<f32>,
  skyHorizonColor : vec4<f32>,
  sunColorAndNight : vec4<f32>,
  carPosAndHeading : vec4<f32>,
  carFwdAndSpeed : vec4<f32>,
  skyMidColor : vec4<f32>,
  lightViewProj : mat4x4<f32>,
  shadowParams : vec4<f32>,
  weatherRoadColor : vec4<f32>,
  weatherShoulderColor : vec4<f32>,
  weatherStripeColor : vec4<f32>,
  weatherWaterColor : vec4<f32>,
  qualityParams : vec4<f32>,
};

@group(0) @binding(0) var<uniform> u : GlobalUniforms;
@group(0) @binding(6) var sunShadowMap : texture_depth_2d;
@group(0) @binding(7) var sunShadowSampler : sampler_comparison;
@group(0) @binding(3) var surfaceAlbedoTex : texture_2d_array<f32>;
@group(0) @binding(4) var surfaceReliefTex : texture_2d_array<f32>;
@group(0) @binding(5) var surfaceSampler : sampler;

const DETAIL_MATERIAL_OFFSET = ${wgslFloat(DETAIL_MATERIAL_OFFSET)};
const ROAD_MARKING_MATERIAL_OFFSET = ${wgslFloat(ROAD_MARKING_MATERIAL_OFFSET)};
const ROAD_MARKING_FADE_START_METERS = ${wgslFloat(ROAD_MARKING_FADE_START_METERS)};
const ROAD_MARKING_FADE_END_METERS = ${wgslFloat(ROAD_MARKING_FADE_END_METERS)};
const LIVE_WEATHER_ROAD : i32 = ${LIVE_WEATHER_COLOR.road};
const LIVE_WEATHER_SHOULDER : i32 = ${LIVE_WEATHER_COLOR.shoulder};
const LIVE_WEATHER_STRIPE : i32 = ${LIVE_WEATHER_COLOR.stripe};
const FULL_COVERAGE_MASK = 0xFFFFFFFFu;
const GLOW_DAY_STRENGTH = 1.2;
const GLOW_NIGHT_STRENGTH = 2.6;
const SHADOW_DEPTH_BIAS = 0.0006;
const SHADOW_EDGE_FADE_UV = 0.06;
const SHADOW_DARKEST_VISIBILITY = 0.0;
const CULLED_CLIP_POSITION = vec4<f32>(0.0, 0.0, 2.0, 1.0);
const PATTERN_FADE_START = 0.22;
const PATTERN_FADE_END = 0.65;
const STONE_MORTAR_COVERAGE = 0.1;
const ASHLAR_JOINT_COVERAGE = 0.08;
const ASHLAR_COURSE_HEIGHT_METERS = 0.6;
const ASHLAR_BLOCK_LENGTH_METERS = 1.2;
const ASHLAR_JOINT_METERS = 0.028;
const ASHLAR_ARRIS_METERS = 0.07;
const PLASTER_PANEL_WIDTH_METERS = 1.2;
const PLASTER_PANEL_HEIGHT_METERS = 0.6;
const PLASTER_PANEL_SEAM_METERS = 0.012;
const PLASTER_PANEL_VARIANT_FLOOR = ${wgslFloat(PLASTER_PANEL_VARIANT_FLOOR)};
const DRY_GRASS_VARIANT_FLOOR = ${wgslFloat(DRY_GRASS_VARIANT_FLOOR)};
const ROCK_TERRAIN_VARIANT_FLOOR = ${wgslFloat(ROCK_TERRAIN_VARIANT_FLOOR)};
const PAVING_JOINT_MOSS_STRENGTH = 0.3;
const OPEN_GROUND_PATTERN_SOFTENING = 0.45;
const PLANK_GAP_COVERAGE = 0.08;
const AMBIENT_SKY_DESATURATION = 0.3;
const GROUND_BOUNCE_STRENGTH = 0.1;
const SURFACE_LAYER_ASPHALT : i32 = ${SURFACE_DETAIL_LAYER.asphalt};
const SURFACE_LAYER_PAVING : i32 = ${SURFACE_DETAIL_LAYER.paving};
const SURFACE_LAYER_GROUND : i32 = ${SURFACE_DETAIL_LAYER.ground};
const SURFACE_LAYER_BARK : i32 = ${SURFACE_DETAIL_LAYER.bark};
const SURFACE_LAYER_SETTS : i32 = ${SURFACE_DETAIL_LAYER.setts};
const SURFACE_LAYER_HERRINGBONE : i32 = ${SURFACE_DETAIL_LAYER.herringbone};
const SURFACE_LAYER_MOSS : i32 = ${SURFACE_DETAIL_LAYER.moss};
const ASPHALT_TILE_METERS = 4.0;
const PAVING_TILE_METERS = ${wgslFloat(PAVING_TILE_METERS)};
const PAVING_SLABS_PER_TILE = 4.0;
const MOSS_TILE_METERS = ${wgslFloat(MOSS_TILE_METERS)};
const SETTS_TILE_METERS = ${SETT_TILE_METERS};
const HERRINGBONE_TILE_METERS = ${HERRINGBONE_TILE_METERS};
const GROUND_TILE_METERS = 6.0;
const ASPHALT_RELIEF_STRENGTH = 0.55;
const PAVING_RELIEF_STRENGTH = 0.6;
const SETTS_RELIEF_STRENGTH = 0.8;
const HERRINGBONE_RELIEF_STRENGTH = 0.6;
const PAVED_VARIANT_FLOOR = ${PAVED_VARIANT_FLOOR};
const PAVING_PATTERN_SLAB_VARIANT = ${PAVING_PATTERN_VARIANT.slab};
const HERRINGBONE_VARIANT_FLOOR = ${(PAVING_PATTERN_VARIANT.setts + PAVING_PATTERN_VARIANT.herringbone) / 2};
const SLAB_VARIANT_FLOOR = ${(PAVING_PATTERN_VARIANT.herringbone + PAVING_PATTERN_VARIANT.slab) / 2};
const PAVEMENT_GRIME_PER_METER = 0.045;
const PAVEMENT_GRIME_DARKENING = 0.08;
const LAMP_POOL_DIMMEST = 0.55;
const LAMP_POOL_VARIATION = 0.3;
const LAMP_POOL_PATCHES_PER_METER = 0.07;
const LAMP_SPILL_LIGHT = 0.32;
const LAMP_POOL_GAIN = 0.9;
const LAMP_POOL_MAX_LIGHT = 1.5;

const STREET_FRAME_FLAG_STRIDE = ${wgslFloat(STREET_FRAME_FLAG_STRIDE)};
const STREET_FLAG_LEFT_SIDEWALK_LAMPS : u32 = ${STREET_FRAME_FLAG.leftSidewalkLamps}u;
const STREET_FLAG_RIGHT_SIDEWALK_LAMPS : u32 = ${STREET_FRAME_FLAG.rightSidewalkLamps}u;
const STREET_SEGMENT_METERS = ${wgslFloat(SEG_LENGTH)};
const STREET_BLOCK_SEGMENTS = ${wgslFloat(MANHATTAN_BLOCK_PERIOD)};
const FIRST_LAMP_SEGMENT_IN_BLOCK = ${wgslFloat(INTERSECTION_LAST_SEGMENT_INDEX + 1)};
const SIDEWALK_LAMP_SLOT_PERIOD = ${wgslFloat(SIDEWALK_LAMP_SLOT_PERIOD)};
const SIDEWALK_LAMP_SLOT_PHASE = ${wgslFloat(SIDEWALK_LAMP_SLOT_PHASE)};
const SIDEWALK_LAMP_HEAD_FROM_CURB_METERS = ${wgslFloat(SIDEWALK_LAMP_POLE_FROM_CURB_METERS - SIDEWALK_LAMP_HEAD_REACH_METERS)};
const SIDEWALK_LAMP_HEAD_HEIGHT_METERS = ${wgslFloat(SIDEWALK_LAMP_HEAD_HEIGHT_METERS - SIDEWALK_HEIGHT_METERS)};

const KERB_WIDTH_METERS = ${wgslFloat(CURB_CAP_WIDTH)};
const KERB_STONE_LENGTH_METERS = 1.05;
const SIDEWALK_WIDTH_METERS = ${wgslFloat(ROAD_SHOULDER_WIDTH_METERS)};
const KERB_MARGIN_OUTER_METERS = 0.62;
const BUILDING_LINE_STRIP_METERS = 0.36;
const FURNITURE_PAD_CENTER_FROM_CURB_METERS = ${wgslFloat(SIDEWALK_LAMP_POLE_FROM_CURB_METERS)};
const FURNITURE_PAD_HALF_SIZE_METERS = 0.68;
const FURNITURE_PAD_FRAME_METERS = 0.12;
const PLAZA_PANEL_ALONG_METERS = STREET_SEGMENT_METERS * SIDEWALK_LAMP_SLOT_PERIOD;
const PLAZA_PANEL_ACROSS_METERS = 6.3;
const PLAZA_BAND_METERS = 0.45;
const ZONE_SEAM_METERS = 0.006;
const KERB_GRANITE_COLOR = vec3<f32>(0.60, 0.59, 0.56);
const BAND_GRANITE_COLOR = vec3<f32>(0.40, 0.39, 0.38);
const PAD_SETT_COLOR = vec3<f32>(0.34, 0.33, 0.32);
const STONE_PAVED_TOP_MIN_NORMAL_Y = 0.7;
const FLAT_FACE_MIN_NORMAL_Y = 0.95;
const MIN_STREET_PLANE_JACOBIAN = 1e-14;
const STREET_PARALLEL_FACE_MIN_ALIGNMENT = 0.8;
const MOSS_RELIEF_STRENGTH = 0.9;
const MOSS_ALBEDO_GAIN = 1.05;
const MOSS_PATCHES_PER_METER = 0.55;
const KERB_GRIME_DARKENING = 0.14;
const WALKING_LINE_POLISH = 0.05;
const GROUND_RELIEF_STRENGTH = 0.7;
const BARK_RELIEF_STRENGTH = 0.9;
const SMEARED_SURFACE_GRADIENT_SCALE = 8.0;

${BAYER_DITHER_WGSL}
fn sunShadowVisibility(worldPos : vec3<f32>, normal : vec3<f32>) -> f32 {
  if (u.shadowParams.y < 0.5) {
    return 1.0;
  }
  let lightClip = u.lightViewProj * vec4<f32>(worldPos + normal * u.shadowParams.z, 1.0);
  let shadowUV = vec2<f32>(lightClip.x * 0.5 + 0.5, 0.5 - lightClip.y * 0.5);
  let receiverDepth = lightClip.z - SHADOW_DEPTH_BIAS;
  let texel = u.shadowParams.x;
  var litSamples = 0.0;
  for (var tapY = 0; tapY < 2; tapY++) {
    for (var tapX = 0; tapX < 2; tapX++) {
      let tapOffset = (vec2<f32>(f32(tapX), f32(tapY)) * 2.0 - 1.0) * texel;
      litSamples += textureSampleCompareLevel(sunShadowMap, sunShadowSampler, shadowUV + tapOffset, receiverDepth);
    }
  }
  let distanceToEdge = min(min(shadowUV.x, 1.0 - shadowUV.x), min(shadowUV.y, 1.0 - shadowUV.y));
  let insideMap = smoothstep(0.0, SHADOW_EDGE_FADE_UV, distanceToEdge) * step(receiverDepth, 1.0);
  let visibility = mix(SHADOW_DARKEST_VISIBILITY, 1.0, litSamples / 4.0);
  return mix(1.0, visibility, insideMap * u.shadowParams.w);
}

fn patternVisibility(pixelFootprintMeters : f32, featureMeters : f32) -> f32 {
  return 1.0 - smoothstep(PATTERN_FADE_START, PATTERN_FADE_END, pixelFootprintMeters / featureMeters);
}

fn detailFadeAt(worldPos : vec3<f32>) -> f32 {
  let distanceMeters = length(worldPos - u.camPosAndTime.xyz);
  return 1.0 - smoothstep(u.qualityParams.x, u.qualityParams.y, distanceMeters);
}

fn roadMarkingFadeAt(worldPos : vec3<f32>) -> f32 {
  let distanceMeters = length(worldPos - u.camPosAndTime.xyz);
  return 1.0 - smoothstep(ROAD_MARKING_FADE_START_METERS, ROAD_MARKING_FADE_END_METERS, distanceMeters);
}

fn resolveLiveWeatherColor(color : vec3<f32>) -> vec3<f32> {
  if (color.r >= 0.0) {
    return color;
  }
  let slot = i32(round(-color.r));
  var weatherColor = u.weatherWaterColor.rgb;
  if (slot == LIVE_WEATHER_ROAD) {
    weatherColor = u.weatherRoadColor.rgb;
  } else if (slot == LIVE_WEATHER_SHOULDER) {
    weatherColor = u.weatherShoulderColor.rgb;
  } else if (slot == LIVE_WEATHER_STRIPE) {
    weatherColor = u.weatherStripeColor.rgb;
  }
  return weatherColor * color.g;
}

fn coverageSampleMask(coverage : f32, pixel : vec2<f32>) -> u32 {
  if (coverage >= 0.999) {
    return FULL_COVERAGE_MASK;
  }
  let sampleCount = u32(u.qualityParams.z);
  let allSamples = (1u << sampleCount) - 1u;
  let pixelNoise = hash21(floor(pixel));
  let coveredSamples = min(u32(floor(coverage * f32(sampleCount) + pixelNoise)), sampleCount);
  let coveredBits = (1u << coveredSamples) - 1u;
  let rotation = u32(fract(pixelNoise * 7.31) * f32(sampleCount)) % sampleCount;
  return ((coveredBits << rotation) | (coveredBits >> (sampleCount - rotation))) & allSamples;
}

fn hash21(p : vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn valueNoise(p : vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u2 = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  let a = hash21(i);
  let b = hash21(i + vec2<f32>(1.0, 0.0));
  let c = hash21(i + vec2<f32>(0.0, 1.0));
  let d = hash21(i + vec2<f32>(1.0, 1.0));
  return mix(mix(a, b, u2.x), mix(c, d, u2.x), u2.y);
}

fn fbm(p_in : vec2<f32>) -> f32 {
  var p = p_in;
  var v = 0.0;
  var amp = 0.5;
  let rot = mat2x2<f32>(0.8, 0.6, -0.6, 0.8);
  for (var i = 0; i < 5; i++) {
v += amp * valueNoise(p);
p = rot * p * 2.02 + vec2<f32>(17.3, 9.2);
amp *= 0.5;
  }
  return v;
}

const SMEAR_ANGULAR_SPEED_RADIANS_PER_SECOND = 2.0;
const SMEAR_THRESHOLD_DITHER_SPREAD = 0.5;
const SMEAR_EXEMPT_RADIUS_AROUND_CAR_METERS = 3.5;
const FBM_FIRST_OCTAVE_WEIGHT = 0.5;
const FBM_FINER_OCTAVES_MEAN = 0.234375;
const NOISE_MEAN = 0.5;

var<private> motionSmearedSurface : bool = false;

fn isSmearedByCarMotion(worldPos : vec3<f32>, fragCoord : vec2<f32>) -> bool {
  let carSpeed = abs(u.carFwdAndSpeed.w);
  if (carSpeed < 1.0) {
    return false;
  }
  if (distance(worldPos.xz, u.carPosAndHeading.xz) < SMEAR_EXEMPT_RADIUS_AROUND_CAR_METERS) {
    return false;
  }
  let toSurface = worldPos - u.camPosAndTime.xyz;
  let distanceToSurface = max(length(toSurface), 0.001);
  let travelAlignment = dot(toSurface / distanceToSurface, normalize(u.carFwdAndSpeed.xyz));
  let sidewaysFraction = sqrt(max(1.0 - travelAlignment * travelAlignment, 0.0));
  let angularSpeed = carSpeed * sidewaysFraction / distanceToSurface;
  let ditheredThreshold = SMEAR_ANGULAR_SPEED_RADIANS_PER_SECOND * (1.0 + bayerDither4x4(fragCoord) * SMEAR_THRESHOLD_DITHER_SPREAD);
  return angularSpeed > ditheredThreshold;
}

fn surfaceGrain(p : vec2<f32>) -> f32 {
  if (motionSmearedSurface) {
    return NOISE_MEAN;
  }
  return valueNoise(p);
}

fn surfacePattern(p : vec2<f32>) -> f32 {
  if (motionSmearedSurface) {
    return valueNoise(p) * FBM_FIRST_OCTAVE_WEIGHT + FBM_FINER_OCTAVES_MEAN;
  }
  return fbm(p);
}

fn streetLampPoolStrength(groundPosition : vec2<f32>) -> f32 {
  return LAMP_POOL_DIMMEST + LAMP_POOL_VARIATION * valueNoise(groundPosition * LAMP_POOL_PATCHES_PER_METER + vec2<f32>(53.1, 17.9));
}

struct PavementPattern {
  layer : i32,
  tileMeters : f32,
  reliefStrength : f32,
};

fn pavementPatternForVariant(variant : f32) -> PavementPattern {
  if (variant < PAVED_VARIANT_FLOOR) {
    return PavementPattern(SURFACE_LAYER_ASPHALT, ASPHALT_TILE_METERS, ASPHALT_RELIEF_STRENGTH);
  }
  if (variant < HERRINGBONE_VARIANT_FLOOR) {
    return PavementPattern(SURFACE_LAYER_SETTS, SETTS_TILE_METERS, SETTS_RELIEF_STRENGTH);
  }
  if (variant < SLAB_VARIANT_FLOOR) {
    return PavementPattern(SURFACE_LAYER_HERRINGBONE, HERRINGBONE_TILE_METERS, HERRINGBONE_RELIEF_STRENGTH);
  }
  return PavementPattern(SURFACE_LAYER_PAVING, PAVING_TILE_METERS, PAVING_RELIEF_STRENGTH);
}

fn pavementGrime(groundPosition : vec2<f32>) -> vec3<f32> {
  let grime = smoothstep(0.38, 0.78, surfacePattern(groundPosition * PAVEMENT_GRIME_PER_METER + vec2<f32>(71.3, 4.7)));
  return mix(vec3<f32>(1.0), vec3<f32>(0.94, 0.92, 0.88) * (1.0 - PAVEMENT_GRIME_DARKENING), grime);
}


struct StreetFrame {
  hasFrame : bool,
  alongMeters : f32,
  lateralMeters : f32,
  curbLateralMeters : f32,
  acrossFromCurbMeters : f32,
  flags : u32,
};

fn decodeStreetFrame(raw : vec3<f32>) -> StreetFrame {
  if (raw.z < 0.0) {
    return StreetFrame(false, raw.x, raw.y, 0.0, raw.y, 0u);
  }
  let flagCode = floor(raw.z / STREET_FRAME_FLAG_STRIDE);
  let curbLateral = raw.z - flagCode * STREET_FRAME_FLAG_STRIDE;
  return StreetFrame(true, raw.x, raw.y, curbLateral, abs(raw.y) - curbLateral, u32(flagCode));
}

fn hasStreetFlag(frame : StreetFrame, flag : u32) -> bool {
  return (frame.flags & flag) != 0u;
}

fn positiveModulo(value : f32, period : f32) -> f32 {
  return value - floor(value / period) * period;
}

fn lampGroundIrradiance(planarDistanceSquared : f32, headHeightMeters : f32) -> f32 {
  let heightSquared = headHeightMeters * headHeightMeters;
  return pow(heightSquared / (heightSquared + planarDistanceSquared), 1.5);
}

fn hasSidewalkLampAt(segmentIndex : f32) -> bool {
  let segmentInBlock = positiveModulo(segmentIndex, STREET_BLOCK_SEGMENTS);
  return segmentInBlock > FIRST_LAMP_SEGMENT_IN_BLOCK - 0.5;
}

fn ambientLight(normal : vec3<f32>) -> vec3<f32> {
  let skyFacing = normal.y * 0.5 + 0.5;
  let sky = mix(u.skyHorizonColor.rgb * 0.44, u.skyTopColor.rgb * 0.68, skyFacing);
  let neutralSky = mix(sky, vec3<f32>(dot(sky, vec3<f32>(0.299, 0.587, 0.114))), AMBIENT_SKY_DESATURATION);
  let groundBounce = u.sunColorAndNight.rgb * u.sunDirAndIntensity.w * GROUND_BOUNCE_STRENGTH * (1.0 - skyFacing);
  return neutralSky + groundBounce + vec3<f32>(0.045, 0.055, 0.095) * u.sunColorAndNight.w;
}

fn sidewalkLampIrradiance(frame : StreetFrame) -> f32 {
  let segmentPosition = frame.alongMeters / STREET_SEGMENT_METERS;
  let nearestSlot = round((segmentPosition - SIDEWALK_LAMP_SLOT_PHASE) / SIDEWALK_LAMP_SLOT_PERIOD) * SIDEWALK_LAMP_SLOT_PERIOD + SIDEWALK_LAMP_SLOT_PHASE;
  let headLateral = frame.curbLateralMeters + SIDEWALK_LAMP_HEAD_FROM_CURB_METERS;
  var irradiance = 0.0;
  for (var slotStep = -1; slotStep <= 1; slotStep++) {
    let slot = nearestSlot + f32(slotStep) * SIDEWALK_LAMP_SLOT_PERIOD;
    if (!hasSidewalkLampAt(slot)) {
      continue;
    }
    let alongGap = frame.alongMeters - slot * STREET_SEGMENT_METERS;
    if (hasStreetFlag(frame, STREET_FLAG_LEFT_SIDEWALK_LAMPS)) {
      let lateralGap = frame.lateralMeters + headLateral;
      irradiance += lampGroundIrradiance(alongGap * alongGap + lateralGap * lateralGap, SIDEWALK_LAMP_HEAD_HEIGHT_METERS);
    }
    if (hasStreetFlag(frame, STREET_FLAG_RIGHT_SIDEWALK_LAMPS)) {
      let lateralGap = frame.lateralMeters - headLateral;
      irradiance += lampGroundIrradiance(alongGap * alongGap + lateralGap * lateralGap, SIDEWALK_LAMP_HEAD_HEIGHT_METERS);
    }
  }
  return irradiance;
}

fn streetLampLight(frame : StreetFrame, groundPosition : vec2<f32>) -> f32 {
  if (!frame.hasFrame) {
    return streetLampPoolStrength(groundPosition);
  }
  let pool = sidewalkLampIrradiance(frame);
  return min(LAMP_SPILL_LIGHT + pool * LAMP_POOL_GAIN, LAMP_POOL_MAX_LIGHT);
}

struct StreetPlane {
  coordinates : vec2<f32>,
  coordinatesDx : vec2<f32>,
  coordinatesDy : vec2<f32>,
  alongAxis : vec3<f32>,
  acrossAxis : vec3<f32>,
};

fn streetPlaneAt(frame : StreetFrame, worldDx : vec3<f32>, worldDy : vec3<f32>, planeDx : vec2<f32>, planeDy : vec2<f32>) -> StreetPlane {
  let jacobian = planeDx.x * planeDy.y - planeDy.x * planeDx.y;
  var alongAxis = vec3<f32>(1.0, 0.0, 0.0);
  var acrossAxis = vec3<f32>(0.0, 0.0, 1.0);
  if (abs(jacobian) > MIN_STREET_PLANE_JACOBIAN) {
    alongAxis = normalize((worldDx * planeDy.y - worldDy * planeDx.y) / jacobian);
    acrossAxis = normalize((worldDy * planeDx.x - worldDx * planeDy.x) / jacobian);
  }
  return StreetPlane(vec2<f32>(frame.alongMeters, frame.acrossFromCurbMeters), planeDx, planeDy, alongAxis, acrossAxis);
}

struct PavementZone {
  layer : i32,
  localMeters : vec2<f32>,
  runsAcrossStreet : bool,
  tileMeters : f32,
  reliefStrength : f32,
  stoneColor : vec3<f32>,
  metersToZoneEdge : f32,
  isWalkingField : bool,
};

fn kerbZone(along : f32, across : f32) -> PavementZone {
  let kerbTileMeters = KERB_STONE_LENGTH_METERS * PAVING_SLABS_PER_TILE;
  let centeredInSlab = across + (KERB_STONE_LENGTH_METERS - KERB_WIDTH_METERS) * 0.5;
  return PavementZone(SURFACE_LAYER_PAVING, vec2<f32>(along, centeredInSlab), false, kerbTileMeters, PAVING_RELIEF_STRENGTH, KERB_GRANITE_COLOR, min(abs(across), KERB_WIDTH_METERS - across), false);
}

fn graniteStripZone(along : f32, acrossInStrip : f32, stripWidth : f32, color : vec3<f32>) -> PavementZone {
  let stripTileMeters = KERB_STONE_LENGTH_METERS * PAVING_SLABS_PER_TILE;
  let centeredInSlab = acrossInStrip + (KERB_STONE_LENGTH_METERS - stripWidth) * 0.5;
  return PavementZone(SURFACE_LAYER_PAVING, vec2<f32>(along, centeredInSlab), false, stripTileMeters, PAVING_RELIEF_STRENGTH, color, min(acrossInStrip, stripWidth - acrossInStrip), false);
}

fn settsZone(localMeters : vec2<f32>, runsAcrossStreet : bool, color : vec3<f32>, metersToZoneEdge : f32) -> PavementZone {
  return PavementZone(SURFACE_LAYER_SETTS, localMeters, runsAcrossStreet, SETTS_TILE_METERS, SETTS_RELIEF_STRENGTH, color, metersToZoneEdge, false);
}

fn fieldZone(localMeters : vec2<f32>, field : PavementPattern, fieldColor : vec3<f32>, metersToZoneEdge : f32) -> PavementZone {
  return PavementZone(field.layer, localMeters, false, field.tileMeters, field.reliefStrength, fieldColor, metersToZoneEdge, true);
}

fn hasLampPadAt(frame : StreetFrame, segmentIndex : f32) -> bool {
  let isLampSlot = positiveModulo(segmentIndex - SIDEWALK_LAMP_SLOT_PHASE, SIDEWALK_LAMP_SLOT_PERIOD) < 0.5;
  if (!isLampSlot || !hasSidewalkLampAt(segmentIndex)) {
    return false;
  }
  let sideLampFlag = select(STREET_FLAG_RIGHT_SIDEWALK_LAMPS, STREET_FLAG_LEFT_SIDEWALK_LAMPS, frame.lateralMeters < 0.0);
  return hasStreetFlag(frame, sideLampFlag);
}

fn sidewalkZoneAt(frame : StreetFrame, along : f32, across : f32, field : PavementPattern, fieldColor : vec3<f32>) -> PavementZone {
  let nearestSegmentIndex = round(along / STREET_SEGMENT_METERS);
  let padOffset = vec2<f32>(along - nearestSegmentIndex * STREET_SEGMENT_METERS, across - FURNITURE_PAD_CENTER_FROM_CURB_METERS);
  let hasPad = hasLampPadAt(frame, nearestSegmentIndex);
  let padDistance = select(FURNITURE_PAD_HALF_SIZE_METERS + SIDEWALK_WIDTH_METERS, max(abs(padOffset.x), abs(padOffset.y)), hasPad);
  let padInnerHalf = FURNITURE_PAD_HALF_SIZE_METERS - FURNITURE_PAD_FRAME_METERS;
  if (padDistance < FURNITURE_PAD_HALF_SIZE_METERS) {
    if (padDistance > padInnerHalf) {
      let frameEdge = min(FURNITURE_PAD_HALF_SIZE_METERS - padDistance, padDistance - padInnerHalf);
      let runsAcross = abs(padOffset.x) > abs(padOffset.y);
      let frameAlong = select(padOffset.x, padOffset.y, runsAcross);
      let frameAcross = padDistance - padInnerHalf;
      let frameZone = graniteStripZone(frameAlong, frameAcross, FURNITURE_PAD_FRAME_METERS, KERB_GRANITE_COLOR);
      return PavementZone(frameZone.layer, frameZone.localMeters, runsAcross, frameZone.tileMeters, frameZone.reliefStrength, frameZone.stoneColor, frameEdge, false);
    }
    return settsZone(padOffset + vec2<f32>(padInnerHalf), false, PAD_SETT_COLOR, padInnerHalf - padDistance);
  }
  if (across < KERB_MARGIN_OUTER_METERS) {
    let marginWidth = KERB_MARGIN_OUTER_METERS - KERB_WIDTH_METERS;
    let acrossInMargin = across - KERB_WIDTH_METERS;
    return settsZone(vec2<f32>(along, acrossInMargin), false, BAND_GRANITE_COLOR, min(acrossInMargin, marginWidth - acrossInMargin));
  }
  let buildingStripStart = SIDEWALK_WIDTH_METERS - BUILDING_LINE_STRIP_METERS;
  if (across > buildingStripStart) {
    return graniteStripZone(along, across - buildingStripStart, BUILDING_LINE_STRIP_METERS, BAND_GRANITE_COLOR);
  }
  let padClearance = padDistance - FURNITURE_PAD_HALF_SIZE_METERS;
  let fieldEdge = min(min(across - KERB_MARGIN_OUTER_METERS, buildingStripStart - across), padClearance);
  return fieldZone(vec2<f32>(along, across - KERB_MARGIN_OUTER_METERS), field, fieldColor, fieldEdge);
}

fn plazaZoneAt(along : f32, across : f32, field : PavementPattern, fieldColor : vec3<f32>) -> PavementZone {
  let lampAlignedAlong = along - SIDEWALK_LAMP_SLOT_PHASE * STREET_SEGMENT_METERS;
  let acrossInPlaza = across - SIDEWALK_WIDTH_METERS;
  let localAlong = positiveModulo(lampAlignedAlong, PLAZA_PANEL_ALONG_METERS);
  let localAcross = positiveModulo(acrossInPlaza, PLAZA_PANEL_ACROSS_METERS);
  let alongBandDistance = min(localAlong, PLAZA_PANEL_ALONG_METERS - localAlong);
  let acrossBandDistance = min(localAcross, PLAZA_PANEL_ACROSS_METERS - localAcross);
  let halfBand = PLAZA_BAND_METERS * 0.5;
  if (alongBandDistance < halfBand) {
    return settsZone(vec2<f32>(acrossInPlaza, alongBandDistance + halfBand), true, BAND_GRANITE_COLOR, halfBand - alongBandDistance);
  }
  if (acrossBandDistance < halfBand) {
    return settsZone(vec2<f32>(along, acrossBandDistance + halfBand), false, BAND_GRANITE_COLOR, halfBand - acrossBandDistance);
  }
  let panelInterior = vec2<f32>(localAlong - halfBand, localAcross - halfBand);
  return fieldZone(panelInterior, field, fieldColor, min(alongBandDistance, acrossBandDistance) - halfBand);
}

fn pavementZoneAt(frame : StreetFrame, plane : StreetPlane, field : PavementPattern, fieldColor : vec3<f32>) -> PavementZone {
  let along = plane.coordinates.x;
  let across = plane.coordinates.y;
  if (across < 0.0) {
    return fieldZone(plane.coordinates, field, fieldColor, 1.0);
  }
  if (across < KERB_WIDTH_METERS) {
    return kerbZone(along, across);
  }
  if (across < SIDEWALK_WIDTH_METERS) {
    return sidewalkZoneAt(frame, along, across, field, fieldColor);
  }
  return plazaZoneAt(along, across, field, fieldColor);
}

fn projectPavementZone(zone : PavementZone, plane : StreetPlane) -> SurfaceProjection {
  let inverseTile = 1.0 / zone.tileMeters;
  if (zone.runsAcrossStreet) {
    return SurfaceProjection(zone.localMeters * inverseTile, plane.coordinatesDx.yx * inverseTile, plane.coordinatesDy.yx * inverseTile, plane.acrossAxis, plane.alongAxis);
  }
  return SurfaceProjection(zone.localMeters * inverseTile, plane.coordinatesDx * inverseTile, plane.coordinatesDy * inverseTile, plane.alongAxis, plane.acrossAxis);
}

fn jointMossPresence(detail : SurfaceDetail) -> f32 {
  return smoothstep(0.015, 0.07, detail.albedo.g - max(detail.albedo.r, detail.albedo.b));
}

struct MossedSurface {
  color : vec3<f32>,
  normal : vec3<f32>,
  amount : f32,
};

fn growMoss(color : vec3<f32>, normal : vec3<f32>, coverage : f32, mossProjection : SurfaceProjection) -> MossedSurface {
  if (coverage < 0.01) {
    return MossedSurface(color, normal, 0.0);
  }
  let moss = sampleSurfaceDetail(SURFACE_LAYER_MOSS, mossProjection);
  let amount = smoothstep(0.32, 0.68, coverage + (moss.height - 0.5) * 0.7) * smoothstep(0.0, 0.15, coverage);
  let mossNormal = perturbSurfaceNormal(normal, mossProjection, moss, MOSS_RELIEF_STRENGTH);
  return MossedSurface(mix(color, moss.albedo * MOSS_ALBEDO_GAIN, amount), normalize(mix(normal, mossNormal, amount)), amount);
}

struct PavementInput {
  worldPos : vec3<f32>,
  normal : vec3<f32>,
  fieldColor : vec3<f32>,
  variant : f32,
  frame : StreetFrame,
  worldDx : vec3<f32>,
  worldDy : vec3<f32>,
  planeDx : vec2<f32>,
  planeDy : vec2<f32>,
  wetness : f32,
};

struct PavementShading {
  color : vec3<f32>,
  normal : vec3<f32>,
  specPower : f32,
  specStrength : f32,
};

fn shadePavement(input : PavementInput) -> PavementShading {
  let field = pavementPatternForVariant(input.variant);
  var zone = fieldZone(input.worldPos.xz, field, input.fieldColor, 1.0);
  var projection = projectOntoSurface(input.worldPos, input.worldDx, input.worldDy, input.normal, field.tileMeters);
  var macroCoordinates = input.worldPos.xz;
  let isStreetGround = input.frame.hasFrame && input.normal.y > STONE_PAVED_TOP_MIN_NORMAL_Y;
  if (isStreetGround) {
    let plane = streetPlaneAt(input.frame, input.worldDx, input.worldDy, input.planeDx, input.planeDy);
    zone = pavementZoneAt(input.frame, plane, field, input.fieldColor);
    projection = projectPavementZone(zone, plane);
    macroCoordinates = plane.coordinates;
  }

  let detail = sampleSurfaceDetail(zone.layer, projection);
  let seam = 1.0 - smoothstep(ZONE_SEAM_METERS * 0.5, ZONE_SEAM_METERS, zone.metersToZoneEdge);
  let crevice = max(detail.crevice, seam * select(0.0, 1.0, isStreetGround));
  let wearTone = 0.9 + surfaceGrain(macroCoordinates * 0.13) * 0.2;
  var color = zone.stoneColor * detail.albedoRatio * wearTone * (1.0 - crevice * 0.55);
  if (zone.layer == SURFACE_LAYER_PAVING) {
    color *= 0.95 + hash21(floor(projection.uv * PAVING_SLABS_PER_TILE) + vec2<f32>(f32(zone.isWalkingField) * 17.0, 3.0)) * 0.1;
  }
  if (!isStreetGround) {
    color = mix(color, input.fieldColor * wearTone, OPEN_GROUND_PATTERN_SOFTENING);
  }
  color *= pavementGrime(macroCoordinates);

  var gloss = 0.5 + detail.gloss;
  var mossCoverage = jointMossPresence(detail) * PAVING_JOINT_MOSS_STRENGTH;
  if (isStreetGround) {
    let across = input.frame.acrossFromCurbMeters;
    let mossPatches = smoothstep(0.42, 0.72, surfacePattern(macroCoordinates * MOSS_PATCHES_PER_METER + vec2<f32>(9.1, 2.3)));
    let kerbGrime = (1.0 - smoothstep(KERB_WIDTH_METERS, 1.1, across)) * step(0.0, across) * step(across, SIDEWALK_WIDTH_METERS);
    color *= 1.0 - kerbGrime * KERB_GRIME_DARKENING;
    let walkingLine = exp(-pow((across - 1.75) / 0.55, 2.0)) * select(0.0, 1.0, zone.isWalkingField && across < SIDEWALK_WIDTH_METERS);
    color *= 1.0 + walkingLine * WALKING_LINE_POLISH;
    gloss += walkingLine * 0.25;
    let buildingFoot = smoothstep(SIDEWALK_WIDTH_METERS - 0.6, SIDEWALK_WIDTH_METERS - 0.05, across) * (1.0 - smoothstep(SIDEWALK_WIDTH_METERS + 0.4, SIDEWALK_WIDTH_METERS + 1.2, across));
    let plazaBandEdge = (1.0 - smoothstep(0.0, 0.09, zone.metersToZoneEdge)) * step(SIDEWALK_WIDTH_METERS, across);
    let shadedEdges = max(buildingFoot * 0.85, plazaBandEdge * 0.6) * mossPatches;
    mossCoverage = max(mossCoverage, shadedEdges * (0.75 + input.wetness * 0.35));
  }

  let mossProjection = scaleProjection(projection, zone.tileMeters / MOSS_TILE_METERS);
  let reliefNormal = perturbSurfaceNormal(input.normal, projection, detail, zone.reliefStrength);
  let mossed = growMoss(color, reliefNormal, mossCoverage, mossProjection);
  color = mossed.color;
  color = mix(color, color * 0.72, input.wetness * (0.6 + crevice * 0.3));
  let specPower = mix(20.0, 72.0, input.wetness);
  let specStrength = mix(0.10, 0.55, input.wetness) * gloss * (1.0 - mossed.amount * 0.7);
  return PavementShading(color, mossed.normal, specPower, specStrength);
}

struct MasonryInput {
  worldPos : vec3<f32>,
  normal : vec3<f32>,
  frame : StreetFrame,
  worldDx : vec3<f32>,
  worldDy : vec3<f32>,
  alongDx : f32,
  alongDy : f32,
};

fn masonryCoordinates(input : MasonryInput) -> vec2<f32> {
  if (abs(input.normal.y) > FLAT_FACE_MIN_NORMAL_Y) {
    return select(input.worldPos.xz, vec2<f32>(input.frame.alongMeters, input.frame.lateralMeters), input.frame.hasFrame);
  }
  let axes = faceAxes(input.normal);
  let faceCoordinates = vec2<f32>(dot(input.worldPos, axes.across), dot(input.worldPos, axes.up));
  if (!input.frame.hasFrame) {
    return faceCoordinates;
  }
  let faceDx = vec2<f32>(dot(input.worldDx, axes.across), dot(input.worldDx, axes.up));
  let faceDy = vec2<f32>(dot(input.worldDy, axes.across), dot(input.worldDy, axes.up));
  let jacobian = faceDx.x * faceDy.y - faceDy.x * faceDx.y;
  if (abs(jacobian) < MIN_STREET_PLANE_JACOBIAN) {
    return faceCoordinates;
  }
  let alongPerFaceMeter = (input.alongDx * faceDy.y - input.alongDy * faceDx.y) / jacobian;
  if (abs(alongPerFaceMeter) < STREET_PARALLEL_FACE_MIN_ALIGNMENT) {
    return faceCoordinates;
  }
  return vec2<f32>(input.frame.alongMeters * sign(alongPerFaceMeter), faceCoordinates.y);
}

struct SurfaceProjection {
  uv : vec2<f32>,
  uvDx : vec2<f32>,
  uvDy : vec2<f32>,
  tangent : vec3<f32>,
  bitangent : vec3<f32>,
};

struct SurfaceDetail {
  albedo : vec3<f32>,
  albedoRatio : vec3<f32>,
  height : f32,
  normalOffset : vec2<f32>,
  gloss : f32,
  crevice : f32,
};

fn faceTowardViewer(normal : vec3<f32>, toViewer : vec3<f32>) -> vec3<f32> {
  return select(normal, -normal, dot(normal, toViewer) < 0.0);
}

struct FaceAxes {
  across : vec3<f32>,
  up : vec3<f32>,
};

fn faceAxes(normal : vec3<f32>) -> FaceAxes {
  let across = normalize(cross(vec3<f32>(0.0, 1.0, 0.0), normal));
  return FaceAxes(across, cross(normal, across));
}

fn projectOntoSurface(worldPos : vec3<f32>, worldDx : vec3<f32>, worldDy : vec3<f32>, normal : vec3<f32>, tileMeters : f32) -> SurfaceProjection {
  var projection : SurfaceProjection;
  if (abs(normal.y) > 0.5) {
    projection = SurfaceProjection(worldPos.xz, worldDx.xz, worldDy.xz, vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(0.0, 0.0, 1.0));
  } else {
    let axes = faceAxes(normal);
    let faceDx = vec2<f32>(dot(worldDx, axes.across), dot(worldDx, axes.up));
    let faceDy = vec2<f32>(dot(worldDy, axes.across), dot(worldDy, axes.up));
    projection = SurfaceProjection(vec2<f32>(dot(worldPos, axes.across), dot(worldPos, axes.up)), faceDx, faceDy, axes.across, axes.up);
  }
  return scaleProjection(projection, 1.0 / tileMeters);
}

fn scaleProjection(projection : SurfaceProjection, scale : f32) -> SurfaceProjection {
  return SurfaceProjection(projection.uv * scale, projection.uvDx * scale, projection.uvDy * scale, projection.tangent, projection.bitangent);
}

fn sampleSurfaceDetail(layer : i32, projection : SurfaceProjection) -> SurfaceDetail {
  let gradientScale = select(1.0, SMEARED_SURFACE_GRADIENT_SCALE, motionSmearedSurface);
  let uvDx = projection.uvDx * gradientScale;
  let uvDy = projection.uvDy * gradientScale;
  let albedoHeight = textureSampleGrad(surfaceAlbedoTex, surfaceSampler, projection.uv, layer, uvDx, uvDy);
  let relief = textureSampleGrad(surfaceReliefTex, surfaceSampler, projection.uv, layer, uvDx, uvDy);
  let coarsestMip = i32(textureNumLevels(surfaceAlbedoTex)) - 1;
  let meanAlbedo = textureLoad(surfaceAlbedoTex, vec2<i32>(0, 0), layer, coarsestMip).rgb;
  return SurfaceDetail(
    albedoHeight.rgb,
    albedoHeight.rgb / max(meanAlbedo, vec3<f32>(0.01)),
    albedoHeight.a,
    relief.rg * 2.0 - 1.0,
    relief.b,
    relief.a
  );
}

fn perturbSurfaceNormal(normal : vec3<f32>, projection : SurfaceProjection, detail : SurfaceDetail, strength : f32) -> vec3<f32> {
  let offset = projection.tangent * detail.normalOffset.x + projection.bitangent * detail.normalOffset.y;
  return normalize(normal + offset * strength);
}

fn distantShoreColor(background : vec3<f32>, elevation : f32) -> vec3<f32> {
  let nightFactor = u.sunColorAndNight.w;
  let landColor = mix(vec3<f32>(0.22, 0.24, 0.27), vec3<f32>(0.025, 0.03, 0.045), nightFactor);
  let depthBelowHorizon = clamp(-elevation / 0.06, 0.0, 1.0);
  let haze = mix(0.62, 0.30, depthBelowHorizon);
  return mix(landColor, background, clamp(haze, 0.0, 0.92));
}

fn compositeDistantShore(background : vec3<f32>, elevation : f32, pixelAngle : f32) -> vec3<f32> {
  let belowHorizon = 1.0 - smoothstep(-pixelAngle, pixelAngle, elevation);
  return mix(background, distantShoreColor(background, elevation), belowHorizon);
}

struct SkyOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) ndc : vec2<f32>,
};

@vertex
fn vs_sky(@builtin(vertex_index) vid : u32) -> SkyOut {
  var positions = array<vec2<f32>, 3>(
vec2<f32>(-1.0, -1.0),
vec2<f32>( 3.0, -1.0),
vec2<f32>(-1.0,  3.0)
  );
  var out : SkyOut;
  let p = positions[vid];
  out.pos = vec4<f32>(p, 1.0, 1.0);
  out.ndc = p;
  return out;
}

@fragment
fn fs_sky(in : SkyOut) -> @location(0) vec4<f32> {
  let aspect = u.camForwardAndAspect.w;
  let tanHalfFov = u.camRightAndFov.w;
  let rayDir = normalize(
u.camForwardAndAspect.xyz +
in.ndc.x * aspect * tanHalfFov * u.camRightAndFov.xyz +
in.ndc.y * tanHalfFov * u.camUp.xyz
  );

  let azimuth = atan2(rayDir.x, -rayDir.z);
  let pixelAngle = max(fwidth(rayDir.y), 0.00005);
  let nightFactor = u.sunColorAndNight.w;

  let rawElev = clamp(rayDir.y, 0.0, 1.0);
  let facetAz = floor(azimuth * 18.0) / 18.0;
  let facetEl = floor(rawElev * 14.0) / 14.0;
  let facetChecker = hash21(vec2<f32>(facetAz * 10.0, facetEl * 10.0)) - 0.5;
  let skyT = clamp(pow(rawElev, 0.62) + facetChecker * 0.022 * (1.0 - nightFactor * 0.6), 0.0, 1.0);

  let midCrown = u.skyMidColor.rgb;
  var skyCol = mix(u.skyHorizonColor.rgb, midCrown, smoothstep(0.0, 0.36, skyT));
  skyCol = mix(skyCol, u.skyTopColor.rgb, smoothstep(0.32, 0.92, skyT));

  let cityGlowBand = exp(-max(rayDir.y, 0.0) * 22.0) * nightFactor;
  skyCol += vec3<f32>(0.28, 0.15, 0.07) * cityGlowBand * 0.42;

  var finalSky = skyCol;
  let horizonGlow = exp(-abs(rayDir.y + 0.012) * 22.0);
  finalSky = mix(finalSky, u.skyHorizonColor.rgb, horizonGlow * (0.35 - nightFactor * 0.20));
  finalSky = compositeDistantShore(finalSky, rayDir.y, pixelAngle);

  return vec4<f32>(max(finalSky, vec3<f32>(0.0)), 1.0);
}

struct MeshIn {
  @location(0) pos : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) color : vec3<f32>,
  @location(3) mat : vec3<f32>,
  @location(4) streetFrame : vec3<f32>,
};

struct MeshOut {
  @builtin(position) @invariant clipPos : vec4<f32>,
  @location(0) worldPos : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) color : vec3<f32>,
  @location(3) mat : vec3<f32>,
  @location(4) streetFrame : vec3<f32>,
  @location(5) detailCoverage : f32,
};

fn isDetailMaterial(material : f32) -> bool {
  return material > DETAIL_MATERIAL_OFFSET - 0.5;
}

fn isRoadMarkingMaterial(material : f32) -> bool {
  return material > ROAD_MARKING_MATERIAL_OFFSET - 0.5 && !isDetailMaterial(material);
}

fn isDistanceFadingMaterial(material : f32) -> bool {
  return material > ROAD_MARKING_MATERIAL_OFFSET - 0.5;
}

@vertex
fn vs_mesh(in : MeshIn) -> MeshOut {
  var out : MeshOut;
  let isDetail = isDetailMaterial(in.mat.x);
  let isRoadMarking = isRoadMarkingMaterial(in.mat.x);
  out.detailCoverage = select(select(1.0, roadMarkingFadeAt(in.pos), isRoadMarking), detailFadeAt(in.pos), isDetail);
  out.clipPos = select(u.viewProj * vec4<f32>(in.pos, 1.0), CULLED_CLIP_POSITION, out.detailCoverage <= 0.0);
  out.worldPos = in.pos;
  out.normal = in.normal;
  out.color = resolveLiveWeatherColor(in.color);
  let fadingOffset = select(select(0.0, ROAD_MARKING_MATERIAL_OFFSET, isRoadMarking), DETAIL_MATERIAL_OFFSET, isDetail);
  out.mat = vec3<f32>(in.mat.x - fadingOffset, in.mat.y, in.mat.z);
  out.streetFrame = in.streetFrame;
  return out;
}

@vertex
fn vs_mesh_shadow(in : MeshIn) -> @builtin(position) vec4<f32> {
  return select(u.lightViewProj * vec4<f32>(in.pos, 1.0), CULLED_CLIP_POSITION, isDistanceFadingMaterial(in.mat.x));
}

struct DepthOnlyOut {
  @builtin(position) @invariant clipPos : vec4<f32>,
};

@vertex
fn vs_mesh_depth(in : MeshIn) -> DepthOnlyOut {
  var out : DepthOnlyOut;
  out.clipPos = select(u.viewProj * vec4<f32>(in.pos, 1.0), CULLED_CLIP_POSITION, isDistanceFadingMaterial(in.mat.x));
  return out;
}

struct MeshFragmentOut {
  @location(0) color : vec4<f32>,
  @builtin(sample_mask) coverageMask : u32,
};

fn meshFragment(color : vec3<f32>, coverage : f32, pixel : vec2<f32>) -> MeshFragmentOut {
  return MeshFragmentOut(vec4<f32>(color, 1.0), coverageSampleMask(coverage, pixel));
}

fn carReflectionEnvironment(R : vec3<f32>) -> vec3<f32> {
  let horizon = u.skyHorizonColor.rgb;
  let zenith = u.skyTopColor.rgb;
  let sky = mix(horizon, zenith, sqrt(clamp(R.y, 0.0, 1.0)));
  let azimuth = atan2(R.x, R.z);
  let towerColumn = floor(azimuth * 7.0);
  let towerTop = 0.06 + 0.30 * hash21(vec2<f32>(towerColumn, 3.7));
  let towerMask = step(0.0, R.y) * (1.0 - smoothstep(towerTop - 0.01, towerTop, R.y));
  let windowGlow = step(0.62, hash21(vec2<f32>(floor(azimuth * 60.0), floor(R.y * 40.0)))) * u.sunColorAndNight.w;
  let towerColor = horizon * 0.32 + vec3<f32>(0.025, 0.025, 0.03) + vec3<f32>(1.0, 0.78, 0.45) * windowGlow * 0.35;
  let skyWithTowers = mix(sky, towerColor, towerMask * 0.8);
  let street = mix(horizon * 0.28, vec3<f32>(0.03, 0.03, 0.035), clamp(-R.y * 4.0, 0.0, 1.0));
  return select(skyWithTowers, street, R.y < 0.0);
}

fn shadeCarSurface(worldPos : vec3<f32>, rawNormal : vec3<f32>, baseColor : vec3<f32>, matType : f32, ao : f32, sunVisibility : f32) -> vec3<f32> {
  let V = normalize(u.camPosAndTime.xyz - worldPos);
  var N = normalize(rawNormal);
  N = select(N, -N, dot(N, V) < 0.0);
  let sunDir = normalize(u.sunDirAndIntensity.xyz);
  let sunStrength = u.sunDirAndIntensity.w * sunVisibility;
  let sunColor = u.sunColorAndNight.rgb;
  let R = reflect(-V, N);
  let facing = clamp(dot(N, V), 0.0, 1.0);
  let env = carReflectionEnvironment(R);
  let ambient = mix(u.skyHorizonColor.rgb * 0.42, u.skyTopColor.rgb * 0.66, N.y * 0.5 + 0.5) * clamp(ao, 0.4, 1.2) + vec3<f32>(0.04, 0.045, 0.06) * u.sunColorAndNight.w;
  let diffuse = sunColor * max(dot(N, sunDir), 0.0) * sunStrength * 0.9;
  let sunAlign = max(dot(R, sunDir), 0.0);
  let wetness = clamp(u.skyTopColor.w, 0.0, 1.0);

  if (matType < 11.5) {
    let fresnel = 0.04 + 0.96 * pow(1.0 - facing, 5.0);
    let flakeNoise = valueNoise(worldPos.xz * 160.0 + vec2<f32>(worldPos.y * 110.0, worldPos.y * 70.0));
    let flake = step(0.95, flakeNoise) * pow(sunAlign, 40.0) * 0.35;
    let clearcoatShine = mix(0.55, 0.9, wetness);
    var color = baseColor * (ambient + diffuse);
    color = mix(color, env, fresnel * clearcoatShine) + env * baseColor * 0.18;
    color += sunColor * (pow(sunAlign, 900.0) * 7.0 + pow(sunAlign, 90.0) * 0.45 + flake) * sunStrength;
    return color;
  }
  if (matType < 12.5) {
    let fresnel = 0.12 + 0.88 * pow(1.0 - facing, 3.0);
    var color = baseColor * ambient * 0.5;
    color = mix(color, env * 0.95, fresnel);
    color += sunColor * (pow(sunAlign, 1200.0) * 9.0 + pow(sunAlign, 140.0) * 0.5) * sunStrength;
    return color;
  }
  let chromeFresnel = 0.55 + 0.45 * pow(1.0 - facing, 2.0);
  var color = env * (baseColor * 0.8 + vec3<f32>(0.2)) * chromeFresnel + baseColor * ambient * 0.25;
  color += sunColor * (pow(sunAlign, 500.0) * 6.0 + pow(sunAlign, 40.0) * 0.3) * sunStrength;
  return color;
}

@fragment
fn fs_mesh(in : MeshOut) -> MeshFragmentOut {
  let surfaceWorldDx = dpdx(in.worldPos);
  let surfaceWorldDy = dpdy(in.worldPos);
  let pixelFootprintMeters = max(length(surfaceWorldDx), length(surfaceWorldDy));
  let streetFrame = decodeStreetFrame(in.streetFrame);
  let streetPlaneDx = dpdx(vec2<f32>(streetFrame.alongMeters, streetFrame.acrossFromCurbMeters));
  let streetPlaneDy = dpdy(vec2<f32>(streetFrame.alongMeters, streetFrame.acrossFromCurbMeters));
  let L = normalize(u.sunDirAndIntensity.xyz);
  let V = normalize(u.camPosAndTime.xyz - in.worldPos);
  let H = normalize(L + V);
  var N = faceTowardViewer(normalize(in.normal), V);

  let matType = in.mat.x;
  let matSub = in.mat.y;
  let ao = clamp(in.mat.z, 0.25, 1.85);
  let coverage = in.detailCoverage;

  if (matType > 2.5 && matType < 3.5) {
let glowNightness = clamp(max(u.sunColorAndNight.w, clamp(u.skyTopColor.w, 0.0, 1.0) * 0.6), 0.0, 1.0);
let glow = in.color * mix(GLOW_DAY_STRENGTH, GLOW_NIGHT_STRENGTH, glowNightness);
return meshFragment(glow, coverage, in.clipPos.xy);
  }

  let sunVisibility = sunShadowVisibility(in.worldPos, N);

  if (matType > 3.5 && matType < 4.5) {
let t = u.camPosAndTime.w;
let flowSpeed = matSub;
let wetness = clamp(u.skyTopColor.w, 0.0, 1.0);
let wuv1 = in.worldPos.xz * 0.28 + vec2<f32>(0.0, t * (0.48 + flowSpeed * 0.85));
let wuv2 = in.worldPos.xz * 0.74 - vec2<f32>(t * 0.24, t * (0.36 + flowSpeed * 0.65));

let n1 = valueNoise(wuv1 * 2.5) * 2.0 - 1.0;
let n2 = valueNoise(wuv2 * 4.2) * 2.0 - 1.0;
let wave1 = sin(wuv1.x * 3.1 + wuv1.y * 2.6 + t * 2.4 + n1 * 1.6);
let wave2 = cos(wuv1.x * 5.8 - wuv1.y * 4.7 - t * 3.1 + n2 * 1.4);
let microRipple = sin(wuv2.x * 11.0 + wuv2.y * 9.5 + t * 4.2) * 0.5;

let splashCoord = in.worldPos.xz * 1.35 + vec2<f32>(sin(t * 2.2 + in.worldPos.z * 0.15) * 0.8, t * 3.4);
let splashNoise = fbm(splashCoord);
let splashBurst = smoothstep(0.58, 0.82, splashNoise + (wave1 * wave2) * 0.28);
let bankSplash = smoothstep(0.68, 0.40, ao - splashNoise * 0.16) * (0.65 + 0.35 * sin(in.worldPos.z * 2.4 + t * 5.2));
let rainRipples = wetness * smoothstep(0.72, 0.92, sin(length(fract(in.worldPos.xz * 1.8) - 0.5) * 28.0 - t * 14.0));

let waterN = normalize(vec3<f32>((wave1 + n1 * 0.6) * 0.13, 1.0, (wave2 + n2 * 0.6 + microRipple * 0.3) * 0.13));
let waterH = normalize(L + V);
let fresnel = pow(1.0 - max(dot(waterN, V), 0.0), 3.2);

let depthTint = mix(in.color * vec3<f32>(0.78, 1.10, 1.08), in.color * vec3<f32>(0.42, 0.65, 0.84), clamp((ao - 0.5) * 2.0, 0.0, 1.0));
let skyRefl = mix(u.skyHorizonColor.rgb, u.skyTopColor.rgb, clamp(waterN.y * 0.5 + 0.35, 0.0, 1.0));

var waterCol = mix(depthTint, skyRefl * 1.08, clamp(0.28 + fresnel * 0.64, 0.0, 0.92));
let totalSplashFoam = clamp(bankSplash * 0.65 + splashBurst * 0.85 + rainRipples * 0.45, 0.0, 1.0);
waterCol = mix(waterCol, vec3<f32>(0.94, 0.98, 1.0), totalSplashFoam * 0.78);

let sunSpec = pow(max(dot(waterN, waterH), 0.0), 110.0) * 2.4 * u.sunDirAndIntensity.w * sunVisibility;
let sunGlitter = pow(max(dot(waterN, waterH), 0.0), 20.0) * 0.34 * u.sunDirAndIntensity.w * sunVisibility;
waterCol += u.sunColorAndNight.rgb * (sunSpec + sunGlitter);

return meshFragment(max(waterCol, vec3<f32>(0.0)), coverage, in.clipPos.xy);
  }

  motionSmearedSurface = matType < 10.5 && isSmearedByCarMotion(in.worldPos, in.clipPos.xy);
  var surfaceCol = in.color;
  var specPower = 16.0;
  var specStrength = 0.06;
  let weatherWetness = clamp(u.skyTopColor.w, 0.0, 1.0);

  if (matType < 0.5) {
let worldUV = in.worldPos.xz * 0.11;
let patchMacro = surfacePattern(worldUV * 0.65);
let patchMed = surfacePattern(worldUV * 2.4 + vec2<f32>(in.worldPos.y * 0.18, -in.worldPos.y * 0.14));
let groundProjection = projectOntoSurface(in.worldPos, surfaceWorldDx, surfaceWorldDy, N, GROUND_TILE_METERS);
let groundDetail = sampleSurfaceDetail(SURFACE_LAYER_GROUND, groundProjection);
let fineGrain = groundDetail.height;
let microGrain = clamp(dot(groundDetail.albedoRatio, vec3<f32>(1.0 / 3.0)) * 0.5, 0.0, 1.0);

let curvedStrata = 0.5 + 0.5 * sin(in.worldPos.y * 1.45 + patchMacro * 3.8 + fineGrain * 1.2);
let graniteCol = vec3<f32>(0.48, 0.49, 0.51) * (0.78 + fineGrain * 0.28 + curvedStrata * 0.16);
let warmSoilCol = vec3<f32>(0.40, 0.32, 0.24) * (0.82 + fineGrain * 0.26 + microGrain * 0.12);
let lushGreenA = vec3<f32>(0.18, 0.44, 0.23);
let lushGreenB = vec3<f32>(0.28, 0.52, 0.26);
let greeneryCol = mix(lushGreenA, lushGreenB, patchMed) * (0.85 + microGrain * 0.30);

let slopeFlatness = clamp(N.y, 0.0, 1.0);
let isRockProp = step(ROCK_TERRAIN_VARIANT_FLOOR, matSub);
let isDryGrass = matSub > DRY_GRASS_VARIANT_FLOOR && isRockProp < 0.5;

if (isRockProp > 0.5) {
  let soilCrevice = smoothstep(0.35, 0.65, 1.0 - fineGrain);
  surfaceCol = mix(graniteCol, warmSoilCol, soilCrevice * 0.38);
} else if (isDryGrass) {
  let strawStreaks = surfaceGrain(vec2<f32>(in.worldPos.x * 3.1 + in.worldPos.z * 1.3, in.worldPos.z * 3.1 - in.worldPos.x * 1.3));
  let strawTone = mix(in.color * vec3<f32>(0.84, 0.82, 0.78), in.color * vec3<f32>(1.12, 1.08, 0.96), patchMed);
  surfaceCol = strawTone * (0.86 + microGrain * 0.24 + (strawStreaks - 0.5) * 0.2);
  surfaceCol = mix(surfaceCol, warmSoilCol, smoothstep(0.66, 0.9, 1.0 - patchMacro) * 0.18);
} else {
  let greenMask = smoothstep(0.30, 0.66, patchMacro * 0.65 + patchMed * 0.35 + (slopeFlatness - 0.65) * 0.9);
  let stoneMask = smoothstep(0.45, 0.80, (1.0 - slopeFlatness) * 1.35 + (1.0 - patchMacro) * 0.35);
  let earthAndGreen = mix(warmSoilCol, mix(in.color, greeneryCol, 0.68), greenMask);
  surfaceCol = mix(earthAndGreen, graniteCol, stoneMask * 0.82);
}

surfaceCol *= mix(vec3<f32>(1.0), groundDetail.albedoRatio, 0.5);
N = perturbSurfaceNormal(N, groundProjection, groundDetail, GROUND_RELIEF_STRENGTH);
specStrength = 0.05 + weatherWetness * 0.18;
if (isRockProp > 0.5) {
  let mossColonies = surfacePattern(in.worldPos.xz * 0.8 + vec2<f32>(in.worldPos.y * 0.9, -in.worldPos.y * 0.6));
  let upwardBias = clamp(N.y, 0.0, 1.0) * 0.3;
  let rockMossCoverage = smoothstep(0.38, 0.72, mossColonies * 0.8 + upwardBias + weatherWetness * 0.1);
  let mossProjection = projectOntoSurface(in.worldPos, surfaceWorldDx, surfaceWorldDy, N, MOSS_TILE_METERS);
  let mossedRock = growMoss(surfaceCol, N, rockMossCoverage, mossProjection);
  surfaceCol = mossedRock.color;
  N = mossedRock.normal;
}
  }
  else if (matType < 1.5) {
let isPavedWalkway = matSub > PAVED_VARIANT_FLOOR;
if (isPavedWalkway) {
  let paved = shadePavement(PavementInput(in.worldPos, N, in.color, matSub, streetFrame, surfaceWorldDx, surfaceWorldDy, streetPlaneDx, streetPlaneDy, weatherWetness));
  surfaceCol = paved.color;
  N = paved.normal;
  specPower = paved.specPower;
  specStrength = paved.specStrength;
} else {
  let asphaltProjection = projectOntoSurface(in.worldPos, surfaceWorldDx, surfaceWorldDy, N, ASPHALT_TILE_METERS);
  let groundDetail = sampleSurfaceDetail(SURFACE_LAYER_ASPHALT, asphaltProjection);
  let wearTone = 0.9 + surfaceGrain(in.worldPos.xz * 0.13) * 0.2;
  let crackRegion = smoothstep(0.55, 0.7, surfaceGrain(in.worldPos.xz * 0.05 + vec2<f32>(31.7, 12.3)));
  let crevice = groundDetail.crevice * crackRegion;
  let surfaceGloss = 0.5 + groundDetail.gloss;
  N = perturbSurfaceNormal(N, asphaltProjection, groundDetail, ASPHALT_RELIEF_STRENGTH);
  surfaceCol = in.color * groundDetail.albedoRatio * wearTone * (1.0 - crevice * 0.55);
  var puddleMask = 0.0;
  if (weatherWetness > 0.01) {
    puddleMask = weatherWetness * smoothstep(0.42, 0.68, surfacePattern(in.worldPos.xz * 0.35) + (0.4 - groundDetail.height) * 0.25);
  }
  let skyMirror = mix(u.skyHorizonColor.rgb, u.skyTopColor.rgb, 0.4);
  surfaceCol = mix(surfaceCol, surfaceCol * 0.65 + skyMirror * 0.22, puddleMask);
  specPower = mix(24.0, 96.0, weatherWetness);
  specStrength = mix(0.18, 0.85, weatherWetness) * surfaceGloss;
}
  }
  else if (matType < 2.5) {
specPower = 52.0;
specStrength = 0.56;
  }
  else if (matType > 4.5 && matType < 5.5 && N.y > STONE_PAVED_TOP_MIN_NORMAL_Y) {
let pavedStone = shadePavement(PavementInput(in.worldPos, N, in.color, PAVING_PATTERN_SLAB_VARIANT, streetFrame, surfaceWorldDx, surfaceWorldDy, streetPlaneDx, streetPlaneDy, weatherWetness));
surfaceCol = pavedStone.color;
N = pavedStone.normal;
specPower = pavedStone.specPower;
specStrength = pavedStone.specStrength;
  }
  else if (matType > 4.5 && matType < 5.5) {
let masonry = masonryCoordinates(MasonryInput(in.worldPos, N, streetFrame, surfaceWorldDx, surfaceWorldDy, streetPlaneDx.x, streetPlaneDy.x));
let horizCoord = masonry.x;
let vertCoord = masonry.y;

let courseH = 0.85;
let blockW = 1.70;
let rowIdx = floor(vertCoord / courseH);
let colCoord = horizCoord + fract(rowIdx * 0.5) * blockW;
let blockIdx = floor(colCoord / blockW);

let uLocal = fract(colCoord / blockW);
let vLocal = fract(vertCoord / courseH);

let stoneJointDetail = patternVisibility(pixelFootprintMeters, courseH * 0.25);
let stoneGrainDetail = patternVisibility(pixelFootprintMeters, 0.09);
let mortarX = smoothstep(0.035, 0.0, min(uLocal, 1.0 - uLocal));
let mortarY = smoothstep(0.055, 0.0, min(vLocal, 1.0 - vLocal));
let mortarMask = mix(STONE_MORTAR_COVERAGE, max(mortarX, mortarY), stoneJointDetail);

let blockHash = mix(0.5, hash21(vec2<f32>(blockIdx, rowIdx)), stoneJointDetail);
let stoneGrain = mix(0.5, surfaceGrain(vec2<f32>(horizCoord * 3.6, vertCoord * 3.6)) * 0.65 +
                 surfaceGrain(vec2<f32>(horizCoord * 11.0, vertCoord * 11.0)) * 0.35, stoneGrainDetail);
let weatherStreak = surfacePattern(vec2<f32>(horizCoord * 0.45, vertCoord * 0.18));

let corniceWave = abs(fract(vertCoord / 4.25) - 0.5);
let isBeltCourse = smoothstep(0.44, 0.49, corniceWave);

var wallCol = in.color * (0.90 + (blockHash - 0.5) * 0.12 + (stoneGrain - 0.5) * 0.16);
wallCol *= (0.93 + weatherStreak * 0.12);
wallCol = mix(wallCol, wallCol * 1.14, isBeltCourse * 0.65);
wallCol = mix(wallCol, wallCol * 0.66, mortarMask * 0.78);

if (matSub > 0.35 && abs(N.y) < 0.25 && vertCoord - u.carPosAndHeading.y > 4.2) {
  let bayX = fract(horizCoord / 3.4);
  let bayY = fract((vertCoord - 1.2) / 3.8);
  let inBay = step(0.32, bayX) * step(bayX, 0.68) * step(0.28, bayY) * step(bayY, 0.74);
  if (inBay > 0.5 && isBeltCourse < 0.2) {
    let mullion = step(0.48, bayX) * step(bayX, 0.52) + step(0.50, bayY) * step(bayY, 0.54);
    let winSeed = hash21(vec2<f32>(floor(horizCoord / 3.4), floor((vertCoord - 1.2) / 3.8)));
    let nightLit = step(0.42, winSeed) * u.sunColorAndNight.w;
    let warmRoomCol = mix(vec3<f32>(1.0, 0.82, 0.48), vec3<f32>(0.98, 0.90, 0.72), fract(winSeed * 13.7));
    let glassShade = mix(
      mix(vec3<f32>(0.14, 0.17, 0.21), u.skyHorizonColor.rgb * 0.38, 0.35),
      warmRoomCol * 1.15,
      nightLit * 0.88
    );
    let frameCol = wallCol * 0.55;
    wallCol = mix(glassShade, frameCol, clamp(mullion, 0.0, 1.0));
    specPower = 64.0;
    specStrength = 0.38;
  } else {
    specPower = 18.0;
    specStrength = 0.08;
  }
} else {
  specPower = 18.0;
  specStrength = 0.08;
}

let stoneBump = (stoneGrain - 0.5) * 0.12 - mortarMask * 0.15;
N = normalize(N + vec3<f32>(stoneBump, stoneBump * 0.5, -stoneBump));
surfaceCol = wallCol;
  }
  else if (matType > 5.5 && matType < 6.5) {
if (matSub < 0.3) {
  let barkGrain = surfaceGrain(vec2<f32>(in.worldPos.x * 8.0 + in.worldPos.z * 8.0, in.worldPos.y * 2.2));
  surfaceCol = in.color * (0.80 + barkGrain * 0.38);
  specStrength = 0.03;
} else {
  let leafUV = in.worldPos.xz * 2.8 + vec2<f32>(in.worldPos.y * 2.4, -in.worldPos.y * 1.9);
  let leafCluster = surfaceGrain(leafUV * 0.8);
  let microLeaf = surfaceGrain(leafUV * 4.5);
  let warmSunLeaf = vec3<f32>(0.12, 0.18, 0.04) * smoothstep(0.45, 0.85, leafCluster) * max(dot(N, L), 0.0);
  surfaceCol = in.color * (0.78 + leafCluster * 0.34 + (microLeaf - 0.5) * 0.16) + warmSunLeaf;
  let leafBump = (microLeaf - 0.5) * 0.26;
  N = normalize(N + vec3<f32>(leafBump, abs(leafBump) * 0.4, -leafBump));
  specPower = 12.0;
  specStrength = 0.07;
}
  }
  else if (matType > 6.5 && matType < 7.5) {
let ashlarCoordinates = select(masonryCoordinates(MasonryInput(in.worldPos, N, streetFrame, surfaceWorldDx, surfaceWorldDy, streetPlaneDx.x, streetPlaneDy.x)), vec2<f32>(streetFrame.alongMeters, streetFrame.acrossFromCurbMeters), streetFrame.hasFrame && N.y > FLAT_FACE_MIN_NORMAL_Y);
let courseRow = floor(ashlarCoordinates.y / ASHLAR_COURSE_HEIGHT_METERS);
let bondShifted = ashlarCoordinates.x + fract(courseRow * 0.5) * ASHLAR_BLOCK_LENGTH_METERS;
let blockColumn = floor(bondShifted / ASHLAR_BLOCK_LENGTH_METERS);
let blockU = fract(bondShifted / ASHLAR_BLOCK_LENGTH_METERS);
let blockV = fract(ashlarCoordinates.y / ASHLAR_COURSE_HEIGHT_METERS);
let metersToJoint = min(min(blockU, 1.0 - blockU) * ASHLAR_BLOCK_LENGTH_METERS, min(blockV, 1.0 - blockV) * ASHLAR_COURSE_HEIGHT_METERS);
let ashlarDetail = patternVisibility(pixelFootprintMeters, ASHLAR_COURSE_HEIGHT_METERS * 0.25);
let joint = mix(ASHLAR_JOINT_COVERAGE, 1.0 - smoothstep(ASHLAR_JOINT_METERS * 0.5, ASHLAR_JOINT_METERS, metersToJoint), ashlarDetail);
let arris = (1.0 - smoothstep(ASHLAR_JOINT_METERS, ASHLAR_ARRIS_METERS, metersToJoint)) * ashlarDetail;
let blockHash = mix(0.5, hash21(vec2<f32>(blockColumn, courseRow)), ashlarDetail);
let veinWarp = surfacePattern(ashlarCoordinates * 0.7 + vec2<f32>(blockHash * 17.0, blockHash * 5.0)) * 3.6;
let veinLine = abs(sin((ashlarCoordinates.x * 1.1 + ashlarCoordinates.y * 0.6 + veinWarp) * 2.2));
let veinMask = (1.0 - smoothstep(0.0, 0.06, veinLine)) * patternVisibility(pixelFootprintMeters, 0.08);
var ashlarCol = in.color * (0.93 + (blockHash - 0.5) * 0.12 + surfaceGrain(ashlarCoordinates * 5.0) * 0.05);
ashlarCol = mix(ashlarCol, ashlarCol * vec3<f32>(0.80, 0.80, 0.83), veinMask * 0.35);
ashlarCol *= 1.0 - arris * 0.1;
surfaceCol = mix(ashlarCol, in.color * 0.5, joint * 0.85);
let ashlarBump = ((blockHash - 0.5) * 0.05 - joint * 0.22 - arris * 0.06) * ashlarDetail;
N = normalize(N + vec3<f32>(ashlarBump, ashlarBump * 0.5, -ashlarBump));
specPower = 48.0;
specStrength = 0.14 + weatherWetness * 0.2;
  }
  else if (matType > 7.5 && matType < 8.5) {
let plankCoordinates = masonryCoordinates(MasonryInput(in.worldPos, N, streetFrame, surfaceWorldDx, surfaceWorldDy, streetPlaneDx.x, streetPlaneDy.x));
let along = plankCoordinates.x;
let across = plankCoordinates.y;
let plankW = 0.19;
let plankL = 1.85;
let pr = floor(across / plankW);
let shiftedA = along + hash21(vec2<f32>(pr, 3.1)) * plankL;
let pc = floor(shiftedA / plankL);
let pu = fract(across / plankW);
let pv = fract(shiftedA / plankL);
let plankDetail = patternVisibility(pixelFootprintMeters, plankW);
let ph = mix(0.5, hash21(vec2<f32>(pr, pc)), plankDetail);
let grain = mix(0.5, surfaceGrain(vec2<f32>(shiftedA * 6.0, across * 48.0 + ph * 10.0)), patternVisibility(pixelFootprintMeters, plankW * 0.25));
let gap = mix(PLANK_GAP_COVERAGE, max(smoothstep(0.05, 0.0, min(pu, 1.0 - pu)), smoothstep(0.012, 0.0, min(pv, 1.0 - pv))), plankDetail);
surfaceCol = in.color * (0.78 + ph * 0.30 + (grain - 0.5) * 0.22);
surfaceCol = mix(surfaceCol, surfaceCol * 0.35, gap * 0.9);
specPower = 42.0;
specStrength = 0.22;
  }
  else if (matType > 8.5 && matType < 9.5) {
let plasterNoise = surfaceGrain(in.worldPos.xz * 1.7 + vec2<f32>(in.worldPos.y * 1.3, 0.0));
surfaceCol = in.color * (0.93 + plasterNoise * 0.1);
if (matSub > PLASTER_PANEL_VARIANT_FLOOR && abs(N.y) < 0.5) {
  let panelCoordinates = masonryCoordinates(MasonryInput(in.worldPos, N, streetFrame, surfaceWorldDx, surfaceWorldDy, streetPlaneDx.x, streetPlaneDy.x));
  let panelSize = vec2<f32>(PLASTER_PANEL_WIDTH_METERS, PLASTER_PANEL_HEIGHT_METERS);
  let panelLocal = fract(panelCoordinates / panelSize);
  let metersToSeam = min(min(panelLocal.x, 1.0 - panelLocal.x) * panelSize.x, min(panelLocal.y, 1.0 - panelLocal.y) * panelSize.y);
  let seam = (1.0 - smoothstep(PLASTER_PANEL_SEAM_METERS * 0.5, PLASTER_PANEL_SEAM_METERS, metersToSeam)) * patternVisibility(pixelFootprintMeters, PLASTER_PANEL_HEIGHT_METERS * 0.25);
  surfaceCol *= 0.985 + hash21(floor(panelCoordinates / panelSize)) * 0.03;
  surfaceCol = mix(surfaceCol, surfaceCol * 0.66, seam);
}
specPower = 10.0;
specStrength = 0.04;
  }
  else if (matType > 9.5 && matType < 10.5) {
let marbleCoord = masonryCoordinates(MasonryInput(in.worldPos, N, streetFrame, surfaceWorldDx, surfaceWorldDy, streetPlaneDx.x, streetPlaneDy.x));
let veinWarp = surfacePattern(marbleCoord * 0.55) * 4.2;
let veinLine = abs(sin((marbleCoord.x * 0.9 + marbleCoord.y * 0.55 + veinWarp) * 2.4));
let fineVein = abs(sin((marbleCoord.x * 2.3 - marbleCoord.y * 1.4 + veinWarp * 1.7) * 3.1));
let veinMask = (1.0 - smoothstep(0.0, 0.07, veinLine)) * 0.75 + (1.0 - smoothstep(0.0, 0.035, fineVein)) * 0.35;
let slabCloud = surfaceGrain(marbleCoord * 1.6) * 0.06 + surfaceGrain(marbleCoord * 7.0) * 0.03;
surfaceCol = in.color * (0.95 + slabCloud);
surfaceCol = mix(surfaceCol, surfaceCol * vec3<f32>(0.58, 0.58, 0.62), clamp(veinMask, 0.0, 1.0) * 0.55);
specPower = 72.0;
specStrength = 0.22 + weatherWetness * 0.25;
  }

  let ndotl = max(dot(N, L), 0.0);
  let nightFactor = u.sunColorAndNight.w;
  let ambient = ambientLight(N) * ao;
  let direct = u.sunColorAndNight.rgb * ndotl * u.sunDirAndIntensity.w * 0.92 * sunVisibility;
  let isGroundSurface = matType < 1.5;
  var spec = 0.0;
  if (!isGroundSurface) {
    spec = pow(max(dot(N, H), 0.0), specPower) * specStrength * u.sunDirAndIntensity.w * sunVisibility;
  }

  var litColor = surfaceCol * (ambient + direct) + u.sunColorAndNight.rgb * spec;
  if (matType > 10.5) {
    litColor = shadeCarSurface(in.worldPos, in.normal, in.color, matType, ao, sunVisibility);
  }

  let streetLampActive = clamp(nightFactor * 1.15 + weatherWetness * 0.35, 0.0, 1.0);
  if (streetLampActive > 0.05) {
let heightAboveStreet = max(in.worldPos.y - u.carPosAndHeading.y, 0.0);
let lampPool = streetLampLight(streetFrame, in.worldPos.xz);
let warmLampCol = vec3<f32>(1.0, 0.80, 0.46);
let storefrontWarmCol = vec3<f32>(1.0, 0.86, 0.60);

if (matType < 1.5) {
  let sidewalkBoost = select(1.0, 1.35, matSub > PAVED_VARIANT_FLOOR);
  let pathLight = lampPool * sidewalkBoost * streetLampActive * 0.88;
  litColor += surfaceCol * warmLampCol * pathLight;
}
else if (matType > 4.5 && matType < 5.5) {
  let baseFalloff = exp(-heightAboveStreet * 0.13);
  let groundStorefront = exp(-heightAboveStreet * 0.34) * 0.65;
  let wallIllum = (baseFalloff * (0.55 + 0.45 * lampPool) + groundStorefront) * streetLampActive * 1.12;
  litColor += surfaceCol * mix(warmLampCol, storefrontWarmCol, 0.4) * wallIllum;
}
else if (heightAboveStreet < 12.0) {
  let propFalloff = exp(-heightAboveStreet * 0.16);
  litColor += surfaceCol * warmLampCol * propFalloff * (0.50 + 0.50 * lampPool) * streetLampActive * 0.85;
}
  }

  return meshFragment(max(litColor, vec3<f32>(0.0)), coverage, in.clipPos.xy);
}
`;
}
