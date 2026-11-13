import dagre from "@dagrejs/dagre";
import { nodeSize } from "./nodes.jsx";

// Keep the workspace still. Only newly placed root nodes need a free position.
export function preservePlacement(nodes, previous, center, saved = {}) {
  const old = new Map(previous.map((node) => [node.id, node]));
  const placed = new Map();
  const absolute = (node) => {
    const parent = old.get(node.parentId);
    const offset = parent ? absolute(parent) : { x: 0, y: 0 };
    return { x: node.position.x + offset.x, y: node.position.y + offset.y };
  };
  for (const node of nodes) {
    const prior = old.get(node.id);
    if (!prior) {
      if (saved[node.id])
        placed.set(node.id, { ...node, position: saved[node.id] });
      continue;
    }
    let position = saved[node.id];
    if (!position && prior.parentId === node.parentId)
      position = prior.position;
    if (!position) {
      const point = absolute(prior),
        parent = placed.get(node.parentId);
      position = {
        x: point.x - (parent?.position.x || 0),
        y: point.y - (parent?.position.y || 0),
      };
    }
    placed.set(node.id, {
      ...node,
      position,
      ...(node.type === "blueprint"
        ? {
            style: prior.style,
            data: {
              ...node.data,
              width: prior.data.width,
              height: prior.data.height,
            },
          }
        : {}),
    });
  }
  const overlaps = (node, position) => {
    const size = nodeSize(node);
    return [...placed.values()]
      .filter((other) => !other.parentId)
      .some((other) => {
        const otherSize = nodeSize(other),
          p = other.position;
        return (
          position.x < p.x + otherSize.width + 24 &&
          position.x + size.width + 24 > p.x &&
          position.y < p.y + otherSize.height + 24 &&
          position.y + size.height + 24 > p.y
        );
      });
  };
  for (const node of nodes.filter(
    (node) => !node.parentId && !placed.has(node.id),
  )) {
    const size = nodeSize(node),
      origin = { x: center.x - size.width / 2, y: center.y - size.height / 2 };
    let position = origin;
    search: for (let ring = 0; ring < 80; ring++) {
      for (let y = -ring; y <= ring; y++)
        for (let x = -ring; x <= ring; x++) {
          if (Math.max(Math.abs(x), Math.abs(y)) !== ring) continue;
          position = { x: origin.x + x * 48, y: origin.y + y * 48 };
          if (!overlaps(node, position)) break search;
        }
    }
    placed.set(node.id, { ...node, position });
  }
  return nodes.map((node) => placed.get(node.id) || node);
}

function layoutGraph(nodes, edges, marginx = 30, marginy = 30) {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 80, marginx, marginy });
  nodes.forEach((node) => graph.setNode(node.id, nodeSize(node)));
  edges.forEach((edge) => {
    if (
      graph.hasNode(edge.source) &&
      graph.hasNode(edge.target) &&
      edge.source !== edge.target
    )
      graph.setEdge(edge.source, edge.target);
  });
  dagre.layout(graph);
  return {
    graph,
    nodes: nodes.map((node) => {
      const p = graph.node(node.id);
      return {
        ...node,
        position: { x: p.x - p.width / 2, y: p.y - p.height / 2 },
      };
    }),
  };
}
export function autoArrange(nodes, edges) {
  const groups = nodes.filter((node) => node.type === "blueprint");
  const children = [],
    parents = [];
  for (const group of groups) {
    const members = nodes.filter((node) => node.parentId === group.id);
    const inner = layoutGraph(members, edges, 28, 0);
    children.push(
      ...inner.nodes.map((node) => ({
        ...node,
        position: { x: node.position.x, y: node.position.y + 64 },
      })),
    );
    parents.push({
      ...group,
      data: {
        ...group.data,
        width: inner.graph.graph().width,
        height: inner.graph.graph().height + 96,
      },
      style: {
        width: inner.graph.graph().width,
        height: inner.graph.graph().height + 96,
      },
    });
  }
  const owner = Object.fromEntries(
    nodes.map((node) => [node.id, node.parentId || node.id]),
  );
  const outer = [
    ...parents,
    ...nodes.filter((node) => !node.parentId && node.type !== "blueprint"),
  ];
  const outerEdges = edges.map((edge) => ({
    source: owner[edge.source],
    target: owner[edge.target],
  }));
  // Place disconnected parametrons in a useful chain before the first wires.
  const gates = outer.filter(
    (node) => node.type === "gate" || node.type === "blueprint",
  );
  if (
    !outerEdges.some(
      (edge) =>
        edge.source !== edge.target &&
        gates.some((gate) => gate.id === edge.source) &&
        gates.some((gate) => gate.id === edge.target),
    )
  ) {
    const stages =
      gates.length === 5
        ? [
            [0, 1],
            [0, 3],
            [2, 4],
            [3, 4],
          ]
        : gates.length === 3
          ? [
              [0, 2],
              [1, 2],
            ]
          : gates.length === 2
            ? []
            : gates.slice(1).map((_, i) => [i, i + 1]);
    stages.forEach(([a, b]) =>
      outerEdges.push({ source: gates[a].id, target: gates[b].id }),
    );
    if (gates.length)
      outer
        .filter((node) => node.type === "signal")
        .forEach((node) =>
          outerEdges.push({ source: node.id, target: gates[0].id }),
        );
  }
  const arranged = layoutGraph(outer, outerEdges).nodes;
  const inputs = arranged.filter(
    (node) => node.type === "signal" || node.type === "constant",
  );
  if (inputs.length) {
    const top = Math.min(...inputs.map((node) => node.position.y));
    const bottom = Math.max(
      ...inputs.map((node) => node.position.y + nodeSize(node).height),
    );
    const height =
      inputs.reduce((sum, node) => sum + nodeSize(node).height, 0) +
      (inputs.length - 1) * 40;
    const x = Math.min(...inputs.map((node) => node.position.x));
    let y = (top + bottom - height) / 2;
    inputs.forEach((node) => {
      node.position = { x, y };
      y += nodeSize(node).height + 40;
    });
    if (!gates.length) {
      const answers = arranged.filter((node) => node.type === "answer");
      const answerHeight =
        answers.reduce((sum, node) => sum + nodeSize(node).height, 0) +
        Math.max(0, answers.length - 1) * 40;
      let answerY = (top + bottom - answerHeight) / 2;
      answers.forEach((node) => {
        node.position = { x: x + 720, y: answerY };
        answerY += nodeSize(node).height + 40;
      });
    }
  }
  // React Flow requires parents before their children for native subflows.
  return [...arranged, ...children];
}
