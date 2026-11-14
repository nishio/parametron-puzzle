import React from "react";
import { Handle } from "@xyflow/react";
import { strandColor } from "./signals.js";
export const POLE_OFFSET = 6;
export const PORT_HALF_WIDTH = 11;
export function PairPort({ style, className = "", value = null, ...props }) {
  return (
    <Handle
      {...props}
      className={`pair-terminal ${className}`}
      style={{
        ...style,
        width: /guide-source|guide-target/.test(className) ? 52 : 22,
        height: /guide-source|guide-target/.test(className) ? 52 : 24,
        border: 0,
        background: "transparent",
      }}
    >
      <svg className="port-poles" viewBox="0 0 22 24" aria-hidden="true">
        <circle
          className="pole-zero"
          cx="11"
          cy="6"
          r="3"
          style={{ fill: strandColor(value, 0) }}
        />
        <circle
          className="pole-one"
          cx="11"
          cy="18"
          r="3"
          style={{ fill: strandColor(value, 1) }}
        />
      </svg>
    </Handle>
  );
}
