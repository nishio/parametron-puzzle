import React from "react";
import { Handle } from "@xyflow/react";
export const POLE_OFFSET = 6;
export const PORT_HALF_WIDTH = 11;
export function PairPort({ style, className = "", ...props }) {
  return (
    <Handle
      {...props}
      className={`pair-terminal ${className}`}
      style={{
        ...style,
        width: 22,
        height: 24,
        border: 0,
        background: "transparent",
      }}
    >
      <svg className="port-poles" viewBox="0 0 22 24" aria-hidden="true">
        <circle className="pole-zero" cx="11" cy="6" r="3" />
        <circle className="pole-one" cx="11" cy="18" r="3" />
      </svg>
    </Handle>
  );
}
