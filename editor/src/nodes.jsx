import React, { useLayoutEffect } from "react";
import {
  Handle,
  Position,
  useNodeId,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { readEdge } from "./engine.js";
import { WiringToggle, WirePair } from "./WiringToggle.jsx";

export const color = (value) =>
  value === 1 ? "#b97713" : value === 0 ? "#276eaf" : "#92a0b0";
const valueText = (value) => (value === 0 || value === 1 ? String(value) : "?");
const outputLabel = (name) =>
  name === "S" ? "1の位" : name === "C" || name === "Cout" ? "2の位" : "出力";

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
      <Source data={data} name={data.name} top={data.detail ? "50%" : 24} />
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
        <span>固定信号</span>
        <strong style={{ color: color(data.value) }}>{data.value}</strong>
      </header>
      <Source data={data} name={String(data.value)} top="50%" />
    </div>
  );
}
function ParametronSymbol({ value, gate, canTwist }) {
  return (
    <svg
      className="gate-symbol symbol-drag"
      viewBox="0 0 190 124"
      aria-hidden="true"
    >
      <g className="symbol-pins">
        {gate.ports.map((edge, port) => {
          const y = 30 + port * 32;
          const end = 120 - Math.sqrt(36 * 36 - (y - 62) * (y - 62));
          return (
            <g
              className="parametron-lead"
              data-port={port}
              key={port}
              transform={`translate(0 ${y - 12})`}
            >
              {canTwist(port) ? (
                <WirePair inverted={edge.inverted} length={end} />
              ) : (
                <path className="single-lead" d={`M0 12H${end}`} />
              )}
            </g>
          );
        })}
        <path className="symbol-output-lead" d="M156 62H190" />
      </g>
      <g className="symbol-body">
        <circle cx="120" cy="62" r="36" />
      </g>
      <text
        className="symbol-value"
        x="173"
        y="48"
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
  const canTwist = (port) => data.invert && (!data.tutorial || port === 0);
  const label = (port) => name + "の入力" + (port + 1) + "を反転";
  if (!data.detail)
    return (
      <div className="graph-node compact-gate" data-presentation="symbol">
        <header className="node-title">
          <strong>{name}</strong>
          <span>パラメトロン</span>
          <DetailButton data={data} name={name} />
        </header>
        <ParametronSymbol
          value={data.value}
          gate={data.gate}
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
                style={{
                  top,
                  background: edge.inverted
                    ? "#fff"
                    : color(readEdge(edge, data.values)),
                }}
                className={edge.inverted ? "inverted-port" : ""}
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
                    {edge.source || edge.socket || String(port + 1)}
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
                  {edge.source ||
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
              aria-label={name + "の入力" + (port + 1)}
              data-testid={"target-" + data.index + "-" + port}
            />
            <span>
              <small>入力{port + 1}</small>
              <b>
                {edge.source ||
                  (edge.socket ? edge.socket + " 未接続" : "未接続")}
                {edge.inverted ? "（ねじり）" : ""}
              </b>
            </span>
            <strong style={{ color: color(readEdge(edge, data.values)) }}>
              {valueText(readEdge(edge, data.values))}
            </strong>
            {canTwist(port) && (
              <WiringToggle
                inverted={edge.inverted}
                label={label(port)}
                onToggle={() => data.toggle(port)}
                showState
              />
            )}
          </div>
        ))}
      </div>
      <div className="gate-result">
        <span>出力</span>
        <strong style={{ color: color(data.value) }}>
          {valueText(data.value)}
        </strong>
      </div>
      <Source
        data={data}
        name={name}
        top={54 + data.gate.ports.length * 46 + 22}
      />
      {data.editable && (
        <div className="node-actions nodrag nopan">
          <button onClick={data.remove} aria-label={name + "を取り外す"}>
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
        style={{
          top: data.detail ? "50%" : 48,
          left: data.detail ? undefined : -44,
        }}
        className={data.inverted ? "inverted-port" : ""}
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
          <div className="expected">この入力の正解：{data.expected}</div>
          {data.invert && (
            <WiringToggle
              inverted={data.inverted}
              label={"出力" + data.name + "を反転"}
              onToggle={data.toggle}
              showState
            />
          )}
        </>
      ) : (
        <>
          <div className="compact-expected">正解 {data.expected}</div>
          {data.invert && (
            <svg className="output-wire" viewBox="0 0 44 24" aria-hidden="true">
              <WirePair inverted={data.inverted} length={44} />
            </svg>
          )}
          {!data.invert && (
            <svg className="output-wire" viewBox="0 0 44 24" aria-hidden="true">
              <path className="single-lead" d="M0 12H44" />
            </svg>
          )}
          {data.invert && (
            <WiringToggle
              className="compact-output-invert"
              inverted={data.inverted}
              hideGlyph
              label={"出力" + data.name + "を反転"}
              onToggle={data.toggle}
            />
          )}
        </>
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
      : { width: 190, height: 152 };
  if (node.type === "constant") return { width: 100, height: 48 };
  if (node.type === "answer")
    return {
      width: node.data.detail ? 150 : 112,
      height: node.data.detail ? (node.data.invert ? 170 : 140) : 94,
    };
  return {
    width: node.data.detail ? 150 : 100,
    height: node.data.detail ? 94 : 48,
  };
}
export const nodeTypes = {
  signal: SignalNode,
  constant: ConstantNode,
  gate: GateNode,
  blueprint: BlueprintNode,
  answer: OutputNode,
};
