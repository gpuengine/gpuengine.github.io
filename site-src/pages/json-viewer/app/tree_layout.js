import { NODE_TYPE, isContainerType, nodePathSegments, findNodeByPath, readRawKey } from "./json_index.js";

const FULLY_EXPANDED_NODE_LIMIT = 200000;
const LARGE_DOCUMENT_EXPANDED_DEPTH = 2;
const COLLAPSE_ALL_EXPANDED_DEPTH = 1;
const UNLIMITED_DEPTH = Number.POSITIVE_INFINITY;
const KEY_PREVIEW_CHARACTERS = 300;
const VALUE_PREVIEW_CHARACTERS = 600;

export const EXPANSION_MODE = Object.freeze({ AUTOMATIC: "automatic", ALL_EXPANDED: "all-expanded", ALL_COLLAPSED: "all-collapsed" });

export function createTreeLayout(document, previousLayout) {
  const layout = {
    expansionMode: previousLayout ? previousLayout.expansionMode : EXPANSION_MODE.AUTOMATIC,
    expandedOverrides: previousLayout ? previousLayout.expandedOverrides : new Map(),
    collapsed: new Uint8Array(document.nodes.count),
    rows: new Int32Array(document.nodes.count * 2),
    rowCount: 0
  };
  applyCollapseState(document, layout);
  rebuildVisibleRows(document, layout);
  return layout;
}

export function toggleNode(document, layout, nodeIndex) {
  if (!isContainerType(document.nodes.types[nodeIndex])) return;
  setNodeExpanded(document, layout, nodeIndex, layout.collapsed[nodeIndex] === 1);
  rebuildVisibleRows(document, layout);
}

export function setExpansionMode(document, layout, expansionMode) {
  layout.expansionMode = expansionMode;
  layout.expandedOverrides = new Map();
  applyCollapseState(document, layout);
  rebuildVisibleRows(document, layout);
}

export function revealNode(document, layout, nodeIndex) {
  const { parents } = document.nodes;
  for (let ancestor = parents[nodeIndex]; ancestor !== -1; ancestor = parents[ancestor]) {
    if (layout.collapsed[ancestor] === 1) setNodeExpanded(document, layout, ancestor, true);
  }
  rebuildVisibleRows(document, layout);
  return layout.rows.subarray(0, layout.rowCount).indexOf(nodeIndex);
}

export function describeRows(document, layout, startRow, rowCount) {
  const endRow = Math.min(layout.rowCount, startRow + rowCount);
  const rows = [];
  for (let rowIndex = Math.max(0, startRow); rowIndex < endRow; rowIndex++) {
    rows.push(describeRow(document, layout, rowIndex));
  }
  return rows;
}

function describeRow(document, layout, rowIndex) {
  const { nodes, text } = document;
  const rowEntry = layout.rows[rowIndex];
  const isClosing = rowEntry < 0;
  const nodeIndex = isClosing ? -rowEntry - 1 : rowEntry;
  const type = nodes.types[nodeIndex];
  const parent = nodes.parents[nodeIndex];
  const hasTrailingComma = parent !== -1 && nodes.positionsInParent[nodeIndex] < nodes.childCounts[parent] - 1;
  const row = { rowIndex, nodeIndex, isClosing, type, depth: nodes.depths[nodeIndex], hasTrailingComma };
  if (isClosing) return row;
  const rawKey = readRawKey(document, nodeIndex);
  row.keyText = rawKey === null ? null : truncate(rawKey, KEY_PREVIEW_CHARACTERS);
  row.isKeyTruncated = rawKey !== null && rawKey.length > KEY_PREVIEW_CHARACTERS;
  row.arrayPosition = parent !== -1 && nodes.types[parent] === NODE_TYPE.ARRAY ? nodes.positionsInParent[nodeIndex] : null;
  if (isContainerType(type)) {
    row.childCount = nodes.childCounts[nodeIndex];
    row.isCollapsed = layout.collapsed[nodeIndex] === 1;
    return row;
  }
  const valueStart = nodes.valueStarts[nodeIndex];
  const valueLength = nodes.valueEnds[nodeIndex] - valueStart;
  row.valueText = text.slice(valueStart, valueStart + Math.min(valueLength, VALUE_PREVIEW_CHARACTERS));
  row.isValueTruncated = valueLength > VALUE_PREVIEW_CHARACTERS;
  return row;
}

function setNodeExpanded(document, layout, nodeIndex, isExpanded) {
  layout.collapsed[nodeIndex] = isExpanded ? 0 : 1;
  const pathKey = JSON.stringify(nodePathSegments(document, nodeIndex));
  if (isExpanded === isExpandedByDefault(document, layout, nodeIndex)) layout.expandedOverrides.delete(pathKey);
  else layout.expandedOverrides.set(pathKey, isExpanded);
}

function applyCollapseState(document, layout) {
  const { types, count } = document.nodes;
  const expandedDepth = defaultExpandedDepth(layout.expansionMode, count);
  const { depths } = document.nodes;
  for (let nodeIndex = 0; nodeIndex < count; nodeIndex++) {
    layout.collapsed[nodeIndex] = isContainerType(types[nodeIndex]) && depths[nodeIndex] >= expandedDepth ? 1 : 0;
  }
  for (const [pathKey, isExpanded] of layout.expandedOverrides) {
    const nodeIndex = findNodeByPath(document, JSON.parse(pathKey));
    if (nodeIndex === -1 || !isContainerType(types[nodeIndex])) {
      layout.expandedOverrides.delete(pathKey);
      continue;
    }
    layout.collapsed[nodeIndex] = isExpanded ? 0 : 1;
  }
}

function isExpandedByDefault(document, layout, nodeIndex) {
  return document.nodes.depths[nodeIndex] < defaultExpandedDepth(layout.expansionMode, document.nodes.count);
}

function defaultExpandedDepth(expansionMode, nodeCount) {
  if (expansionMode === EXPANSION_MODE.ALL_EXPANDED) return UNLIMITED_DEPTH;
  if (expansionMode === EXPANSION_MODE.ALL_COLLAPSED) return COLLAPSE_ALL_EXPANDED_DEPTH;
  return nodeCount <= FULLY_EXPANDED_NODE_LIMIT ? UNLIMITED_DEPTH : LARGE_DOCUMENT_EXPANDED_DEPTH;
}

function rebuildVisibleRows(document, layout) {
  const { types, childCounts, subtreeEnds, count } = document.nodes;
  const { rows, collapsed } = layout;
  const openContainers = [];
  let rowCount = 0;
  let nodeIndex = 0;
  while (nodeIndex < count) {
    while (openContainers.length > 0 && subtreeEnds[openContainers[openContainers.length - 1]] <= nodeIndex) {
      rows[rowCount++] = -openContainers.pop() - 1;
    }
    rows[rowCount++] = nodeIndex;
    const isOpenContainer = isContainerType(types[nodeIndex]) && childCounts[nodeIndex] > 0 && collapsed[nodeIndex] === 0;
    if (isOpenContainer) {
      openContainers.push(nodeIndex);
      nodeIndex++;
    } else {
      nodeIndex = subtreeEnds[nodeIndex];
    }
  }
  while (openContainers.length > 0) rows[rowCount++] = -openContainers.pop() - 1;
  layout.rowCount = rowCount;
}

function truncate(text, maxCharacters) {
  return text.length > maxCharacters ? text.slice(0, maxCharacters) : text;
}
