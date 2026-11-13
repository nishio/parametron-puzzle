import React from "react";

export function WiringGlyph({ inverted }) {
  const first = inverted ? "M3 6C13 6 19 18 29 18" : "M3 6H29";
  const second = inverted ? "M3 18C13 18 19 6 29 6" : "M3 18H29";
  return (
    <svg className="wiring-glyph" viewBox="0 0 32 24" aria-hidden="true">
      <path d={first} className="wire-zero" />
      {inverted && <path d={second} className="wire-bridge" />}
      <path d={second} className="wire-one" />
    </svg>
  );
}
// A complete lead: both strands start at the port and end at the body.
// Only the central crossing gets a bridge, so its endpoints stay connected.
export function WirePair({ inverted, length }) {
  const stub = Math.min(8, length * 0.12);
  const lane = Math.min(20, length * 0.25);
  const endLane = length - lane;
  const bendStart = lane + (endLane - lane) * 0.15;
  const bendEnd = endLane - (endLane - lane) * 0.15;
  const middle = length / 2;
  const fork = lane - stub;
  const strand = (y, other) =>
    `M0 12H${stub}C${stub + fork * 0.4} 12 ${stub + fork * 0.6} ${y} ${lane} ${y}H${bendStart}` +
    (inverted
      ? `C${middle} ${y} ${middle} ${other} ${bendEnd} ${other}`
      : `H${bendEnd}`) +
    `H${endLane}C${endLane + fork * 0.4} ${inverted ? other : y} ${endLane + fork * 0.6} 12 ${length - stub} 12H${length}`;
  return (
    <g className="wire-pair">
      <path className="wire-zero" d={strand(6, 18)} />
      {inverted && (
        <path
          className="wire-bridge"
          d={`M${bendStart} 18C${middle} 18 ${middle} 6 ${bendEnd} 6`}
        />
      )}
      <path className="wire-one" d={strand(18, 6)} />
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
      {!hideGlyph && <WiringGlyph inverted={inverted} />}
      {showState && <span>{inverted ? "ねじり" : "平行"}</span>}
    </button>
  );
}
