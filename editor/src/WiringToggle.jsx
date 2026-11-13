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
export function WiringToggle({
  inverted,
  onToggle,
  label,
  source,
  showState = false,
  className = "",
  style,
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
      <WiringGlyph inverted={inverted} />
      {showState && <span>{inverted ? "ねじり" : "平行"}</span>}
    </button>
  );
}
