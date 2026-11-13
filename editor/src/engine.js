import { materializeBoard } from "./blueprints.js";
const VERSION = 2;
const levels = [
  {
    id: "intro",
    name: "00 · 多数決を観察",
    inputs: ["A", "B", "C"],
    outputs: ["Y"],
    budget: 1,
    minimum: 1,
    demo: true,
    title: "3つのうち、多いほうが出力になる",
    lesson:
      "パラメトロンは、同じ強さの3つの入力の多数決をとります。入力を押して、0が2つなら0、1が2つなら1になる様子を確かめよう。",
    target: ([a, b, c]) => ({ Y: +(a + b + c >= 2) }),
  },
  {
    id: "and",
    name: "01 · AND / 1素子",
    inputs: ["A", "B"],
    outputs: ["Y"],
    budget: 1,
    minimum: 1,
    reward: "AND",
    title: "1個のパラメトロンでANDを作ろう",
    lesson:
      "AとBが両方1のときだけ、Yを1にします。3つの入力には、A・Bのほかに定数0や1もつなげます。",
    target: ([a, b]) => ({ Y: a & b }),
  },
  {
    id: "or",
    name: "02 · OR / 1素子",
    inputs: ["A", "B"],
    outputs: ["Y"],
    budget: 1,
    minimum: 1,
    reward: "OR",
    title: "1個のパラメトロンでORを作ろう",
    lesson:
      "AとBの少なくとも一方が1なら、Yを1にします。できた回路は、あとでブループリントから複製できます。",
    target: ([a, b]) => ({ Y: a | b }),
  },
  {
    id: "twist",
    name: "03 · 平行とねじり",
    inputs: ["A"],
    outputs: ["Y"],
    budget: 1,
    minimum: 1,
    invert: true,
    tutorial: true,
    lockedWiring: true,
    target: ([a]) => ({ Y: 1 - a }),
  },
  {
    id: "xor",
    name: "04 · XOR / 3素子",
    inputs: ["A", "B"],
    outputs: ["Y"],
    budget: 3,
    minimum: 3,
    reward: "XOR",
    parts: true,
    invert: true,
    editable: true,
    title: "3個のパラメトロンでXORを作ろう",
    lesson:
      "AとBが異なるときだけ、Yを1にします。P1などの出力を次の素子につなぎ、「反転」で0と1を入れ替えられます。",
    target: ([a, b]) => ({ Y: a ^ b }),
  },
  {
    id: "half",
    name: "05 · 半加算器 / 4素子以内",
    inputs: ["A", "B"],
    outputs: ["S", "C"],
    budget: 4,
    minimum: 3,
    parts: true,
    editable: true,
    invert: true,
    title: "作った回路のブループリントで、半加算器に",
    lesson:
      "A+Bの下位ビットをS、繰り上がりをCに出そう。XORとANDのブループリントで、作ったパラメトロン回路を複製できます。内部の配線も直接編集できます。",
    target: ([a, b]) => ({ S: (a + b) % 2, C: +(a + b >= 2) }),
  },
  {
    id: "full",
    name: "06 · 全加算器 / 9素子以内",
    inputs: ["A", "B", "Cin"],
    outputs: ["S", "Cout"],
    budget: 9,
    minimum: 3,
    parts: true,
    editable: true,
    invert: true,
    title: "全加算器を作り、さらに素子を減らそう",
    lesson:
      "A+B+Cinの下位ビットをS、繰り上がりをCoutに出そう。ブループリントから複製した回路でもクリア。配線やパラメトロンを共有して、個数の自己ベストを縮めよう。",
    target: ([a, b, c]) => ({ S: (a + b + c) % 2, Cout: +(a + b + c >= 2) }),
  },
];
const blankEdge = () => ({ source: "", inverted: false });
const clone = (value) => JSON.parse(JSON.stringify(value));
const arity = (type) => (type === "MAJ" ? 3 : 2);
const blankGate = (type = "MAJ") => ({
  type,
  ports: Array.from({ length: arity(type) }, blankEdge),
});
const freshBoard = (level, library = {}) => {
  const types =
    level.id === "xor"
      ? ["MAJ", "MAJ", "MAJ"]
      : level.id === "half"
        ? ["XOR", "AND"]
        : level.id === "full"
          ? ["XOR", "XOR", "AND", "AND", "OR"]
          : ["MAJ"];
  const board = {
    gates: types.map(blankGate),
    outputs: Object.fromEntries(
      level.outputs.map((name) => [name, blankEdge()]),
    ),
    input: 0,
  };
  if (level.demo) {
    board.gates[0].ports = level.inputs.map((source) => ({
      source,
      inverted: false,
    }));
    board.outputs.Y = { source: "P1", inverted: false };
    board.input = 4;
  }
  if (level.id === "and" || level.id === "or") {
    board.gates[0].ports[0] = { source: "A", inverted: false };
    board.gates[0].ports[1] = { source: "B", inverted: false };
    board.outputs.Y = { source: "P1", inverted: false };
  }
  if (level.id === "xor") board.outputs.Y = { source: "P3", inverted: false };
  if (level.id === "twist") {
    board.gates[0].ports = ["A", "0", "1"].map((source) => ({
      source,
      inverted: false,
    }));
    board.outputs.Y = { source: "P1", inverted: false };
  }
  if (level.id === "half") {
    board.outputs.S = { source: "P1", inverted: false };
    board.outputs.C = { source: "P2", inverted: false };
  }
  if (level.id === "full") {
    board.outputs.S = { source: "P2", inverted: false };
    board.outputs.Cout = { source: "P5", inverted: false };
  }
  if (level.parts) {
    if (types.some((type) => type !== "MAJ" && !library[type])) {
      board.gates = [blankGate()];
      board.outputs = Object.fromEntries(
        level.outputs.map((name) => [name, blankEdge()]),
      );
      return board;
    }
    return materializeBoard(board, library);
  }
  return board;
};
const majority = (a, b, c) => +(a + b + c >= 2);
function canConnect(board, source, target) {
  if (!/^P[1-9][0-9]*$/.test(source)) return true;
  const first = Number(source.slice(1)) - 1;
  if (!board.gates[first] || first === target) return false;
  const visited = new Set();
  function dependsOn(index) {
    if (index === target) return true;
    if (visited.has(index)) return false;
    visited.add(index);
    return (
      board.gates[index]?.ports.some(
        (edge) =>
          /^P[1-9][0-9]*$/.test(edge.source) &&
          dependsOn(Number(edge.source.slice(1)) - 1),
      ) || false
    );
  }
  return !dependsOn(first);
}
function readEdge(edge, values) {
  const value = values[edge.source];
  return value === 0 || value === 1
    ? edge.inverted
      ? 1 - value
      : value
    : null;
}
function evaluate(level, board, row, library = {}) {
  // Compatibility with old saves: turn former opaque parts into real
  // parametron netlists before running the majority-only simulator.
  if (board.gates.some((gate) => gate.type !== "MAJ" && library[gate.type]))
    return evaluate(level, materializeBoard(board, library), row, {});
  const values = { 0: 0, 1: 1 };
  level.inputs.forEach((name, i) => {
    values[name] = (row >> (level.inputs.length - 1 - i)) & 1;
  });
  const resolving = new Set();
  function resolve(source) {
    if (values[source] === 0 || values[source] === 1) return values[source];
    if (Object.hasOwn(values, source)) return null;
    if (!/^P[1-9][0-9]*$/.test(source) || resolving.has(source)) return null;
    const gate = board.gates[Number(source.slice(1)) - 1];
    if (!gate) return null;
    resolving.add(source);
    const inputs = gate.ports.map((edge) => {
      const value = resolve(edge.source);
      return value === null ? null : edge.inverted ? 1 - value : value;
    });
    let value = null;
    if (inputs.every((v) => v !== null)) {
      if (gate.type === "MAJ") value = majority(...inputs);
    }
    values[source] = value;
    resolving.delete(source);
    return value;
  }
  board.gates.forEach((_, i) => resolve("P" + (i + 1)));
  return {
    values,
    outputs: Object.fromEntries(
      level.outputs.map((name) => [
        name,
        readEdge(board.outputs[name], values),
      ]),
    ),
  };
}
function usedNodes(board) {
  const used = new Set();
  function visit(source) {
    if (!/^P[1-9][0-9]*$/.test(source) || used.has(source)) return;
    const gate = board.gates[Number(source.slice(1)) - 1];
    if (!gate) return;
    used.add(source);
    gate.ports.forEach((edge) => visit(edge.source));
  }
  Object.values(board.outputs).forEach((edge) => visit(edge.source));
  return used;
}
const partCost = (type, library) =>
  type === "MAJ" ? 1 : library[type] ? usedNodes(library[type]).size : Infinity;
const allocatedCost = (board, library) =>
  board.gates.reduce((sum, gate) => sum + partCost(gate.type, library), 0);
const usedCost = (board, library) =>
  [...usedNodes(board)].reduce(
    (sum, name) =>
      sum + partCost(board.gates[Number(name.slice(1)) - 1].type, library),
    0,
  );
function score(level, board, library) {
  let matched = 0,
    incomplete = false;
  const total = 2 ** level.inputs.length;
  for (let row = 0; row < total; row++) {
    const inputs = level.inputs.map(
      (_, i) => (row >> (level.inputs.length - 1 - i)) & 1,
    );
    const expected = level.target(inputs),
      actual = evaluate(level, board, row, library).outputs;
    if (level.outputs.some((name) => actual[name] === null)) incomplete = true;
    if (level.outputs.every((name) => actual[name] === expected[name]))
      matched++;
  }
  const cost = usedCost(board, library);
  return {
    matched,
    total,
    incomplete,
    cost,
    clear:
      matched === total &&
      cost <= level.budget &&
      allocatedCost(board, library) <= level.budget,
  };
}
function allowedTypes(level, library) {
  return [
    "MAJ",
    ...(level.parts
      ? ["AND", "OR", "XOR"].filter((type) => library[type])
      : []),
  ];
}
function normalizeBoard(level, candidate, library = {}) {
  if (level.demo) {
    const board = freshBoard(level, library);
    if (Number.isInteger(candidate?.input))
      board.input = Math.max(0, Math.min(7, candidate.input));
    return board;
  }
  const fallback = () => {
    const board = freshBoard(level, library);
    if (allocatedCost(board, library) > level.budget)
      board.gates = [blankGate()];
    return board;
  };
  if (
    !candidate ||
    !Array.isArray(candidate.gates) ||
    candidate.gates.length > level.budget
  )
    return fallback();
  candidate = materializeBoard(candidate, library);
  const types = allowedTypes(level, library);
  const normalizeEdge = (value, choices) => ({
    source: choices.includes(value?.source) ? value.source : "",
    inverted: level.invert === true && value?.inverted === true,
    ...(["A", "B"].includes(value?.socket) ? { socket: value.socket } : {}),
    ...(value?.fixed === true && ["0", "1"].includes(value?.source)
      ? { fixed: true }
      : {}),
  });
  const base = ["", "0", "1", ...level.inputs];
  const gates = candidate.gates.map((gate, i) => {
    const type = types.includes(gate?.type) ? gate.type : "MAJ";
    const choices = [
      ...base,
      ...candidate.gates.map((_, n) => "P" + (n + 1)).filter((_, n) => n !== i),
    ];
    return {
      type,
      ports: Array.from({ length: arity(type) }, (_, p) =>
        normalizeEdge(gate?.ports?.[p], choices),
      ),
    };
  });
  const choices = [...base, ...gates.map((_, i) => "P" + (i + 1))];
  gates.forEach((gate, index) =>
    gate.ports.forEach((edge) => {
      if (!canConnect({ gates }, edge.source, index)) edge.source = "";
    }),
  );
  const outputs = Object.fromEntries(
    level.outputs.map((name) => [
      name,
      normalizeEdge(candidate.outputs?.[name], choices),
    ]),
  );
  const board = {
    gates,
    outputs,
    input: Number.isInteger(candidate.input)
      ? Math.max(0, Math.min(2 ** level.inputs.length - 1, candidate.input))
      : 0,
  };
  const assigned = new Set(),
    groupIds = new Set();
  if (Array.isArray(candidate.blueprints)) {
    board.blueprints = candidate.blueprints.flatMap((group) => {
      if (
        !/^bp[1-9][0-9]*$/.test(group?.id) ||
        groupIds.has(group.id) ||
        !["AND", "OR", "XOR"].includes(group.name) ||
        !Array.isArray(group.gates)
      )
        return [];
      const members = [...new Set(group.gates)].filter(
        (index) =>
          Number.isInteger(index) &&
          gates[index]?.type === "MAJ" &&
          !assigned.has(index),
      );
      if (!members.length) return [];
      groupIds.add(group.id);
      members.forEach((index) => assigned.add(index));
      return [
        {
          id: group.id,
          name: group.name,
          gates: members,
          output: normalizeEdge(group.output, choices),
        },
      ];
    });
    if (!board.blueprints.length) delete board.blueprints;
    for (const group of board.blueprints || [])
      for (const index of group.gates)
        for (const edge of gates[index].ports)
          if (["0", "1"].includes(edge.source)) edge.fixed = true;
  }
  if (candidate.layout && typeof candidate.layout === "object") {
    board.layout = {};
    for (const mode of ["wide", "narrow"])
      if (Array.isArray(candidate.layout[mode])) {
        board.layout[mode] = gates.map((_, i) => {
          const point = candidate.layout[mode][i];
          return point && Number.isFinite(point.x) && Number.isFinite(point.y)
            ? {
                x: Math.max(0, Math.min(1, point.x)),
                y: Math.max(0, Math.min(8192, point.y)),
              }
            : null;
        });
      }
  }
  if (candidate.flow && typeof candidate.flow === "object") {
    const ids = new Set([
      ...level.inputs.map((name) => "input:" + name),
      "constants",
      "constant:0",
      "constant:1",
      ...gates.map((_, i) => "gate:" + i),
      ...level.outputs.map((name) => "output:" + name),
      ...(board.blueprints || []).map((group) => "blueprint:" + group.id),
    ]);
    board.flow = {};
    for (const mode of [
      "wide",
      "narrow",
      "symbolWide",
      "symbolNarrow",
      "blueprintWide",
      "blueprintNarrow",
    ])
      if (candidate.flow[mode] && typeof candidate.flow[mode] === "object") {
        board.flow[mode] = Object.fromEntries(
          Object.entries(candidate.flow[mode])
            .filter(
              ([id, point]) =>
                ids.has(id) &&
                Number.isFinite(point?.x) &&
                Number.isFinite(point?.y),
            )
            .map(([id, p]) => [
              id,
              {
                x: Math.max(-100000, Math.min(100000, p.x)),
                y: Math.max(-100000, Math.min(100000, p.y)),
              },
            ]),
        );
        const legacy = board.flow[mode].constants;
        if (legacy) {
          board.flow[mode]["constant:0"] ??= { ...legacy };
          board.flow[mode]["constant:1"] ??= { x: legacy.x, y: legacy.y + 64 };
          delete board.flow[mode].constants;
        }
      }
  }
  return allocatedCost(board, library) <= level.budget ? board : fallback();
}
function removeGate(board, index) {
  const result = clone(board),
    removed = "P" + (index + 1);
  const map = (edge) => {
    if (edge.source === removed) return blankEdge();
    if (
      /^P[1-9][0-9]*$/.test(edge.source) &&
      Number(edge.source.slice(1)) > index + 1
    )
      return { ...edge, source: "P" + (Number(edge.source.slice(1)) - 1) };
    return edge;
  };
  result.gates.splice(index, 1);
  if (result.layout)
    for (const positions of Object.values(result.layout))
      positions.splice(index, 1);
  if (result.flow)
    for (const mode of Object.keys(result.flow))
      result.flow[mode] = Object.fromEntries(
        Object.entries(result.flow[mode])
          .filter(([id]) => id !== "gate:" + index)
          .map(([id, p]) => [
            /^gate:[0-9]+$/.test(id) && Number(id.slice(5)) > index
              ? "gate:" + (Number(id.slice(5)) - 1)
              : id,
            p,
          ]),
      );
  result.gates.forEach((gate) => {
    gate.ports = gate.ports.map(map);
  });
  Object.keys(result.outputs).forEach((name) => {
    result.outputs[name] = map(result.outputs[name]);
  });
  if (result.blueprints) {
    result.blueprints = result.blueprints
      .map((group) => ({
        ...group,
        gates: group.gates
          .filter((i) => i !== index)
          .map((i) => (i > index ? i - 1 : i)),
        output: map(group.output || blankEdge()),
      }))
      .filter((group) => group.gates.length);
    if (!result.blueprints.length) delete result.blueprints;
  }
  return result;
}
function removeBlueprint(board, id) {
  let next = clone(board);
  const group = next.blueprints?.find((item) => item.id === id);
  if (!group) return next;
  for (const index of [...group.gates].sort((a, b) => b - a))
    next = removeGate(next, index);
  delete next.flow;
  return next;
}
function expandGate(board, index, library) {
  const part = library[board.gates[index]?.type];
  if (!part) return clone(board);
  const gates = [],
    mapping = {};
  const mapEdge = (edge, map) => {
    const replacement = map[edge.source] || {
      source: edge.source,
      inverted: false,
    };
    return {
      source: replacement.source,
      inverted: replacement.inverted !== edge.inverted,
    };
  };
  board.gates.forEach((gate, i) => {
    if (i !== index) {
      gates.push({
        type: gate.type,
        ports: gate.ports.map((edge) => mapEdge(edge, mapping)),
      });
      mapping["P" + (i + 1)] = { source: "P" + gates.length, inverted: false };
    } else {
      const innerMap = {
        A: mapEdge(gate.ports[0], mapping),
        B: mapEdge(gate.ports[1], mapping),
      };
      part.gates.forEach((inner, j) => {
        gates.push({
          type: "MAJ",
          ports: inner.ports.map((edge) => mapEdge(edge, innerMap)),
        });
        innerMap["P" + (j + 1)] = {
          source: "P" + gates.length,
          inverted: false,
        };
      });
      mapping["P" + (i + 1)] = mapEdge(part.outputs.Y, innerMap);
    }
  });
  const result = {
    gates,
    outputs: Object.fromEntries(
      Object.entries(board.outputs).map(([name, edge]) => [
        name,
        mapEdge(edge, mapping),
      ]),
    ),
    input: board.input,
  };
  if (board.layout) {
    result.layout = clone(board.layout);
    for (const positions of Object.values(result.layout)) {
      const origin = positions[index];
      positions.splice(
        index,
        1,
        ...part.gates.map((_, i) =>
          origin
            ? { x: origin.x, y: Math.min(8192, origin.y + i * 280) }
            : null,
        ),
      );
    }
  }
  return result;
}
function normalizeGame(candidate) {
  const game = {
    version: VERSION,
    level: 0,
    levelId: "intro",
    introDone: false,
    boards: {},
    library: {},
    bests: {},
  };
  if (candidate?.version !== VERSION) return game;
  game.introDone = candidate.introDone === true;
  for (const level of levels.filter((item) => item.reward)) {
    const part = normalizeBoard(level, candidate.library?.[level.reward], {});
    if (score(level, part, {}).clear) game.library[level.reward] = part;
  }
  for (const level of levels) {
    if (candidate.boards?.[level.id])
      game.boards[level.id] = normalizeBoard(
        level,
        candidate.boards[level.id],
        game.library,
      );
    const best = candidate.bests?.[level.id];
    if (Number.isInteger(best) && best >= level.minimum && best <= level.budget)
      game.bests[level.id] = best;
    if (level.reward && !game.library[level.reward])
      delete game.bests[level.id];
  }
  for (const id of ["and", "or"]) {
    const board = game.boards[id],
      level = levels.find((item) => item.id === id);
    if (!board || score(level, board, game.library).clear) continue;
    if (board.gates.length !== 1 || board.gates[0].type !== "MAJ") {
      const input = board.input;
      game.boards[id] = freshBoard(level);
      game.boards[id].input = input;
    } else {
      board.gates[0].ports[0] = { source: "A", inverted: false };
      board.gates[0].ports[1] = { source: "B", inverted: false };
      board.outputs.Y = { source: "P1", inverted: false };
    }
  }
  // Older saves used numeric chapter positions before the wiring tutorial.
  const legacyOrder = ["intro", "and", "or", "xor", "half", "full"];
  const savedId = candidate.levelId || legacyOrder[candidate.level];
  const savedIndex = levels.findIndex((level) => level.id === savedId);
  if (!candidate.levelId && savedIndex >= 4 && game.bests.or !== undefined)
    game.bests.twist = 1;
  const unlocked = (index) =>
    index === 0 ||
    (index === 1
      ? game.introDone
      : game.bests[levels[index - 1].id] !== undefined);
  if (savedIndex >= 0 && unlocked(savedIndex)) game.level = savedIndex;
  game.levelId = levels[game.level].id;
  return game;
}

export {
  VERSION,
  levels,
  blankEdge,
  blankGate,
  clone,
  arity,
  freshBoard,
  majority,
  readEdge,
  evaluate,
  usedNodes,
  partCost,
  allocatedCost,
  usedCost,
  score,
  allowedTypes,
  normalizeBoard,
  removeGate,
  removeBlueprint,
  expandGate,
  normalizeGame,
  canConnect,
};
