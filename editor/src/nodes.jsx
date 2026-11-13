import React, { useLayoutEffect } from "react";
import {
  Handle,
  Position,
  useNodeId,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { readEdge } from "./engine.js";

export const color = (value) =>
  value === 1 ? "#b97713" : value === 0 ? "#276eaf" : "#92a0b0";
const valueText = (value) => (value === 0 || value === 1 ? String(value) : "?");
const outputLabel = (name) =>
  name === "S" ? "1の位" : name === "C" || name === "Cout" ? "2の位" : "出力";

function Wave({ value }) {
  const d = Array.from(
    { length: 121 },
    (_, x) =>
      `${x ? "L" : "M"}${x} ${12 + (value === 1 ? -1 : 1) * 6 * Math.sin((x * Math.PI) / 24)}`,
  ).join(" ");
  return (
    <svg
      className="wave"
      viewBox="0 0 72 24"
      aria-hidden="true"
      style={{ color: color(value) }}
    >
      <line x1="0" y1="12" x2="72" y2="12" />
      {value !== null && (
        <g className="wave-moving">
          <path d={d} />
        </g>
      )}
    </svg>
  );
}
function usePorts(data) {
  const id = useNodeId(),
    update = useUpdateNodeInternals();
  useLayoutEffect(() => {
    update(id);
  }, [id, data.detail, data.gate?.ports.length, update]);
}
function DetailButton({ data, name }) {
  return (
    <button
      className="detail-toggle nodrag nopan"
      aria-label={`${name}の${data.detail ? "詳細を畳む" : "詳細を開く"}`}
      aria-expanded={data.detail}
      onClick={data.onDetail}
    >
      {data.detail ? "畳む −" : "詳細 ＋"}
    </button>
  );
}
function Source({ data, name, top, id = "out" }) {
  return (
    <Handle
      type="source"
      position={Position.Right}
      id={id}
      style={{ top, background: color(data.value) }}
      isConnectable={!data.demo}
      aria-label={`${name}の出力端子`}
      data-testid={`source-${name}`}
    />
  );
}
function SignalNode({ data }) {
  usePorts(data);
  return (
    <div
      className={`graph-node signal-node${data.detail ? "" : " compact-signal"}`}
      data-value={data.value}
    >
      <header className="node-title">
        {data.detail ? "入力 " : ""}
        {data.name}
        {data.detail && <DetailButton data={data} name={data.name} />}
      </header>
      <button
        className="signal-switch nodrag nopan"
        onClick={data.toggle}
        aria-label={`入力${data.name}を切り替える`}
      >
        <strong style={{ color: color(data.value) }}>{data.value}</strong>
        {data.detail && <small>押して0 / 1を切替</small>}
      </button>
      <Wave value={data.value} />
      <Source data={data} name={data.name} top={data.detail ? "50%" : 30} />
    </div>
  );
}
function ConstantsNode({ data }) {
  usePorts(data);
  return (
    <div className="graph-node constants-node compact-constants">
      <header className="node-title">固定信号</header>
      {[0, 1].map((value, i) => (
        <div
          className="constant-row"
          key={value}
          style={{ color: color(value) }}
        >
          <strong>{value}</strong>
          <span>固定</span>
          <Source
            data={{ ...data, value }}
            name={String(value)}
            id={String(value)}
            top={39 + i * 34}
          />
        </div>
      ))}
    </div>
  );
}
function ParametronSymbol({ value }) {
  return (
    <svg
      className="gate-symbol symbol-drag"
      viewBox="0 0 160 96"
      aria-hidden="true"
    >
      <g className="symbol-pins">
        <path d="M0 24H52 M0 48H48 M0 72H52 M122 48H160" />
      </g>
      <g className="symbol-body">
        <circle cx="86" cy="48" r="36" />
      </g>
      <text className="symbol-name" x="84" y="44" textAnchor="middle">
        ≥2
      </text>
      <path
        className="symbol-sine"
        style={{ stroke: color(value) }}
        d={
          value === 1
            ? "M66 60Q72 45 78 60T90 60T102 60"
            : "M66 60Q72 75 78 60T90 60T102 60"
        }
      />
      <circle className="symbol-value-bg" cx="141" cy="48" r="12" />
      <text
        className="symbol-value"
        x="141"
        y="52"
        textAnchor="middle"
        style={{ fill: color(value) }}
      >
        {valueText(value)}
      </text>
    </svg>
  );
}
function GateNode({ data }) {
  usePorts(data);
  const name = `P${data.index + 1}`;
  if (!data.detail)
    return (
      <div className="graph-node compact-gate" data-presentation="symbol">
        <header className="node-title">
          <strong>{name}</strong>
          <span>パラメトロン</span>
          <DetailButton data={data} name={name} />
        </header>
        <ParametronSymbol value={data.value} />
        {data.gate.ports.map((edge, port) => {
          const top = 52 + port * (data.gate.ports.length === 2 ? 48 : 24);
          return (
            <React.Fragment key={port}>
              <Handle
                type="target"
                position={Position.Left}
                id={String(port)}
                style={{
                  top,
                  background: edge.inverted
                    ? "#fff"
                    : color(readEdge(edge, data.values)),
                }}
                className={edge.inverted ? "inverted-port" : ""}
                isConnectable={!data.demo}
                aria-label={`${name}の入力${port + 1}`}
                data-testid={`target-${data.index}-${port}`}
              />
              <span
                className={`pin-label${edge.source ? "" : " empty"}`}
                style={{ top: top - 18 }}
              >
                {edge.inverted ? "¬" : ""}
                {edge.source ||
                  (edge.socket ? edge.socket + " 未接続" : `入力${port + 1}`)}
              </span>
            </React.Fragment>
          );
        })}
        <Source data={data} name={name} top={76} />
      </div>
    );
  return (
    <div className="graph-node gate-node" data-presentation="detail">
      <header className="node-title">
        <strong>{name}</strong>
        <span>パラメトロン · 1個</span>
        <DetailButton data={data} name={name} />
      </header>
      <div className="gate-ports">
        {data.gate.ports.map((edge, port) => (
          <div className="gate-port" key={port}>
            <Handle
              type="target"
              position={Position.Left}
              id={String(port)}
              style={{ top: 66 + port * 46 }}
              isConnectable={!data.demo}
              aria-label={`${name}の入力${port + 1}`}
              data-testid={`target-${data.index}-${port}`}
            />
            <span>
              <small>入力{port + 1}</small>
              <b>
                {edge.source ||
                  (edge.socket ? edge.socket + " 未接続" : "未接続")}
                {edge.inverted ? "（反転）" : ""}
              </b>
            </span>
            <strong style={{ color: color(readEdge(edge, data.values)) }}>
              {valueText(readEdge(edge, data.values))}
            </strong>
            {data.invert && (
              <button
                className={`invert-button nodrag nopan${edge.inverted ? " active" : ""}`}
                aria-pressed={edge.inverted}
                aria-label={`${name}の入力${port + 1}を反転`}
                onClick={() => data.toggle(port)}
              >
                反転
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="gate-result">
        <span>出力</span>
        <strong style={{ color: color(data.value) }}>
          {valueText(data.value)}
        </strong>
        <Wave value={data.value} />
      </div>
      <Source
        data={data}
        name={name}
        top={54 + data.gate.ports.length * 46 + 22}
      />
      {data.editable && (
        <div className="node-actions nodrag nopan">
          <button onClick={data.remove} aria-label={`${name}を取り外す`}>
            取り外す
          </button>
        </div>
      )}
    </div>
  );
}
function OutputNode({ data }) {
  usePorts(data);
  return (
    <div
      className={`graph-node output-node${data.detail ? "" : " compact-output"}`}
    >
      <header className="node-title">
        {data.name}
        <DetailButton data={data} name={data.name} />
      </header>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{ top: data.detail ? "50%" : 48 }}
        isConnectable={!data.demo}
        aria-label={`出力${data.name}の入力端子`}
        data-testid={`target-${data.name}`}
      />
      <div className="output-reading">
        <strong className="output-value" style={{ color: color(data.value) }}>
          {valueText(data.value)}
        </strong>
        <span>{outputLabel(data.name)}</span>
      </div>
      {data.detail ? (
        <>
          <Wave value={data.value} />
          <div className="expected">この入力の正解：{data.expected}</div>
          {data.invert && (
            <button
              className="invert-button nodrag nopan"
              aria-label={`出力${data.name}を反転`}
              aria-pressed={data.inverted}
              onClick={data.toggle}
            >
              反転{data.inverted ? " ON" : ""}
            </button>
          )}
        </>
      ) : (
        <div className="compact-expected">
          正解 {data.expected}
          {data.inverted ? " · 反転" : ""}
        </div>
      )}
    </div>
  );
}
function BlueprintNode({ data }) {
  return (
    <div
      className="blueprint-frame"
      data-presentation="blueprint"
      data-blueprint-name={data.group.name}
    >
      <header className="node-title">
        <strong>{data.group.name}</strong>
        <span>ブループリント</span>
        <button
          className="nodrag nopan"
          aria-label={data.group.id + "の枠を外す"}
          onClick={data.ungroup}
        >
          枠を外す
        </button>
        <button
          className="nodrag nopan"
          aria-label={data.group.id + "の回路を取り外す"}
          onClick={data.remove}
        >
          ×
        </button>
      </header>
      <div className="blueprint-caption">
        {data.group.gates.length} パラメトロン · 保存した回路の複製
      </div>
    </div>
  );
}
export function nodeSize(node) {
  if (node.type === "blueprint")
    return { width: node.data.width || 240, height: node.data.height || 220 };
  if (node.type === "gate")
    return node.data.detail
      ? {
          width: 260,
          height:
            node.data.gate.ports.length * 46 + (node.data.editable ? 150 : 114),
        }
      : { width: 160, height: 124 };
  if (node.type === "constants") return { width: 100, height: 94 };
  if (node.type === "answer")
    return {
      width: node.data.detail ? 150 : 112,
      height: node.data.detail ? (node.data.invert ? 194 : 164) : 94,
    };
  return {
    width: node.data.detail ? 150 : 100,
    height: node.data.detail ? 130 : 70,
  };
}
export const nodeTypes = {
  signal: SignalNode,
  constants: ConstantsNode,
  gate: GateNode,
  blueprint: BlueprintNode,
  answer: OutputNode,
};
