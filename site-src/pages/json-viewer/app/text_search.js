import { isContainerType } from "./json_index.js";

export const SEARCH_SCOPE = Object.freeze({ KEYS_AND_VALUES: "all", KEYS: "keys", VALUES: "values" });

export function mapOffsetsToNodes(document, sortedOffsets, scope) {
  const { nodes } = document;
  const matchedNodes = [];
  let lastMatchedNode = -1;
  for (const offset of sortedOffsets) {
    const nodeIndex = findLastNodeStartingAtOrBefore(nodes, offset);
    if (nodeIndex === -1 || nodeIndex === lastMatchedNode) continue;
    if (!isOffsetInsideSearchedText(nodes, nodeIndex, offset, scope)) continue;
    matchedNodes.push(nodeIndex);
    lastMatchedNode = nodeIndex;
  }
  return Int32Array.from(matchedNodes);
}

function isOffsetInsideSearchedText(nodes, nodeIndex, offset, scope) {
  const isInKey = nodes.keyStarts[nodeIndex] !== -1 && offset >= nodes.keyStarts[nodeIndex] && offset < nodes.keyEnds[nodeIndex];
  if (isInKey) return scope !== SEARCH_SCOPE.VALUES;
  if (scope === SEARCH_SCOPE.KEYS || isContainerType(nodes.types[nodeIndex])) return false;
  return offset >= nodes.valueStarts[nodeIndex] && offset < nodes.valueEnds[nodeIndex];
}

function findLastNodeStartingAtOrBefore(nodes, offset) {
  let low = 0;
  let high = nodes.count - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (tokenStart(nodes, middle) <= offset) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

function tokenStart(nodes, nodeIndex) {
  const keyStart = nodes.keyStarts[nodeIndex];
  return keyStart !== -1 ? keyStart : nodes.valueStarts[nodeIndex];
}
