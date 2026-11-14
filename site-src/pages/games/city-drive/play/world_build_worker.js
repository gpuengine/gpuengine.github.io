// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const workerBuildState = {
  isLoaded: false,
  geometryBuffer: null
};

self.onmessage = (event) => {
  const message = event.data;
  if (message.type === "load") {
    loadWorldScripts(message);
    return;
  }
  if (message.type === "graphChanges") {
    applyRoadGraphChanges(message.changes);
    return;
  }
  if (message.type === "foliageAssets") {
    postFoliageAssets();
    return;
  }
  if (message.type === "build") {
    buildRequestedSlot(message);
  }
};

function loadWorldScripts({ worldSeed, scriptUrls }) {
  self.presetWorldSeed = worldSeed;
  importScripts(...scriptUrls);
  workerBuildState.geometryBuffer = new Float32Array(VERTS_PER_SEGMENT * FLOATS_PER_VERT);
  workerBuildState.isLoaded = true;
  self.postMessage({ type: "loaded" });
}

function postFoliageAssets() {
  const foliageAssets = buildFoliageAssets();
  const transferables = [
    ...foliageAssets.treeSpeciesMeshes.flat().flatMap(mesh => [mesh.vertexData, mesh.indices.buffer]),
    ...foliageAssets.leafAtlasMipChain.map(level => level.data.buffer)
  ];
  self.postMessage({ type: "foliageAssets", foliageAssets }, transferables);
}

function buildRequestedSlot(request) {
  const built = request.edgeId !== undefined ? buildEdgeSegment(request) : buildJunction(request);
  if (!built) {
    self.postMessage({ type: "built", requestId: request.requestId, isMissing: true });
    return;
  }
  const { vertexCount, trees, anchorUpdates } = built;
  const vertexData = workerBuildState.geometryBuffer.slice(0, vertexCount * FLOATS_PER_VERT);
  self.postMessage({ type: "built", requestId: request.requestId, vertexData, vertexCount, trees, anchorUpdates }, [vertexData.buffer]);
}

function buildEdgeSegment({ edgeId, segmentIndex }) {
  const edge = roadGraph.edges.get(edgeId);
  if (!edge || !edge.nodes[segmentIndex + 1]) return null;
  const startNode = edge.nodes[segmentIndex];
  const built = buildIntoSharedBuffer(() => buildRoadSegmentGeometry(startNode, edge.nodes[segmentIndex + 1], workerBuildState.geometryBuffer));
  return {
    ...built,
    anchorUpdates: { obstacles: startNode.obstacles, hidesLeftSide: startNode.hidesLeftSide, hidesRightSide: startNode.hidesRightSide }
  };
}

function buildJunction({ junctionId }) {
  const junction = roadGraph.junctions.get(junctionId);
  if (!junction) return null;
  const built = buildIntoSharedBuffer(() => buildJunctionGeometry(junction, workerBuildState.geometryBuffer));
  return {
    ...built,
    anchorUpdates: { obstacles: junction.obstacles, cornerLandTriangles: junction.cornerLandTriangles }
  };
}

function buildIntoSharedBuffer(buildGeometry) {
  const { result: vertexCount, trees } = collectTreeInstances(buildGeometry);
  drapeVerticesOnTerrain(workerBuildState.geometryBuffer, vertexCount);
  return { vertexCount, trees };
}
