import dagre from "@dagrejs/dagre";
import { nodeSize } from "./nodes.jsx";

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
  }
  // React Flow requires parents before their children for native subflows.
  return [...arranged, ...children];
}
