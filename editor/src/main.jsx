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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./style.css";
import "./workspace.css";
import "./wiring.css";
import "./pairs.css";
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
  removeBlueprint,
  canConnect,
} from "./engine.js";
import { lessons } from "./lessons.js";
import { WiringGlyph, WiringToggle } from "./WiringToggle.jsx";
import { nodeTypes, color } from "./nodes.jsx";
import { autoArrange, preservePlacement } from "./layout.js";
import { edgeTypes } from "./PairEdge.jsx";
import { ClearDialog } from "./ClearDialog.jsx";
import {
  isFixedInput,
  placeBlueprint,
  ungroupBlueprint,
} from "./blueprints.js";

const SAVE_KEY = "parametron-puzzle:v2";
const tutorialCount = levels.findIndex((level) => level.id === "xor");
const chapterLabel = (index) =>
  index < tutorialCount
    ? `チュートリアル ${index + 1} / ${tutorialCount}`
    : `チャレンジ ${index - tutorialCount + 1} / ${levels.length - tutorialCount}`;
const VIEW_PADDING = {
  top: "68px",
  right: "24px",
  bottom: "56px",
  left: "56px",
};
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
      ? { id: "constant:" + source, handle: "out" }
      : { id: "input:" + source, handle: "out" };
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
    [clearDialog, setClearDialog] = useState(null);
  const announcedClears = useRef(new Set(Object.keys(game.bests)));
  const [nodes, setNodes, onNodesChange] = useNodesState([]),
    [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const flow = useReactFlow(),
    initialized = useNodesInitialized(),
    fitNeeded = useRef(true),
    placementSaveNeeded = useRef(false),
    lastStage = useRef(""),
    positionFrame = useRef(null);
  const level = levels[game.level],
    board = game.boards[level.id] || freshBoard(level, game.library),
    result = score(level, board, game.library),
    mode = mobile ? "blueprintNarrow" : "blueprintWide";
  const observed = evaluate(level, board, board.input, game.library),
    info = lessons[level.id];
  function install(next) {
    next.levelId = levels[next.level].id;
    const l = levels[next.level],
      b =
        next.boards[l.id] || (next.boards[l.id] = freshBoard(l, next.library));
    const check = score(l, b, next.library);
    if (!l.demo && check.clear) {
      const newUnlock = !!l.reward && !next.library[l.reward];
      const newMinimum =
        check.cost === l.minimum && (next.bests[l.id] ?? Infinity) > l.minimum;
      next.bests[l.id] = Math.min(next.bests[l.id] ?? Infinity, check.cost);
      if (l.reward && !next.library[l.reward])
        next.library[l.reward] = clone(b);
      if (!announcedClears.current.has(l.id) || newMinimum) {
        announcedClears.current.add(l.id);
        setClearDialog(completionFor(l, next.level, check.cost, newUnlock));
      }
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
  function completionFor(l, index, cost, newUnlock = false) {
    return {
      index,
      name: lessons[l.id].short,
      cost,
      minimum: l.minimum,
      advanced: !l.demo && index >= tutorialCount,
      chapter: chapterLabel(index),
      isLast: index === levels.length - 1,
      reward: l.reward,
      newUnlock,
    };
  }
  function advance() {
    setClearDialog(null);
    const next = clone(gameRef.current);
    if (levels[next.level].demo) next.introDone = true;
    next.level++;
    install(next);
    setPart("MAJ");
    setMessage("");
    setSelectedEdge(null);
  }
  function commit(mutator, text = "", remember = true) {
    const previous = gameRef.current,
      next = clone(previous),
      l = levels[next.level],
      b =
        next.boards[l.id] || (next.boards[l.id] = freshBoard(l, next.library));
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
    c.source?.startsWith("constant:")
      ? c.source.slice(9)
      : c.source?.startsWith("input:")
        ? c.source.slice(6)
        : c.source?.startsWith("gate:")
          ? "P" + (Number(c.source.slice(5)) + 1)
          : "";
  const validConnection = useCallback((c) => {
    const current = gameRef.current,
      l = levels[current.level],
      b = current.boards[l.id] || freshBoard(l, current.library);
    if (l.demo || l.lockedWiring) return false;
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
      delete edge.fixed;
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
      b = game.boards[l.id] || freshBoard(l, game.library),
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
        value: v.values[name],
        demo: l.demo || l.lockedWiring,
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
      for (const value of [0, 1])
        nextNodes.push({
          id: "constant:" + value,
          type: "constant",
          ...base,
          position: { x: 0, y: 0 },
          data: { value, demo: !!l.lockedWiring },
        });
    const groupForGate = new Map();
    for (const group of b.blueprints || []) {
      group.gates.forEach((index) =>
        groupForGate.set(index, "blueprint:" + group.id),
      );
      nextNodes.push({
        id: "blueprint:" + group.id,
        type: "blueprint",
        ...base,
        deletable: true,
        position: { x: 0, y: 0 },
        data: {
          group,
          ungroup: () => {
            commit(
              (board) => ungroupBlueprint(board, group.id),
              "設計図の枠を外しました。パラメトロンと配線は残ります。",
            );
          },
          remove: () => {
            commit(
              (board) => removeBlueprint(board, group.id),
              "ブループリントの回路を取り外しました。",
            );
          },
        },
      });
    }
    b.gates.forEach((gate, index) =>
      nextNodes.push({
        id: "gate:" + index,
        type: "gate",
        ...base,
        deletable: !!l.editable,
        ...(groupForGate.has(index)
          ? { parentId: groupForGate.get(index), extent: "parent" }
          : {}),
        position: { x: 0, y: 0 },
        data: {
          gate,
          index,
          cost: partCost(gate.type, game.library),
          values: v.values,
          value: v.values["P" + (index + 1)],
          demo: l.demo || l.lockedWiring,
          invert: l.invert,
          tutorial: l.tutorial,
          tutorialPort: l.tutorialPort,
          editable: !!l.editable,
          toggle: (port) =>
            commit((board) => {
              board.gates[index].ports[port].inverted =
                !board.gates[index].ports[port].inverted;
            }),
          remove: () => {
            commit((board) => removeGate(board, index));
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
          value: v.outputs[name],
          inputValue: v.values[b.outputs[name].source],
          expected: expected[name],
          demo: l.demo || l.lockedWiring,
          invert: l.invert && !l.tutorial,
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
      if (!edge.source || (target.startsWith("gate:") && isFixedInput(edge)))
        return;
      const source = signalNode(edge.source);
      nextEdges.push({
        id: `${target}:${handle}`,
        source: source.id,
        sourceHandle: source.handle,
        target,
        targetHandle: handle,
        type: "pair",
        pathOptions: { curvature: 0.25 },
        interactionWidth: 24,
        deletable: !l.demo && !l.lockedWiring,
        reconnectable: !l.demo && !l.lockedWiring,
        style: { stroke: color(readEdge(edge, v.values)), strokeWidth: 2.5 },
        label: undefined,
        labelStyle: { fontSize: 12, fill: "#1e324a" },
        labelBgStyle: { fill: "#fff" },
        data: { inverted: edge.inverted, value: v.values[edge.source] },
        ariaLabel: `${edge.source}から${target}へ${edge.inverted ? "反転" : ""}`,
      });
    }
    b.gates.forEach((gate, i) =>
      gate.ports.forEach((edge, p) => add(edge, "gate:" + i, String(p))),
    );
    l.outputs.forEach((name) => add(b.outputs[name], "output:" + name, "in"));
    const arranged = autoArrange(nextNodes, nextEdges);
    const frame = document
      .querySelector(".flow-frame")
      ?.getBoundingClientRect();
    const center = frame
      ? flow.screenToFlowPosition({
          x: frame.left + frame.width / 2,
          y: frame.top + frame.height / 2,
        })
      : { x: 400, y: 250 };
    setNodes((previous) => {
      const existing = new Map(previous.map((node) => [node.id, node]));
      if (changed) fitNeeded.current = true;
      const placed = changed
        ? arranged.map((node) => ({
            ...node,
            position: b.flow?.[mode]?.[node.id] || node.position,
          }))
        : preservePlacement(arranged, previous, center, b.flow?.[mode]);
      return placed.map((node) => ({
        ...node,
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
  }, [game, mode, mobile]);
  useEffect(() => {
    if (initialized && placementSaveNeeded.current) {
      placementSaveNeeded.current = false;
      const positions = Object.fromEntries(
        nodes.map((node) => [node.id, { ...node.position }]),
      );
      commit(
        (b) => {
          b.flow = { ...b.flow, [mode]: positions };
        },
        "",
        false,
      );
    }
  }, [initialized, nodes]);
  useEffect(() => {
    if (initialized && fitNeeded.current) {
      fitNeeded.current = false;
      // Native subflows need their parent and child measurements applied
      // before computing the viewport for a newly stamped circuit.
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          flow.fitView({
            padding: VIEW_PADDING,
            minZoom: 0.2,
            maxZoom: 1,
            duration: 0,
          }),
        ),
      );
    }
  }, [initialized, nodes, flow]);
  useEffect(() => {
    const timer = setTimeout(
      () => flow.fitView({ padding: VIEW_PADDING, maxZoom: 1, duration: 150 }),
      80,
    );
    return () => clearTimeout(timer);
  }, [sideOpen]);
  function arrange() {
    const arranged = autoArrange(flow.getNodes(), flow.getEdges());
    setNodes(arranged);
    fitNeeded.current = true;
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
    setClearDialog(null);
    const next = clone(gameRef.current);
    next.level = index;
    install(next);
    setMessage("");
    setSelectedEdge(null);
    setPart("MAJ");
  }
  function deleteElements({ nodes: deletedNodes, edges: deletedEdges }) {
    if (level.demo || level.lockedWiring) return;
    commit((b) => {
      for (const edge of deletedEdges) {
        const t = destination(edge);
        if (t?.name) b.outputs[t.name] = blankEdge();
        else if (t && b.gates[t.index])
          b.gates[t.index].ports[t.port] = blankEdge();
      }
      let next = b;
      const removed = new Set(
        deletedNodes
          .filter((node) => node.id.startsWith("gate:"))
          .map((node) => Number(node.id.slice(5))),
      );
      deletedNodes
        .filter((node) => node.type === "blueprint")
        .forEach((node) => {
          const group = b.blueprints?.find(
            (group) => "blueprint:" + group.id === node.id,
          );
          group?.gates.forEach((index) => removed.add(index));
        });
      [...removed]
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
    : level.tutorial
      ? result.clear
        ? "ねじると0と1が入れ替わりました。もう一度押すと平行に戻ります。"
        : "P1のBの横にある2本線を押して、A=1・B=0のときだけ1にしよう。"
      : result.clear
        ? "クリア！ すべての入力で正しく動きました。"
        : empty
          ? `P${empty.index + 1}の入力${empty.port + 1}が空いています。出力端子からつないでみよう。`
          : "真理値表の行を選んで、正解と違う場合を確かめよう。";
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
      className={`page${sideOpen ? " sidebar-open" : ""}`}
      data-level={level.id}
    >
      <header className="site-header">
        <a className="brand" href="./">
          <span className="brand-icon" aria-hidden="true">
            ≥2
          </span>
          <span>
            PARAMETRON<small>計算機パズル</small>
          </span>
        </a>
        <div className="lesson-navigation">
          <span>{chapterLabel(game.level)}</span>
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
                      : i > 1 &&
                        game.bests[
                          l.id === "full" ? "half" : levels[i - 1].id
                        ] === undefined
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
            {level.tutorial && (
              <div className="twist-guide">
                <div>
                  <WiringGlyph inverted={false} />
                  <strong>平行</strong>
                  <small>0 → 0 / 1 → 1</small>
                </div>
                <span>⇄</span>
                <div>
                  <WiringGlyph inverted />
                  <strong>ねじり</strong>
                  <small>0 → 1 / 1 → 0</small>
                </div>
              </div>
            )}
            <div className="goal">
              <strong>{info.goal}</strong>
              <span>
                パラメトロン {allocatedCost(board, game.library)} /{" "}
                {level.budget}個
              </span>
            </div>
            <p className="coach" role="status">
              {message && <span>{message} </span>}
              {instruction}
            </p>

            <section
              className="truth-table"
              aria-labelledby="truth-table-title"
            >
              <h2 id="truth-table-title">真理値表</h2>
              <p className="table-help">
                行を選ぶと、その入力を回路に反映します。
              </p>
              <table>
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">選択</span>
                    </th>
                    {level.inputs.map((name) => (
                      <th key={name} scope="col">
                        {name}
                      </th>
                    ))}
                    {level.outputs.map((name) => (
                      <th key={name} scope="col">
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => {
                    const select = () =>
                      commit(
                        (b) => {
                          b.input = item.row;
                        },
                        "",
                        false,
                      );
                    return (
                      <tr
                        key={item.row}
                        data-test-row={item.row}
                        data-selected={item.row === board.input}
                        className={
                          item.pending
                            ? "pending"
                            : item.match
                              ? "correct"
                              : "incorrect"
                        }
                        onClick={select}
                      >
                        <td>
                          <button
                            className="table-input-button"
                            aria-label={
                              "入力を " +
                              level.inputs
                                .map((name, i) => name + " " + item.inputs[i])
                                .join("、") +
                              " にする"
                            }
                            aria-pressed={item.row === board.input}
                            onClick={(event) => {
                              event.stopPropagation();
                              select();
                            }}
                          >
                            {item.row === board.input ? "▶" : "○"}
                          </button>
                        </td>
                        {item.inputs.map((value, i) => (
                          <td key={i}>{value}</td>
                        ))}
                        {level.outputs.map((name) => (
                          <td key={name}>
                            <span className="table-answer">
                              {item.expected[name]}
                            </span>
                            <span
                              className="table-verdict"
                              role="img"
                              aria-label={
                                item.actual[name] === null
                                  ? "未接続"
                                  : item.actual[name] === item.expected[name]
                                    ? "一致"
                                    : "不一致"
                              }
                            >
                              {item.actual[name] === null
                                ? "—"
                                : item.actual[name] === item.expected[name]
                                  ? "✅"
                                  : "❌"}
                            </span>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="table-key">
                出力は正解の値 · ✅ 一致 / ❌ 不一致 / — 未接続
              </p>
            </section>

            <p className="flow-help">
              丸い端子を出力→入力の順に押すか、ドラッグして接続。素子をつかんで移動、背景でスクロール。端子のそばの2本線を押すと、平行とねじりを切り替えます。ねじると0と1が入れ替わります。素子の×、または選択してDeleteで削除できます。ブループリントは保存した回路をまとめて設置する設計図です。
            </p>

            <footer>
              <p>
                {storageOk
                  ? "進捗・配置はこのブラウザに自動保存されます。"
                  : "この環境では保存できません。ページを閉じるまで遊べます。"}
              </p>
              <a href="https://reactflow.dev/">React Flow</a>
              <span>
                計算素子はすべてパラメトロン。設計図の枠・反転・定数・分岐は無料。
              </span>
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
                    announcedClears.current.delete(level.id);
                    fitNeeded.current = true;
                    commit(
                      () => freshBoard(level, gameRef.current.library),
                      "この問題を最初からやり直します。",
                    );
                  }}
                >
                  問題を最初から
                </button>
              </>
            )}
            {!!level.editable && (
              <label>
                置くもの{" "}
                <select
                  aria-label="配置する素子・ブループリント"
                  value={part}
                  onChange={(e) => setPart(e.target.value)}
                >
                  {allowedTypes(level, game.library).map((type) => (
                    <option key={type} value={type}>
                      {type === "MAJ"
                        ? "パラメトロン"
                        : type + "のブループリント"}{" "}
                      · {partCost(type, game.library)}個
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
                    placementSaveNeeded.current = true;
                    commit((b) => {
                      if (!allowedTypes(level, game.library).includes(part))
                        return;
                      if (part !== "MAJ")
                        return placeBlueprint(b, part, gameRef.current.library);
                      b.gates.push(blankGate());
                      delete b.flow;
                    });
                  }}
                >
                  {part === "MAJ" ? "追加" : "設置"}
                </button>
              </label>
            )}
          </div>

          <div className="canvas-area">
            <section className="flow-frame" aria-label="React Flow回路エディタ">
              <ReactFlow
                nodes={nodes.map((node) => ({
                  ...node,
                  zIndex: node.type === "blueprint" ? 1 : 2,
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
                  zIndex: 0,
                }))}
                zIndexMode="manual"
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onGraphNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={connect}
                onReconnect={(edge, c) => connect(c, edge)}
                isValidConnection={validConnection}
                onDelete={deleteElements}
                onEdgeClick={(_, edge) => setSelectedEdge(edge.id)}
                onNodeClick={() => setSelectedEdge(null)}
                onPaneClick={() => setSelectedEdge(null)}
                connectOnClick
                connectionLineType={ConnectionLineType.Bezier}
                snapToGrid
                snapGrid={[16, 16]}
                minZoom={0.2}
                maxZoom={1.8}
                zoomOnScroll={false}
                zoomOnDoubleClick={false}
                panOnDrag
                nodesConnectable={!level.demo && !level.lockedWiring}
                deleteKeyCode={["Backspace", "Delete"]}
              >
                <Background gap={20} size={1} />
                <Controls
                  showInteractive={false}
                  fitViewOptions={{ padding: VIEW_PADDING }}
                />
                {!mobile && !!level.editable && (
                  <MiniMap
                    pannable
                    zoomable
                    nodeColor={(node) =>
                      node.type === "gate" ? "#c3d9ed" : "#e7edf3"
                    }
                  />
                )}
                <Panel position="top-left" className="canvas-key">
                  <WiringGlyph inverted={false} />
                  <span>2本で1信号</span>
                  <span>端子から接続</span>
                </Panel>
                <Panel position="top-right">
                  <button onClick={arrange} disabled={level.demo}>
                    配置を整える
                  </button>
                  <button
                    onClick={() =>
                      flow.fitView({ padding: VIEW_PADDING, duration: 150 })
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
                {level.invert && !level.tutorial && (
                  <WiringToggle
                    label="選択中の配線を反転"
                    inverted={selected.data.inverted}
                    value={selected.data.value}
                    showState
                    onToggle={() =>
                      commit((b) => {
                        const t = destination(selected),
                          edge = t.name
                            ? b.outputs[t.name]
                            : b.gates[t.index].ports[t.port];
                        edge.inverted = !edge.inverted;
                      })
                    }
                  />
                )}
                <button
                  disabled={level.lockedWiring}
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
                  ? `クリア！ 使用${result.cost}個 / 自己ベスト${game.bests[level.id] ?? result.cost}個${result.cost === level.minimum ? " · 理論最小クリア" : ""}`
                  : `${result.total}通り中${result.matched}通りが正解`}
            </p>
            {!level.demo && result.clear && (
              <button
                className="clear-result-button"
                onClick={() =>
                  setClearDialog(completionFor(level, game.level, result.cost))
                }
              >
                クリア結果
              </button>
            )}
            {game.level < levels.length - 1 && (
              <button
                className="primary"
                disabled={!level.demo && !result.clear}
                onClick={advance}
              >
                次へ：{lessons[levels[game.level + 1].id].short} →
              </button>
            )}
          </div>
        </div>
      </main>
      {clearDialog && (
        <ClearDialog
          completion={clearDialog}
          nextName={
            clearDialog.index < levels.length - 1
              ? lessons[levels[clearDialog.index + 1].id].short
              : null
          }
          onClose={() => setClearDialog(null)}
          onNext={advance}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(
  <ReactFlowProvider>
    <App />
  </ReactFlowProvider>,
);
