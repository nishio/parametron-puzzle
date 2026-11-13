import React from "react";
import { strandColor } from "./signals.js";

export function WiringGlyph({ inverted, value = 0 }) {
  const first = inverted ? "M3 6C13 6 19 18 29 18" : "M3 6H29";
  const second = inverted ? "M3 18C13 18 19 6 29 6" : "M3 18H29";
  return (
    <svg className="wiring-glyph" viewBox="0 0 32 24" aria-hidden="true">
      <path
        d={second}
        className="wire-one"
        style={{ stroke: strandColor(value, 1) }}
      />
      {inverted && <path d={first} className="wire-bridge" />}
      <path
        d={first}
        className="wire-zero"
        style={{ stroke: strandColor(value, 0) }}
      />
    </svg>
  );
}
// The two conductors stay separate from end to end. Twisting exchanges them.
export function WirePair({
  inverted,
  length,
  value = null,
  twistCenter = length / 2,
}) {
  const a = twistCenter - length * 0.2,
    b = twistCenter + length * 0.2,
    m = twistCenter;
  const strand = (from, to) =>
    "M0 " +
    from +
    "H" +
    a +
    (inverted
      ? "C" + m + " " + from + " " + m + " " + to + " " + b + " " + to
      : "H" + b) +
    "H" +
    length;
  return (
    <g className="wire-pair">
      <path
        className="wire-one"
        data-rail="1"
        d={strand(18, 6)}
        style={{ stroke: strandColor(value, 1) }}
      />
      {inverted && (
        <path
          className="wire-bridge"
          d={"M" + a + " 6C" + m + " 6 " + m + " 18 " + b + " 18"}
        />
      )}
      <path
        className="wire-zero"
        data-rail="0"
        d={strand(6, 18)}
        style={{ stroke: strandColor(value, 0) }}
      />
    </g>
  );
}
export function WiringToggle({
  inverted,
  onToggle,
  label,
  source,
  showState = false,
  className = "",
  style,
  hideGlyph = false,
  value = null,
}) {
  return (
    <button
      type="button"
      role="switch"
      style={style}
      className={`wiring-toggle nodrag nopan ${className}`}
      aria-label={label}
      aria-checked={!!inverted}
      title={`${source ? source + " · " : ""}${inverted ? "ねじり：0と1を交換" : "平行：そのまま"}（押して切替）`}
      onDoubleClick={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {source && <span className="wiring-source">{source}</span>}
      {!hideGlyph && <WiringGlyph inverted={inverted} value={value} />}
      {showState && <span>{inverted ? "ねじり" : "平行"}</span>}
    </button>
  );
}
