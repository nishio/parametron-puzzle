import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useNodesInitialized,
  ConnectionLineType,
  MarkerType,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import "@xyflow/react/dist/style.css";
import "./style.css";
import "./workspace.css";
import {
  levels,
  clone,
  freshBoard,
  blankGate,
  blankEdge,
  evaluate,
  readEdge,
  score,
  partCost,
  allocatedCost,
  allowedTypes,
  normalizeGame,
  removeGate,
  expandGate,
  canConnect,
} from "./engine.js";
import { lessons } from "./lessons.js";
import { nodeTypes, nodeSize, color } from "./nodes.jsx";

const SAVE_KEY = "parametron-puzzle:v2";
const readGame = () => {
  try {
    return normalizeGame(JSON.parse(localStorage.getItem(SAVE_KEY)));
  } catch {
    return normalizeGame(null);
  }
};
const valueText = (value) => (value === 0 || value === 1 ? String(value) : "?");
const signalNode = (source) =>
  /^P[1-9][0-9]*$/.test(source)
    ? { id: "gate:" + (Number(source.slice(1)) - 1), handle: "out" }
    : source === "0" || source === "1"
      ? { id: "constants", handle: source }
      : { id: "input:" + source, handle: "out" };
function autoArrange(nodes, edges) {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "LR",
    nodesep: 40,
    ranksep: 100,
    marginx: 30,
    marginy: 30,
  });
  nodes.forEach((node) =>
    graph.setNode(node.id, {
      ...nodeSize(node),
    }),
  );
  edges.forEach((edge) => graph.setEdge(edge.source, edge.target));
  const gates = nodes.filter((node) => node.type === "gate");
  if (
    !edges.some(
      (edge) =>
        edge.source.startsWith("gate:") && edge.target.startsWith("gate:"),
    ) &&
    gates.length > 1
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
          : gates.slice(1).map((_, i) => [i, i + 1]);
    stages.forEach(([a, b]) => graph.setEdge(gates[a].id, gates[b].id));
    nodes
      .filter((node) => node.type === "signal")
      .forEach((node) => graph.setEdge(node.id, gates[0].id));
  }
  dagre.layout(graph);
  const arranged = nodes.map((node) => {
    const p = graph.node(node.id);
    return {
      ...node,
      position: { x: p.x - p.width / 2, y: p.y - p.height / 2 },
    };
  });
  // Dagre has no concept of port order. Keep named inputs in reading order
  // so A/B/C do not cross each other before reaching a single majority gate.
  const inputs = arranged.filter(
    (node) => node.type === "signal" || node.type === "constants",
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
  return arranged;
}
function App() {
  const [game, setGame] = useState(readGame),
    gameRef = useRef(game),
    undo = useRef({});
  const [mobile, setMobile] = useState(innerWidth < 700),
    [message, setMessage] = useState(""),
    [storageOk, setStorageOk] = useState(true),
    [selectedEdge, setSelectedEdge] = useState(null),
    [part, setPart] = useState("MAJ"),
    [sideOpen, setSideOpen] = useState(innerWidth >= 900),
    [detailNode, setDetailNode] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]),
    [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const flow = useReactFlow(),
    initialized = useNodesInitialized(),
    fitNeeded = useRef(true),
    lastStage = useRef(""),
    positionFrame = useRef(null);
  const level = levels[game.level],
    board = game.boards[level.id] || freshBoard(level),
    result = score(level, board, game.library),
    mode = mobile ? "symbolNarrow" : "symbolWide";
  const observed = evaluate(level, board, board.input, game.library),
    info = lessons[level.id];
  function install(next) {
    const l = levels[next.level],
      b = next.boards[l.id] || (next.boards[l.id] = freshBoard(l));
    const check = score(l, b, next.library);
    if (!l.demo && check.clear) {
      next.bests[l.id] = Math.min(next.bests[l.id] ?? Infinity, check.cost);
      if (l.reward && !next.library[l.reward])
        next.library[l.reward] = clone(b);
    }
    gameRef.current = next;
    setGame(next);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(next));
      setStorageOk(true);
    } catch {
      setStorageOk(false);
    }
  }
  function commit(mutator, text = "", remember = true) {
    const previous = gameRef.current,
      next = clone(previous),
      l = levels[next.level],
      b = next.boards[l.id] || (next.boards[l.id] = freshBoard(l));
    if (remember) {
      (undo.current[l.id] || (undo.current[l.id] = [])).push(clone(b));
      if (undo.current[l.id].length > 30) undo.current[l.id].shift();
    }
    const replacement = mutator(b, next);
    if (replacement) next.boards[l.id] = replacement;
    install(next);
    setMessage(text);
  }
  const destination = (connection) => {
    if (connection.target?.startsWith("gate:")) {
      const index = Number(connection.target.slice(5)),
        port = Number(connection.targetHandle);
      return { index, port };
    }
    if (connection.target?.startsWith("output:"))
      return { name: connection.target.slice(7) };
    return null;
  };
  const connectionSource = (c) =>
    c.source === "constants"
      ? c.sourceHandle
      : c.source?.startsWith("input:")
        ? c.source.slice(6)
        : c.source?.startsWith("gate:")
          ? "P" + (Number(c.source.slice(5)) + 1)
          : "";
  const validConnection = useCallback((c) => {
    const current = gameRef.current,
      l = levels[current.level],
      b = current.boards[l.id] || freshBoard(l);
    if (l.demo) return false;
    const target = destination(c),
      source = connectionSource(c);
    if (
      !target ||
      ![
        "0",
        "1",
        ...l.inputs,
        ...b.gates.map((_, i) => "P" + (i + 1)),
      ].includes(source)
    )
      return false;
    return target.name
      ? l.outputs.includes(target.name)
      : !!b.gates[target.index]?.ports[target.port] &&
          canConnect(b, source, target.index);
  }, []);
  function connect(c, oldEdge = null) {
    if (!validConnection(c)) return;
    commit((b) => {
      if (oldEdge) {
        const old = destination(oldEdge);
        if (old?.name) b.outputs[old.name] = blankEdge();
        else if (old) b.gates[old.index].ports[old.port] = blankEdge();
      }
      const target = destination(c),
        edge = target.name
          ? b.outputs[target.name]
          : b.gates[target.index].ports[target.port];
      edge.source = connectionSource(c);
    }, "配線をつなぎました。");
    setSelectedEdge(null);
  }
  const onGraphNodesChange = (changes) => {
    onNodesChange(changes);
    if (
      changes.some(
        (change) => change.type === "position" && change.dragging === false,
      )
    ) {
      if (positionFrame.current !== null)
        cancelAnimationFrame(positionFrame.current);
      const stage = gameRef.current.level;
      positionFrame.current = requestAnimationFrame(() => {
        positionFrame.current = null;
        if (gameRef.current.level === stage) savePositions();
      });
    }
  };
  const savePositions = () => {
    if (detailNode) return;
    const positions = Object.fromEntries(
      flow.getNodes().map((node) => [node.id, { ...node.position }]),
    );
    commit((b) => {
      b.flow = { ...b.flow, [mode]: positions };
    }, "配置を保存しました。");
  };
  useEffect(() => {
    const resize = () => setMobile(innerWidth < 700);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    const l = levels[game.level],
      b = game.boards[l.id] || freshBoard(l),
      v = evaluate(l, b, b.input, game.library),
      expected = l.target(
        l.inputs.map((_, i) => (b.input >> (l.inputs.length - 1 - i)) & 1),
      );
    const stage = l.id + ":" + mode,
      changed = lastStage.current !== stage;
    lastStage.current = stage;
    const base = {
      draggable: !l.demo,
      deletable: false,
      dragHandle: ".node-title, .symbol-drag",
    };
    const nextNodes = l.inputs.map((name, i) => ({
      id: "input:" + name,
      type: "signal",
      ...base,
      position: { x: 0, y: 0 },
      data: {
        name,
        detail: detailNode === "input:" + name,
        onDetail: () => setDetailNode(null),
        value: v.values[name],
        demo: l.demo,
        toggle: () =>
          commit(
            (board) => {
              board.input ^= 1 << (l.inputs.length - 1 - i);
            },
            "",
            false,
          ),
      },
    }));
    if (!l.demo)
      nextNodes.push({
        id: "constants",
        type: "constants",
        ...base,
        position: { x: 0, y: 0 },
        data: { demo: false },
      });
    b.gates.forEach((gate, index) =>
      nextNodes.push({
        id: "gate:" + index,
        type: "gate",
        ...base,
        deletable: game.level >= 3,
        position: { x: 0, y: 0 },
        data: {
          gate,
          index,
          detail: detailNode === "gate:" + index,
          onDetail: () =>
            setDetailNode((current) =>
              current === "gate:" + index ? null : "gate:" + index,
            ),
          cost: partCost(gate.type, game.library),
          values: v.values,
          value: v.values["P" + (index + 1)],
          demo: l.demo,
          invert: l.invert,
          editable: game.level >= 3,
          toggle: (port) =>
            commit((board) => {
              board.gates[index].ports[port].inverted =
                !board.gates[index].ports[port].inverted;
            }),
          remove: () => {
            setDetailNode(null);
            fitNeeded.current = true;
            commit((board) => removeGate(board, index));
          },
          expand: () => {
            setDetailNode(null);
            fitNeeded.current = true;
            commit((board) =>
              expandGate(board, index, gameRef.current.library),
            );
          },
        },
      }),
    );
    l.outputs.forEach((name) =>
      nextNodes.push({
        id: "output:" + name,
        type: "answer",
        ...base,
        position: { x: 0, y: 0 },
        data: {
          name,
          detail: detailNode === "output:" + name,
          onDetail: () =>
            setDetailNode((current) =>
              current === "output:" + name ? null : "output:" + name,
            ),
          value: v.outputs[name],
          expected: expected[name],
          demo: l.demo,
          invert: l.invert,
          inverted: b.outputs[name].inverted,
          toggle: () =>
            commit((board) => {
              board.outputs[name].inverted = !board.outputs[name].inverted;
            }),
        },
      }),
    );
    const nextEdges = [];
    function add(edge, target, handle) {
      if (!edge.source) return;
      const source = signalNode(edge.source);
      nextEdges.push({
        id: `${target}:${handle}`,
        source: source.id,
        sourceHandle: source.handle,
        target,
        targetHandle: handle,
        type: "default",
        pathOptions: { curvature: 0.25 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: color(readEdge(edge, v.values)),
          width: 14,
          height: 14,
        },
        interactionWidth: 24,
        deletable: !l.demo,
        reconnectable: !l.demo,
        style: { stroke: color(readEdge(edge, v.values)), strokeWidth: 2.5 },
        label: undefined,
        labelStyle: { fontSize: 12, fill: "#1e324a" },
        labelBgStyle: { fill: "#fff" },
        data: { inverted: edge.inverted },
        ariaLabel: `${edge.source}から${target}へ${edge.inverted ? "反転" : ""}`,
      });
    }
    b.gates.forEach((gate, i) =>
      gate.ports.forEach((edge, p) => add(edge, "gate:" + i, String(p))),
    );
    l.outputs.forEach((name) => add(b.outputs[name], "output:" + name, "in"));
    const arranged = autoArrange(nextNodes, nextEdges);
    setNodes((previous) => {
      const existing = new Map(previous.map((node) => [node.id, node]));
      const detailChanged = nextNodes.some(
        (node) => !!existing.get(node.id)?.data.detail !== !!node.data.detail,
      );
      const structural =
        changed ||
        detailChanged ||
        previous.length !== nextNodes.length ||
        nextNodes.some(
          (node) =>
            node.type === "gate" &&
            existing.has(node.id) &&
            existing.get(node.id).data.gate.type !== node.data.gate.type,
        );
      if (structural) fitNeeded.current = true;
      return arranged.map((node) => ({
        ...node,
        position:
          (!detailNode && b.flow?.[mode]?.[node.id]) ||
          (!structural && existing.has(node.id)
            ? existing.get(node.id).position
            : node.position),
        selected: !changed && existing.get(node.id)?.selected,
      }));
    });
    setEdges((previous) =>
      nextEdges.map((edge) => ({
        ...edge,
        selected:
          previous.find((item) => item.id === edge.id)?.selected || false,
      })),
    );
  }, [game, mode, mobile, detailNode]);
  useEffect(() => {
    if (initialized && fitNeeded.current) {
      fitNeeded.current = false;
      flow.fitView({
        nodes: detailNode ? [{ id: detailNode }] : undefined,
        padding: 0.12,
        minZoom: detailNode ? 0.85 : 0.2,
        maxZoom: detailNode ? 1.1 : 1,
        duration: 0,
      });
    }
  }, [initialized, nodes, flow, detailNode]);
  useEffect(() => {
    const timer = setTimeout(
      () => flow.fitView({ padding: 0.12, maxZoom: 1, duration: 150 }),
      80,
    );
    return () => clearTimeout(timer);
  }, [sideOpen]);
  function arrange() {
    const arranged = autoArrange(flow.getNodes(), flow.getEdges());
    setNodes(arranged);
    fitNeeded.current = true;
    if (detailNode) return;
    commit((b) => {
      b.flow = {
        ...b.flow,
        [mode]: Object.fromEntries(
          arranged.map((node) => [node.id, node.position]),
        ),
      };
    }, "Dagreで配置を整えました。");
  }
  function changeLevel(index) {
    const next = clone(gameRef.current);
    next.level = index;
    install(next);
    setMessage("");
    setSelectedEdge(null);
    setPart("MAJ");
    setDetailNode(null);
  }
  function deleteElements({ nodes: deletedNodes, edges: deletedEdges }) {
    if (level.demo) return;
    if (deletedNodes.length) setDetailNode(null);
    commit((b) => {
      for (const edge of deletedEdges) {
        const t = destination(edge);
        if (t?.name) b.outputs[t.name] = blankEdge();
        else if (t && b.gates[t.index])
          b.gates[t.index].ports[t.port] = blankEdge();
      }
      let next = b;
      deletedNodes
        .filter((node) => node.id.startsWith("gate:"))
        .map((node) => Number(node.id.slice(5)))
        .sort((a, b) => b - a)
        .forEach((index) => {
          next = removeGate(next, index);
        });
      return next;
    }, "選んだ接続・装置を取り外しました。");
    setSelectedEdge(null);
  }
  const empty = board.gates
    .flatMap((gate, index) =>
      gate.ports.map((edge, port) => ({ edge, index, port })),
    )
    .find((item) => !item.edge.source);
  const instruction = level.demo
    ? "Bのスイッチを押して、多数決の結果を確かめよう。"
    : result.clear
      ? "クリア！ すべての入力で正しく動きました。"
      : empty
        ? `P${empty.index + 1}の入力${empty.port + 1}が空いています。出力端子からつないでみよう。`
        : "下の入力テストで、正解と違う場合を確かめよう。";
  const rows = Array.from({ length: 2 ** level.inputs.length }, (_, row) => {
    const inputs = level.inputs.map(
        (_, i) => (row >> (level.inputs.length - 1 - i)) & 1,
      ),
      expected = level.target(inputs),
      actual = evaluate(level, board, row, game.library).outputs;
    return {
      row,
      inputs,
      expected,
      actual,
      pending: level.outputs.some((name) => actual[name] === null),
      match: level.outputs.every((name) => expected[name] === actual[name]),
    };
  });
  const selected = edges.find((edge) => edge.id === selectedEdge);
  return (
    <div
      className={`page${sideOpen ? " sidebar-open" : ""}${game.motion ? "" : " motion-paused"}`}
      data-level={level.id}
    >
      <header className="site-header">
        <a className="brand" href="./">
          <span className="brand-icon" aria-hidden="true">
            ∿
          </span>
          <span>
            PARAMETRON<small>計算機パズル</small>
          </span>
        </a>
        <div className="lesson-navigation">
          <span>{level.demo ? "はじめに" : `CHAPTER ${game.level} / 5`}</span>
          <label>
            問題{" "}
            <select
              aria-label="問題を選ぶ"
              value={game.level}
              onChange={(e) => changeLevel(Number(e.target.value))}
            >
              {levels.map((l, i) => (
                <option
                  value={i}
                  key={l.id}
                  disabled={
                    i === 1
                      ? !game.introDone
                      : i > 1 && game.bests[levels[i - 1].id] === undefined
                  }
                >
                  {lessons[l.id].short}
                  {game.bests[l.id] !== undefined ? " ✓" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          className="sidebar-toggle"
          aria-expanded={sideOpen}
          aria-controls="lesson-panel"
          onClick={() => setSideOpen((open) => !open)}
        >
          {sideOpen ? "説明を畳む" : "説明とテスト"}
        </button>
      </header>
      <main className="workspace">
        {sideOpen && (
          <aside
            className="lesson-panel"
            id="lesson-panel"
            aria-label="問題の説明とテスト"
          >
            <div className="panel-eyebrow">
              {level.demo ? "START HERE" : "YOUR MISSION"}
            </div>
            <h1>{info.title}</h1>
            <p className="lesson">
              {level.demo
                ? info.lesson
                : level.id === "and" || level.id === "or"
                  ? "A・Bと出力は接続済みです。固定0か固定1の右の丸から、P1の空いている入力3の左の丸へつなごう。"
                  : info.lesson.replace("入力をつなごう。", "入力をつなごう。")}
            </p>
            <div className="goal">
              <strong>{info.goal}</strong>
              <span>
                装置 {allocatedCost(board, game.library)} / {level.budget}個
              </span>
            </div>
            <p className="coach" role="status">
              {message && <span>{message} </span>}
              {instruction}
            </p>

            <p className="flow-help">
              丸い端子を出力→入力の順に押すか、ドラッグして接続。素子をつかんで移動、背景でスクロール。「詳細」で反転・部品の中を編集できます。
            </p>
            {!level.demo && (
              <>
                <h2 className="section-title">入力を変えて確かめる</h2>
                <div className="test-cases">
                  {rows.map((item) => (
                    <button
                      key={item.row}
                      data-test-row={item.row}
                      aria-pressed={item.row === board.input}
                      className={
                        item.pending
                          ? "pending"
                          : item.match
                            ? "correct"
                            : "incorrect"
                      }
                      onClick={() =>
                        commit(
                          (b) => {
                            b.input = item.row;
                          },
                          "",
                          false,
                        )
                      }
                    >
                      <span>
                        {level.inputs
                          .map((name, i) => name + " " + item.inputs[i])
                          .join(" · ")}
                      </span>
                      <small>
                        {item.pending
                          ? "未接続"
                          : item.match
                            ? "✓ 正解"
                            : "× ちがう"}
                      </small>
                    </button>
                  ))}
                </div>
                <details className="truth-table">
                  <summary>真理値表を見る</summary>
                  <table>
                    <thead>
                      <tr>
                        {level.inputs.map((name) => (
                          <th key={name}>{name}</th>
                        ))}
                        {level.outputs.map((name) => (
                          <th key={name}>{name} 正解 / 現在</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((item) => (
                        <tr key={item.row}>
                          {item.inputs.map((value, i) => (
                            <td key={i}>{value}</td>
                          ))}
                          {level.outputs.map((name) => (
                            <td key={name}>
                              {item.expected[name]} /{" "}
                              {valueText(item.actual[name])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </>
            )}

            <footer>
              <button
                onClick={() => {
                  const next = clone(gameRef.current);
                  next.motion = !next.motion;
                  install(next);
                }}
              >
                {game.motion ? "振動を止める" : "振動を動かす"}
              </button>
              <p>
                {storageOk
                  ? "進捗・配置はこのブラウザに自動保存されます。"
                  : "この環境では保存できません。ページを閉じるまで遊べます。"}
              </p>
              <a href="https://reactflow.dev/">React Flow</a>
              <span>波形は模式表示。反転・定数・分岐は無料。</span>
            </footer>
          </aside>
        )}
        <div className="canvas-column">
          <div className="toolbar">
            {!level.demo && (
              <>
                <button
                  disabled={!undo.current[level.id]?.length}
                  onClick={() => {
                    const previous = undo.current[level.id]?.pop();
                    if (previous) {
                      setDetailNode(null);
                      const next = clone(gameRef.current);
                      next.boards[level.id] = previous;
                      install(next);
                      setMessage("ひとつ戻しました。");
                    }
                  }}
                >
                  ひとつ戻す
                </button>
                <button
                  onClick={() => {
                    setDetailNode(null);
                    fitNeeded.current = true;
                    commit(
                      () => freshBoard(level),
                      "この問題を最初からやり直します。",
                    );
                  }}
                >
                  問題を最初から
                </button>
              </>
            )}
            {game.level >= 3 && (
              <label>
                部品{" "}
                <select
                  aria-label="追加する部品"
                  value={part}
                  onChange={(e) => setPart(e.target.value)}
                >
                  {allowedTypes(level, game.library).map((type) => (
                    <option key={type} value={type}>
                      {type === "MAJ" ? "多数決" : type} ·{" "}
                      {partCost(type, game.library)}個分
                    </option>
                  ))}
                </select>
                <button
                  disabled={
                    allocatedCost(board, game.library) +
                      partCost(part, game.library) >
                    level.budget
                  }
                  onClick={() => {
                    setDetailNode(null);
                    fitNeeded.current = true;
                    commit((b) => {
                      if (!allowedTypes(level, game.library).includes(part))
                        return;
                      b.gates.push(blankGate(part));
                      delete b.flow;
                    });
                  }}
                >
                  追加
                </button>
              </label>
            )}
          </div>

          <div className="canvas-area">
            <section className="flow-frame" aria-label="React Flow回路エディタ">
              <ReactFlow
                nodes={nodes.map((node) => ({
                  ...node,
                  className:
                    selected &&
                    [selected.source, selected.target].includes(node.id)
                      ? "wire-endpoint"
                      : undefined,
                }))}
                edges={edges.map((edge) => ({
                  ...edge,
                  className: selected
                    ? edge.id === selected.id
                      ? "wire-active"
                      : "wire-muted"
                    : undefined,
                  zIndex: edge.id === selectedEdge ? 10 : 0,
                }))}
                nodeTypes={nodeTypes}
                onNodesChange={onGraphNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={connect}
                onReconnect={(edge, c) => connect(c, edge)}
                isValidConnection={validConnection}
                onDelete={deleteElements}
                onEdgeClick={(_, edge) => setSelectedEdge(edge.id)}
                onNodeClick={() => setSelectedEdge(null)}
                onPaneClick={() => setSelectedEdge(null)}
                onNodeDoubleClick={(_, node) => {
                  if (node.type === "gate" || node.type === "answer")
                    setDetailNode((current) =>
                      current === node.id ? null : node.id,
                    );
                }}
                connectOnClick
                connectionLineType={ConnectionLineType.Bezier}
                snapToGrid
                snapGrid={[16, 16]}
                minZoom={0.2}
                maxZoom={1.8}
                zoomOnScroll={false}
                zoomOnDoubleClick={false}
                panOnDrag
                nodesConnectable={!level.demo}
                deleteKeyCode={["Backspace", "Delete"]}
              >
                <Background gap={20} size={1} />
                <Controls showInteractive={false} />
                {!mobile && game.level >= 3 && (
                  <MiniMap
                    pannable
                    zoomable
                    nodeColor={(node) =>
                      node.type === "gate" ? "#c3d9ed" : "#e7edf3"
                    }
                  />
                )}
                <Panel position="top-left" className="canvas-key">
                  <span>
                    <i className="zero" />0
                  </span>
                  <span>
                    <i className="one" />1
                  </span>
                  <span>○ 端子から接続</span>
                </Panel>
                <Panel position="top-right">
                  {detailNode && (
                    <button onClick={() => setDetailNode(null)}>
                      すべて畳む
                    </button>
                  )}
                  <button onClick={arrange} disabled={level.demo}>
                    配置を整える
                  </button>
                  <button
                    onClick={() =>
                      flow.fitView({ padding: 0.1, duration: 150 })
                    }
                  >
                    全体を見る
                  </button>
                </Panel>
              </ReactFlow>
            </section>

            {selected && (
              <div className="edge-inspector">
                <strong>選択中の配線</strong>
                <button
                  className="inspector-close"
                  aria-label="配線の選択を解除"
                  onClick={() => setSelectedEdge(null)}
                >
                  ×
                </button>
                <span>
                  {connectionSource(selected)} →{" "}
                  {selected.target.startsWith("gate:")
                    ? "P" +
                      (Number(selected.target.slice(5)) + 1) +
                      " 入力" +
                      (Number(selected.targetHandle) + 1)
                    : selected.target.slice(7)}
                </span>
                {level.invert && (
                  <button
                    onClick={() =>
                      commit((b) => {
                        const t = destination(selected),
                          edge = t.name
                            ? b.outputs[t.name]
                            : b.gates[t.index].ports[t.port];
                        edge.inverted = !edge.inverted;
                      })
                    }
                  >
                    0 / 1を反転
                  </button>
                )}
                <button
                  onClick={() => flow.deleteElements({ edges: [selected] })}
                >
                  配線を外す
                </button>
              </div>
            )}
          </div>
          <div className="canvas-hint" role="status">
            {message || instruction}
          </div>
          <div className="completion">
            <p data-testid="status">
              {level.demo
                ? `1が${level.inputs.reduce((sum, name) => sum + observed.values[name], 0)}票 → 出力${observed.outputs.Y}`
                : result.clear
                  ? `クリア！ 使用${result.cost}個 / 自己ベスト${game.bests[level.id] ?? result.cost}個${result.cost === level.minimum ? " · 最少達成" : ""}`
                  : `${result.total}通り中${result.matched}通りが正解`}
            </p>
            {game.level < levels.length - 1 && (
              <button
                className="primary"
                disabled={!level.demo && !result.clear}
                onClick={() => {
                  const next = clone(gameRef.current);
                  if (level.demo) next.introDone = true;
                  next.level++;
                  install(next);
                  setPart("MAJ");
                  setDetailNode(null);
                  setMessage("");
                  setSelectedEdge(null);
                }}
              >
                次へ：{lessons[levels[game.level + 1].id].short} →
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(
  <ReactFlowProvider>
    <App />
  </ReactFlowProvider>,
);
