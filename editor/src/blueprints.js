// Blueprint placement copies a saved netlist. The resulting computational
// nodes are exclusively MAJ parametrons; a frame is only layout metadata.
const copy = (value) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const empty = () => ({ source: "", inverted: false });
export const isFixedInput = (edge) =>
  edge?.fixed === true && ["0", "1"].includes(edge.source);
function liveIndices(board) {
  const used = new Set();
  function visit(source) {
    if (!/^P[1-9][0-9]*$/.test(source)) return;
    const index = Number(source.slice(1)) - 1;
    if (used.has(index) || !board.gates[index]) return;
    used.add(index);
    board.gates[index].ports.forEach((edge) => visit(edge.source));
  }
  Object.values(board.outputs).forEach((edge) => visit(edge.source));
  return [...used].sort((a, b) => a - b);
}
const substitute = (edge, replacement) => ({
  ...edge,
  source: replacement.source,
  inverted: !!replacement.inverted !== !!edge.inverted,
});
export function materializeBoard(board, library = {}) {
  if (
    !board?.gates?.some((gate) => gate?.type !== "MAJ" && library[gate?.type])
  )
    return copy(board);
  const next = { ...copy(board), gates: [], blueprints: [] },
    mapping = {},
    plans = [];
  const oldGroups = Array.isArray(board.blueprints)
    ? board.blueprints.filter((group) => group && Array.isArray(group.gates))
    : [];
  const reserved = new Set(oldGroups.map((group) => group.id));
  function newId() {
    let n = 1;
    while (reserved.has("bp" + n)) n++;
    const id = "bp" + n;
    reserved.add(id);
    return id;
  }
  board.gates.forEach((raw, index) => {
    const gate = {
      type: raw?.type || "MAJ",
      ports: Array.from(
        { length: raw?.type === "MAJ" ? 3 : 2 },
        (_, i) => raw?.ports?.[i] || empty(),
      ),
    };
    const template = gate.type !== "MAJ" && library[gate.type];
    if (!template) {
      const at = next.gates.length;
      next.gates.push(null);
      mapping["P" + (index + 1)] = { source: "P" + (at + 1), inverted: false };
      plans.push({ gate, at });
      return;
    }
    const members = liveIndices(template),
      innerMap = {};
    const group = { id: newId(), name: gate.type, gates: [] };
    members.forEach((i) => {
      group.gates.push(next.gates.length);
      innerMap["P" + (i + 1)] = {
        source: "P" + (next.gates.length + 1),
        inverted: false,
      };
      next.gates.push(null);
    });
    const output = template.outputs.Y;
    mapping["P" + (index + 1)] = substitute(
      output,
      innerMap[output.source] ||
        gate.ports[output.source === "B" ? 1 : 0] ||
        output,
    );
    group.output = copy(mapping["P" + (index + 1)]);
    next.blueprints.push(group);
    plans.push({ gate, template, members, innerMap, group });
  });
  const globalEdge = (edge) =>
    substitute(
      edge,
      mapping[edge.source] || { source: edge.source, inverted: false },
    );
  plans.forEach((plan) => {
    if (!plan.template) {
      next.gates[plan.at] = {
        ...copy(plan.gate),
        ports: plan.gate.ports.map(globalEdge),
      };
      return;
    }
    plan.members.forEach((oldIndex, offset) => {
      next.gates[plan.group.gates[offset]] = {
        type: "MAJ",
        ports: plan.template.gates[oldIndex].ports.map((edge) => {
          if (edge.source === "A" || edge.source === "B") {
            const binding = globalEdge(
              plan.gate.ports[edge.source === "A" ? 0 : 1] || empty(),
            );
            return { ...substitute(edge, binding), socket: edge.source };
          }
          return substitute(
            ["0", "1"].includes(edge.source) ? { ...edge, fixed: true } : edge,
            plan.innerMap[edge.source] || {
              source: edge.source,
              inverted: false,
            },
          );
        }),
      };
    });
  });
  next.outputs = Object.fromEntries(
    Object.entries(board.outputs || {}).map(([name, edge]) => [
      name,
      globalEdge(edge || empty()),
    ]),
  );
  for (const old of oldGroups) {
    if (!Array.isArray(old?.gates)) continue;
    const gates = old.gates.flatMap((index) => {
      const plan = plans[index];
      return plan?.template ? plan.group.gates : plan ? [plan.at] : [];
    });
    if (gates.length)
      next.blueprints.push({
        ...old,
        gates,
        output: globalEdge(old.output || empty()),
      });
  }
  delete next.flow;
  delete next.layout;
  return next;
}
export function placeBlueprint(board, name, library) {
  if (!library[name]) return copy(board);
  const candidate = copy(board);
  candidate.gates.push({ type: name, ports: [empty(), empty()] });
  return materializeBoard(candidate, library);
}
export function ungroupBlueprint(board, id) {
  const next = copy(board);
  next.blueprints = (next.blueprints || []).filter((group) => group.id !== id);
  if (!next.blueprints.length) delete next.blueprints;
  delete next.flow;
  return next;
}
