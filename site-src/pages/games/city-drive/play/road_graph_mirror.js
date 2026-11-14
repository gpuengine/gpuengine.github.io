// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const MIRROR_HIDES_LEFT_SIDE_BIT = 1;
const MIRROR_HIDES_RIGHT_SIDE_BIT = 2;

function describeRoadGraphChanges(edgeIdsKnownToMirror) {
  const removedEdgeIds = [...edgeIdsKnownToMirror].filter(edgeId => !roadGraph.edges.has(edgeId));
  for (const edgeId of removedEdgeIds) edgeIdsKnownToMirror.delete(edgeId);
  const addedEdges = [];
  for (const edge of roadGraph.edges.values()) {
    if (edgeIdsKnownToMirror.has(edge.id)) continue;
    edgeIdsKnownToMirror.add(edge.id);
    addedEdges.push(describeMirrorEdge(edge));
  }
  return {
    removedEdgeIds,
    addedEdges,
    junctions: Array.from(roadGraph.junctions.values(), describeMirrorJunction),
    sideHiding: Array.from(roadGraph.edges.values(), describeEdgeSideHiding),
    nextId: roadGraph.nextId,
    nextBlock: roadGraph.nextBlock
  };
}

function applyRoadGraphChanges(changes) {
  for (const edgeId of changes.removedEdgeIds) roadGraph.edges.delete(edgeId);
  adoptMirrorJunctions(changes.junctions);
  for (const edgeRecord of changes.addedEdges) adoptMirrorEdge(edgeRecord);
  linkMirrorJunctionArms(changes.junctions);
  for (const edge of roadGraph.edges.values()) linkMirrorEdgeArms(edge);
  for (const sideHiding of changes.sideHiding) adoptEdgeSideHiding(sideHiding);
  roadGraph.nextId = changes.nextId;
  roadGraph.nextBlock = changes.nextBlock;
}

function describeMirrorEdge(edge) {
  const { ja, jb, armA, armB, nodes, ...edgeFields } = edge;
  return { ...edgeFields, jaId: ja.id, jbId: jb.id, nodes: nodes.map(describeMirrorNode) };
}

function describeMirrorNode(node) {
  const { edge, info, obstacles, ...nodeFields } = node;
  return nodeFields;
}

function describeMirrorJunction(junction) {
  const { arms, entryEdge, obstacles, ...junctionFields } = junction;
  return {
    ...junctionFields,
    entryEdgeId: entryEdge ? entryEdge.id : null,
    arms: arms.map(({ edge, ...armFields }) => ({ ...armFields, edgeId: edge ? edge.id : null }))
  };
}

function describeEdgeSideHiding(edge) {
  const flags = new Uint8Array(edge.nodes.length);
  edge.nodes.forEach((node, nodeIndex) => {
    flags[nodeIndex] = (node.hidesLeftSide ? MIRROR_HIDES_LEFT_SIDE_BIT : 0) | (node.hidesRightSide ? MIRROR_HIDES_RIGHT_SIDE_BIT : 0);
  });
  return { edgeId: edge.id, flags };
}

function adoptMirrorJunctions(junctionRecords) {
  const liveJunctionIds = new Set(junctionRecords.map(record => record.id));
  for (const junctionId of [...roadGraph.junctions.keys()]) {
    if (!liveJunctionIds.has(junctionId)) roadGraph.junctions.delete(junctionId);
  }
  for (const { arms, entryEdgeId, ...junctionFields } of junctionRecords) {
    const junction = roadGraph.junctions.get(junctionFields.id) || { obstacles: [] };
    Object.assign(junction, junctionFields);
    roadGraph.junctions.set(junction.id, junction);
  }
}

function adoptMirrorEdge({ jaId, jbId, nodes, ...edgeFields }) {
  const edge = { ...edgeFields, ja: roadGraph.junctions.get(jaId), jb: roadGraph.junctions.get(jbId), armA: null, armB: null, nodes: [] };
  edge.nodes = nodes.map(nodeFields => ({ ...nodeFields, edge, obstacles: [], info: null }));
  for (const node of edge.nodes) node.info = getManhattanBlockInfo(node.index, edge);
  roadGraph.edges.set(edge.id, edge);
}

function linkMirrorJunctionArms(junctionRecords) {
  for (const record of junctionRecords) {
    const junction = roadGraph.junctions.get(record.id);
    junction.arms = record.arms.map(({ edgeId, ...armFields }) => ({ ...armFields, edge: roadGraph.edges.get(edgeId) || null }));
    junction.entryEdge = roadGraph.edges.get(record.entryEdgeId) || null;
  }
}

function linkMirrorEdgeArms(edge) {
  edge.armA = edge.ja.arms.find(arm => arm.edge === edge && arm.end === "a") || null;
  edge.armB = edge.jb.arms.find(arm => arm.edge === edge && arm.end === "b") || null;
}

function adoptEdgeSideHiding({ edgeId, flags }) {
  const edge = roadGraph.edges.get(edgeId);
  if (!edge) return;
  edge.nodes.forEach((node, nodeIndex) => {
    node.hidesLeftSide = (flags[nodeIndex] & MIRROR_HIDES_LEFT_SIDE_BIT) !== 0;
    node.hidesRightSide = (flags[nodeIndex] & MIRROR_HIDES_RIGHT_SIDE_BIT) !== 0;
  });
}
