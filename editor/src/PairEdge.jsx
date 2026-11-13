import React from "react";
import { BaseEdge, getBezierPath } from "@xyflow/react";
import { POLE_OFFSET, PORT_HALF_WIDTH } from "./PairPort.jsx";
import { strandColor } from "./signals.js";

export function PairEdge(props) {
  // React Flow provides handle-edge coordinates. Center them on the two
  // physical poles, then let its normal Bezier router draw both strands.
  const geometry = {
    sourceX: props.sourceX - PORT_HALF_WIDTH,
    sourceY: props.sourceY,
    targetX: props.targetX + PORT_HALF_WIDTH,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  };
  const [center] = getBezierPath(geometry);
  const [upper] = getBezierPath({
    ...geometry,
    sourceY: geometry.sourceY - POLE_OFFSET,
    targetY: geometry.targetY - POLE_OFFSET,
  });
  const [lower] = getBezierPath({
    ...geometry,
    sourceY: geometry.sourceY + POLE_OFFSET,
    targetY: geometry.targetY + POLE_OFFSET,
  });
  return (
    <>
      <BaseEdge
        id={props.id}
        path={center}
        style={{ stroke: "transparent", strokeWidth: 0 }}
        interactionWidth={24}
      />
      <path
        d={upper}
        className="signal-strand wire-zero"
        data-rail="0"
        style={{ stroke: strandColor(props.data?.value, 0) }}
      />
      <path
        d={lower}
        className="signal-strand wire-one"
        data-rail="1"
        style={{ stroke: strandColor(props.data?.value, 1) }}
      />
    </>
  );
}
export const edgeTypes = { pair: PairEdge };
