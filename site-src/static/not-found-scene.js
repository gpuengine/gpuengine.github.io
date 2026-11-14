import { createApp, isSupported, SceneObject, MeshBuilder, material, boxCollider, createGround, createCar, createTree, createLampPost, VehicleController, createRandom } from "wgpu3d";

const GLYPH_ROWS = 7;
const GLYPH_ADVANCE_COLUMNS = 6;
const SPACE_ADVANCE_COLUMNS = 3;
const VOXEL_FILL = 0.92;
const GLYPHS = Object.freeze({
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."]
});
const BIG_WORD = { text: "404", voxelSize: 1.1, depth: 1.6, z: -8, finish: material("#ff8a3d", { gloss: 0.55 }) };
const FLOOR_WORD = { text: "PAGE NOT FOUND", voxelSize: 0.3, depth: 0.16, z: 2.5, finish: material("#ffe6cc", { glow: 0.4 }) };
const CAR_START = Object.freeze({ position: [9, 0, 12], yaw: 0.5 });
const DRIVE_BOUNDS = Object.freeze({ minX: -70, maxX: 70, minZ: -70, maxZ: 70 });
const ORBIT_SWAY_RADIANS = 0.45;
const ORBIT_SWAY_SPEED = 0.18;
const ORBIT_BASE_DISTANCE = 34;
const SCENE_HALF_WIDTH_METERS = 15;
const CAMERA_FIELD_OF_VIEW_DEGREES = 50;

const stage = document.querySelector(".not-found-stage");
const driveButton = document.querySelector("#not-found-drive");

if (isSupported()) startScene().catch(() => stage.classList.remove("is-3d"));

async function startScene() {
  const app = await createApp({ canvas: document.querySelector("#not-found-scene"), environment: "sunset", camera: { fieldOfView: CAMERA_FIELD_OF_VIEW_DEGREES } });
  app.add(createGround({ size: 180, tiles: 36 }));
  addBigWord(app);
  app.add(buildFloorWord());
  addSurroundings(app, createRandom(404));

  const car = createCar({ paint: "#1d6fd8" });
  car.position = [...CAR_START.position];
  car.yaw = CAR_START.yaw;
  car.addBehavior(new VehicleController({ bounds: DRIVE_BOUNDS }));
  app.add(car);

  const orbit = app.orbit({ target: [0, 3, -2], distance: distanceToFitScene(app.canvas), pitch: 0.3, yaw: 0, minDistance: 12, maxDistance: 90 });
  let isSwaying = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  app.canvas.addEventListener("pointerdown", () => { isSwaying = false; }, { once: true });
  let isDriving = false;
  const startDriving = () => {
    if (isDriving) return;
    isDriving = true;
    app.input.touchStickEnabled = true;
    app.follow(car, { speedFieldOfView: 10 });
    stage.classList.add("is-driving");
    app.canvas.focus({ preventScroll: true });
  };
  driveButton.addEventListener("click", startDriving);
  app.onUpdate(({ input, timeSeconds }) => {
    if (!isDriving && (input.isDown("forward") || input.isDown("backward"))) startDriving();
    if (!isDriving && isSwaying) orbit.yaw = Math.sin(timeSeconds * ORBIT_SWAY_SPEED) * ORBIT_SWAY_RADIANS;
  });
  app.start();
  stage.classList.add("is-3d");
}

function distanceToFitScene(canvas) {
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const halfHorizontalView = Math.atan(Math.tan((CAMERA_FIELD_OF_VIEW_DEGREES * Math.PI) / 360) * aspect);
  return Math.max(ORBIT_BASE_DISTANCE, SCENE_HALF_WIDTH_METERS / Math.tan(halfHorizontalView));
}

function addBigWord(app) {
  let cursor = -wordWidthColumns(BIG_WORD.text) / 2;
  for (const character of BIG_WORD.text) {
    const glyph = GLYPHS[character];
    const builder = new MeshBuilder();
    addGlyphVoxels(builder, glyph, { voxelSize: BIG_WORD.voxelSize, depth: BIG_WORD.depth, finish: BIG_WORD.finish, leftColumn: -2.5 });
    const glyphWidth = glyph[0].length * BIG_WORD.voxelSize;
    const glyphHeight = GLYPH_ROWS * BIG_WORD.voxelSize;
    app.add(new SceneObject({
      name: `glyph-${character}`,
      mesh: builder.toMesh(),
      position: [(cursor + 2.5) * BIG_WORD.voxelSize, 0, BIG_WORD.z],
      collider: { ...boxCollider([glyphWidth, glyphHeight, BIG_WORD.depth]), offset: [0, glyphHeight / 2, 0] }
    }));
    cursor += GLYPH_ADVANCE_COLUMNS;
  }
}

function buildFloorWord() {
  const builder = new MeshBuilder();
  builder.withTransform({ position: [0, FLOOR_WORD.depth / 2, FLOOR_WORD.z], pitch: -Math.PI / 2 }, (flat) => {
    let cursor = -wordWidthColumns(FLOOR_WORD.text) / 2;
    for (const character of FLOOR_WORD.text) {
      if (character === " ") {
        cursor += SPACE_ADVANCE_COLUMNS;
        continue;
      }
      addGlyphVoxels(flat, GLYPHS[character], { voxelSize: FLOOR_WORD.voxelSize, depth: FLOOR_WORD.depth, finish: FLOOR_WORD.finish, leftColumn: cursor });
      cursor += GLYPH_ADVANCE_COLUMNS;
    }
  });
  return new SceneObject({ name: "floor-word", mesh: builder.toMesh(), castsShadow: false });
}

function addGlyphVoxels(builder, glyph, { voxelSize, depth, finish, leftColumn }) {
  glyph.forEach((row, rowIndex) => {
    [...row].forEach((cell, columnIndex) => {
      if (cell !== "#") return;
      builder.box({
        center: [(leftColumn + columnIndex + 0.5) * voxelSize, (GLYPH_ROWS - rowIndex - 0.5) * voxelSize, 0],
        size: [voxelSize * VOXEL_FILL, voxelSize * VOXEL_FILL, depth],
        material: finish
      });
    });
  });
}

function wordWidthColumns(text) {
  const advances = [...text].map((character) => (character === " " ? SPACE_ADVANCE_COLUMNS : GLYPH_ADVANCE_COLUMNS));
  return advances.reduce((sum, advance) => sum + advance, 0) - 1;
}

function addSurroundings(app, random) {
  for (const x of [-14, 14]) app.add(createLampPost({ position: [x, 0, -4] }));
  for (let index = 0; index < 45; index++) {
    const angle = random() * Math.PI * 2;
    const distance = random.range(26, 70);
    app.add(createTree({ seed: index + 1, kind: random() < 0.5 ? "pine" : "round", height: random.range(4, 9), position: [Math.cos(angle) * distance, 0, Math.sin(angle) * distance] }));
  }
}
