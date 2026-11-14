// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const MINIMAP_VIEW_RADIUS_METERS = 170;
const MINIMAP_SQUIRCLE_EXPONENT = 4.5;
const MINIMAP_SQUIRCLE_STEPS = 96;
const MINIMAP_HEADING_FOLLOW_RATE = 6.0;
const MINIMAP_ROAD_WIDTH_METERS = 11.2;
const MINIMAP_ROAD_CASING_PIXELS = 3;
const MINIMAP_CAR_ARROW_PIXELS = 7;
const MINIMAP_TRAFFIC_DOT_PIXELS = 1.6;
const MINIMAP_BORDER_PIXELS = 1.5;

const MINIMAP_COLORS = {
  background: "rgba(8, 13, 28, 0.82)",
  backgroundGlow: "rgba(56, 189, 248, 0.10)",
  roadCasing: "rgba(148, 163, 184, 0.30)",
  road: "rgba(203, 213, 225, 0.62)",
  currentRoad: "rgba(125, 211, 252, 0.95)",
  traffic: "rgba(251, 191, 36, 0.85)",
  car: "#f8fafc",
  carOutline: "rgba(14, 165, 233, 1)",
  border: "rgba(148, 163, 184, 0.35)"
};

const minimapCanvas = document.getElementById("minimap-canvas");
const minimapContext = minimapCanvas.getContext("2d");
const minimapView = { heading: null, sizePixels: 0, pixelRatio: 1 };

function updateMinimap(dt) {
  if (!carLocation.edge && !carLocation.junction) return;
  fitMinimapCanvasToLayout();
  followCarHeading(state.car.heading, dt);
  drawMinimap(state.car);
}

function fitMinimapCanvasToLayout() {
  const sizePixels = minimapCanvas.clientWidth;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  if (sizePixels === minimapView.sizePixels && pixelRatio === minimapView.pixelRatio) return;
  minimapView.sizePixels = sizePixels;
  minimapView.pixelRatio = pixelRatio;
  minimapCanvas.width = Math.round(sizePixels * pixelRatio);
  minimapCanvas.height = Math.round(sizePixels * pixelRatio);
}

function followCarHeading(carHeading, dt) {
  if (minimapView.heading === null) {
    minimapView.heading = carHeading;
    return;
  }
  const followFraction = 1 - Math.exp(-MINIMAP_HEADING_FOLLOW_RATE * dt);
  minimapView.heading += wrapAngle(carHeading - minimapView.heading) * followFraction;
}

function drawMinimap(car) {
  const size = minimapView.sizePixels;
  if (size <= 0) return;
  const context = minimapContext;
  context.setTransform(minimapView.pixelRatio, 0, 0, minimapView.pixelRatio, 0, 0);
  context.clearRect(0, 0, size, size);

  context.save();
  traceSquircle(context, size, 0);
  context.clip();
  paintBackground(context, size);

  const projection = createCarCenteredProjection(car, size, minimapView.heading);
  const visibleEdges = collectVisibleEdges(car);
  strokeRoads(context, projection, visibleEdges, { color: MINIMAP_COLORS.roadCasing, extraPixels: MINIMAP_ROAD_CASING_PIXELS });
  strokeRoads(context, projection, visibleEdges, { color: MINIMAP_COLORS.road, extraPixels: 0 });
  fillJunctions(context, projection, car);
  strokeCurrentRoad(context, projection);
  if (state.trafficEnabled) drawTraffic(context, projection);
  drawCarArrow(context, size, wrapAngle(car.heading - minimapView.heading));
  context.restore();

  traceSquircle(context, size, MINIMAP_BORDER_PIXELS * 0.5);
  context.lineWidth = MINIMAP_BORDER_PIXELS;
  context.strokeStyle = MINIMAP_COLORS.border;
  context.stroke();
}

function createCarCenteredProjection(car, size, viewHeading) {
  const center = size * 0.5;
  const pixelsPerMeter = center / MINIMAP_VIEW_RADIUS_METERS;
  const forwardX = -Math.sin(viewHeading);
  const forwardZ = -Math.cos(viewHeading);
  const rightX = Math.cos(viewHeading);
  const rightZ = -Math.sin(viewHeading);
  return {
    pixelsPerMeter,
    toScreen(worldX, worldZ) {
      const offsetX = worldX - car.x;
      const offsetZ = worldZ - car.z;
      const ahead = offsetX * forwardX + offsetZ * forwardZ;
      const across = offsetX * rightX + offsetZ * rightZ;
      return { x: center + across * pixelsPerMeter, y: center - ahead * pixelsPerMeter };
    }
  };
}

function collectVisibleEdges(car) {
  const visible = [];
  for (const edge of roadGraph.edges.values()) {
    const middleNode = edge.nodes[edge.segmentCount >> 1];
    const halfLength = edge.segmentCount * SEG_LENGTH * 0.5;
    const reach = MINIMAP_VIEW_RADIUS_METERS * Math.SQRT2 + halfLength;
    if (Math.hypot(middleNode.x - car.x, middleNode.z - car.z) <= reach) visible.push(edge);
  }
  return visible;
}

function roadWidthPixels(edge, projection) {
  const middleInfo = edge.nodes[edge.segmentCount >> 1].info;
  const widthMeters = middleInfo && middleInfo.roadHalfWidth > BOULEVARD_HALF_WIDTH_THRESHOLD ? middleInfo.roadHalfWidth * 2 : MINIMAP_ROAD_WIDTH_METERS;
  return Math.max(2.5, widthMeters * projection.pixelsPerMeter);
}

function traceEdgePath(context, projection, edge) {
  const start = projection.toScreen(edge.ja.x, edge.ja.z);
  context.moveTo(start.x, start.y);
  for (const node of edge.nodes) {
    const point = projection.toScreen(node.x, node.z);
    context.lineTo(point.x, point.y);
  }
  const end = projection.toScreen(edge.jb.x, edge.jb.z);
  context.lineTo(end.x, end.y);
}

function strokeRoads(context, projection, edges, { color, extraPixels }) {
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = color;
  for (const edge of edges) {
    context.beginPath();
    traceEdgePath(context, projection, edge);
    context.lineWidth = roadWidthPixels(edge, projection) + extraPixels;
    context.stroke();
  }
}

function strokeCurrentRoad(context, projection) {
  const edge = carLocation.kind === "edge" ? carLocation.edge : null;
  if (!edge) return;
  context.beginPath();
  traceEdgePath(context, projection, edge);
  context.lineWidth = Math.max(1.5, roadWidthPixels(edge, projection) * 0.35);
  context.strokeStyle = MINIMAP_COLORS.currentRoad;
  context.stroke();
}

function fillJunctions(context, projection, car) {
  const reachSquared = (MINIMAP_VIEW_RADIUS_METERS * 1.6) ** 2;
  context.fillStyle = MINIMAP_COLORS.road;
  for (const junction of roadGraph.junctions.values()) {
    const distanceSquared = (junction.x - car.x) ** 2 + (junction.z - car.z) ** 2;
    if (distanceSquared > reachSquared) continue;
    const point = projection.toScreen(junction.x, junction.z);
    const radiusPixels = Math.max(2, junction.radius * 0.7 * projection.pixelsPerMeter);
    context.beginPath();
    context.arc(point.x, point.y, radiusPixels, 0, Math.PI * 2);
    context.fill();
  }
}

function drawTraffic(context, projection) {
  context.fillStyle = MINIMAP_COLORS.traffic;
  for (const vehicle of state.traffic) {
    const point = projection.toScreen(vehicle.x, vehicle.z);
    if (point.x < 0 || point.y < 0 || point.x > minimapView.sizePixels || point.y > minimapView.sizePixels) continue;
    context.beginPath();
    context.arc(point.x, point.y, MINIMAP_TRAFFIC_DOT_PIXELS, 0, Math.PI * 2);
    context.fill();
  }
}

function drawCarArrow(context, size, headingOffsetFromView) {
  const arrowSize = MINIMAP_CAR_ARROW_PIXELS;
  context.save();
  context.translate(size * 0.5, size * 0.5);
  context.rotate(-headingOffsetFromView);
  context.beginPath();
  context.moveTo(0, -arrowSize * 1.25);
  context.lineTo(arrowSize * 0.85, arrowSize);
  context.lineTo(0, arrowSize * 0.5);
  context.lineTo(-arrowSize * 0.85, arrowSize);
  context.closePath();
  context.shadowColor = MINIMAP_COLORS.carOutline;
  context.shadowBlur = 8;
  context.fillStyle = MINIMAP_COLORS.car;
  context.fill();
  context.shadowBlur = 0;
  context.lineWidth = 1.5;
  context.strokeStyle = MINIMAP_COLORS.carOutline;
  context.stroke();
  context.restore();
}

function paintBackground(context, size) {
  context.fillStyle = MINIMAP_COLORS.background;
  context.fillRect(0, 0, size, size);
  const glow = context.createRadialGradient(size * 0.5, size * 0.5, 0, size * 0.5, size * 0.5, size * 0.6);
  glow.addColorStop(0, MINIMAP_COLORS.backgroundGlow);
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);
}

function traceSquircle(context, size, insetPixels) {
  const center = size * 0.5;
  const radius = center - insetPixels;
  const exponent = 2 / MINIMAP_SQUIRCLE_EXPONENT;
  context.beginPath();
  for (let step = 0; step <= MINIMAP_SQUIRCLE_STEPS; step++) {
    const angle = (step / MINIMAP_SQUIRCLE_STEPS) * Math.PI * 2;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const x = center + radius * Math.sign(cosine) * Math.abs(cosine) ** exponent;
    const y = center + radius * Math.sign(sine) * Math.abs(sine) ** exponent;
    if (step === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}
