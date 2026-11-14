import React, { useLayoutEffect } from "react";
import { Position, useNodeId, useUpdateNodeInternals } from "@xyflow/react";
import { readEdge } from "./engine.js";
import { isFixedInput } from "./blueprints.js";
import { PairPort as Handle } from "./PairPort.jsx";
import { WiringToggle, WirePair } from "./WiringToggle.jsx";
import { color, opposite, strandColor } from "./signals.js";
export { color } from "./signals.js";

const valueText = (value) => (value === 0 || value === 1 ? String(value) : "?");
const outputLabel = (name) =>
  name === "S" ? "1の位" : name === "C" || name === "Cout" ? "2の位" : "出力";

function usePorts(data) {
  const id = useNodeId(),
    update = useUpdateNodeInternals();
  useLayoutEffect(() => {
    update(id);
  }, [id, data.gate?.ports.length, update]);
}
function Source({ data, name, top, id = "out" }) {
  return (
    <Handle
      type="source"
      position={Position.Right}
      id={id}
      value={data.value}
      className={data.guideSource ? "guide-source" : ""}
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
      className={
        "graph-node signal-node compact-signal" +
        (data.guideTarget ? " guided-signal" : "")
      }
      data-value={data.value}
    >
      <header className="node-title">
        {data.majorityIntro ? "入力" + data.name : data.name}
      </header>
      <button
        className="signal-switch nodrag nopan"
        onClick={data.toggle}
        disabled={data.disabled}
        aria-label={`入力${data.name}を切り替える`}
      >
        <strong style={{ color: color(data.value) }}>{data.value}</strong>
      </button>
      <Source data={data} name={data.name} top={24} />
    </div>
  );
}
function ConstantNode({ data }) {
  usePorts(data);
  return (
    <div
      className="graph-node constant-node"
      aria-label={`固定信号${data.value}`}
    >
      <header className="node-title">
        <span>{data.thirdVote ? "固定0" : "固定信号"}</span>
        <strong style={{ color: color(data.value) }}>{data.value}</strong>
      </header>
      <Source data={data} name={String(data.value)} top="50%" />
    </div>
  );
}
function ParametronSymbol({ value, gate, values, canTwist }) {
  return (
    <svg
      className="gate-symbol symbol-drag"
      viewBox="0 0 170 124"
      aria-hidden="true"
    >
      {gate.ports.map((edge, port) => (
        <g
          className="parametron-lead"
          data-port={port}
          key={port}
          transform={"translate(0 " + (18 + port * 32) + ")"}
        >
          {canTwist(port) && (
            <rect
              className="twist-hit-background"
              x="16"
              y="-2"
              width="48"
              height="28"
              rx="8"
            />
          )}
          <WirePair
            inverted={edge.inverted}
            length={64}
            twistCenter={40}
            value={values[edge.source]}
          />
        </g>
      ))}
      <circle className="aggregation-ring" cx="120" cy="62" r="20" />
      <g className="aggregation-wires">
        {[0, 1, 2].map((port) => (
          <path
            key={port}
            className="collector wire-one"
            style={{
              stroke: color(opposite(readEdge(gate.ports[port], values))),
            }}
            data-rail="1"
            data-input={port}
            d={
              "M64 " +
              (36 + port * 32) +
              "C102 " +
              (36 + port * 32) +
              " 108 68 128 68"
            }
          />
        ))}
        {[0, 1, 2].map((port) => (
          <path
            key={port}
            className="collector-bridge"
            d={
              "M64 " +
              (24 + port * 32) +
              "C88 " +
              (24 + port * 32) +
              " 92 56 112 56"
            }
          />
        ))}
        {[0, 1, 2].map((port) => (
          <path
            key={port}
            className="collector wire-zero"
            style={{
              stroke: color(readEdge(gate.ports[port], values)),
            }}
            data-rail="0"
            data-input={port}
            d={
              "M64 " +
              (24 + port * 32) +
              "C88 " +
              (24 + port * 32) +
              " 92 56 112 56"
            }
          />
        ))}
        <path
          className="symbol-output-lead wire-zero"
          style={{ stroke: strandColor(value, 0) }}
          data-rail="0"
          d="M112 56H170"
        />
        <path
          className="symbol-output-lead wire-one"
          style={{ stroke: strandColor(value, 1) }}
          data-rail="1"
          d="M128 68H170"
        />
        <circle
          className="aggregation-junction pole-zero"
          style={{ fill: strandColor(value, 0) }}
          data-rail="0"
          cx="112"
          cy="56"
          r="3.5"
        />
        <circle
          className="aggregation-junction pole-one"
          style={{ fill: strandColor(value, 1) }}
          data-rail="1"
          cx="128"
          cy="68"
          r="3.5"
        />
      </g>
      <text
        className="symbol-value"
        x="156"
        y="44"
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
  const name = "P" + (data.index + 1);
  const canTwist = (port) =>
    data.invert && (!data.tutorial || port === data.tutorialPort);
  const label = (port) => name + "の入力" + (port + 1) + "を反転";
  return (
    <div className="graph-node compact-gate" data-presentation="symbol">
      <header className="node-title">
        <strong>{data.majorityIntro ? "多数決" : name}</strong>
        <span>パラメトロン</span>
        {data.editable && (
          <button
            className="node-remove nodrag nopan"
            aria-label={name + "を取り外す"}
            title="素子を削除"
            onClick={data.remove}
          >
            ×
          </button>
        )}
      </header>
      <ParametronSymbol
        value={data.value}
        gate={data.gate}
        values={data.values}
        canTwist={canTwist}
      />
      {data.gate.ports.map((edge, port) => {
        const top = 58 + port * 32;
        return (
          <React.Fragment key={port}>
            <Handle
              type="target"
              position={Position.Left}
              id={String(port)}
              value={data.values[edge.source]}
              style={{
                top,
                background: edge.inverted
                  ? "#fff"
                  : color(readEdge(edge, data.values)),
              }}
              className={
                (edge.inverted ? "inverted-port " : "") +
                (data.guidePort === port ? "guide-target" : "")
              }
              isConnectable={!data.demo}
              aria-label={name + "の入力" + (port + 1)}
              data-testid={"target-" + data.index + "-" + port}
            />
            {canTwist(port) ? (
              <>
                <span
                  className="pin-label wire-source-label"
                  style={{ top: top - 26 }}
                >
                  {isFixedInput(edge)
                    ? "固定" + edge.source
                    : edge.source || edge.socket || String(port + 1)}
                </span>
                <WiringToggle
                  className={
                    "pin-invert" + (data.tutorial ? " tutorial-toggle" : "")
                  }
                  style={{ top: top - 14 }}
                  inverted={edge.inverted}
                  hideGlyph
                  label={label(port)}
                  onToggle={() => data.toggle(port)}
                />
              </>
            ) : (
              <span
                className={"pin-label" + (edge.source ? "" : " empty")}
                style={{ top: top - 24 }}
              >
                {edge.inverted ? "¬" : ""}
                {isFixedInput(edge)
                  ? "固定" + edge.source
                  : edge.source ||
                    (data.guideLesson && port === 2 ? "空き入力" : "") ||
                    (edge.socket
                      ? edge.socket + " 未接続"
                      : "入力" + (port + 1))}
              </span>
            )}
          </React.Fragment>
        );
      })}
      <Source data={data} name={name} top={90} />
    </div>
  );
}
function OutputNode({ data }) {
  usePorts(data);
  return (
    <div className="graph-node output-node compact-output">
      <header className="node-title">
        {data.isExample ? "結果" : data.name}
      </header>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        value={data.inputValue}
        style={{ top: 48, left: -44 }}
        isConnectable={!data.demo}
        aria-label={"出力" + data.name + "の入力端子"}
        data-testid={"target-" + data.name}
      />
      <div className="output-reading">
        <strong className="output-value" style={{ color: color(data.value) }}>
          {valueText(data.value)}
        </strong>
        <span>{data.pending ? "未接続" : outputLabel(data.name)}</span>
      </div>
      {!data.isExample && (
        <div className="compact-expected">正解 {data.expected}</div>
      )}
      <svg className="output-wire" viewBox="0 0 44 24" aria-hidden="true">
        {data.invert && (
          <rect
            className="twist-hit-background"
            x="14"
            y="-2"
            width="28"
            height="28"
            rx="8"
          />
        )}
        <WirePair
          inverted={data.inverted}
          length={44}
          twistCenter={28}
          value={data.inputValue}
        />
      </svg>
      {data.invert && (
        <WiringToggle
          className="compact-output-invert"
          inverted={data.inverted}
          hideGlyph
          label={"出力" + data.name + "を反転"}
          onToggle={data.toggle}
        />
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
  if (node.type === "gate") return { width: 170, height: 152 };
  if (node.type === "answer") return { width: 112, height: 94 };
  return { width: 100, height: 48 };
}
export const nodeTypes = {
  signal: SignalNode,
  constant: ConstantNode,
  gate: GateNode,
  blueprint: BlueprintNode,
  answer: OutputNode,
};
