import type { PackedBox, Truck } from '../types'

const SCALE = 100 // SVG units per meter
const PAD = 36

/** A flat drawing of the loading plan that prints sharply: `top` looks down on the floor,
 * `side` looks at the left wall. Numbers match the manifest sequence. */
export function PlanDiagram({ truck, boxes, view }: { truck: Truck; boxes: PackedBox[]; view: 'top' | 'side' }) {
  const depth = view === 'top' ? truck.width : truck.height
  const sequence = new Map(boxes.map((box, index) => [box.id, index + 1]))
  // Draw the units nearest the viewer last so they cover the ones behind them.
  const ordered = [...boxes].sort((a, b) => view === 'top'
    ? a.position.y + a.dimensions[2] / 2 - (b.position.y + b.dimensions[2] / 2)
    : b.position.z - a.position.z)
  const axles = view === 'side' ? truck.axles : undefined
  const minX = Math.min(0, (axles?.front ?? 0) - 0.4), maxX = Math.max(truck.length, (axles?.rear ?? 0) + 0.4)
  const wheel = 0.28
  const bottom = depth * SCALE + (axles ? wheel * 2 * SCALE : 0) + PAD

  return <svg className="plan-diagram" role="img" aria-label={view === 'top' ? 'Top view of the loading plan' : 'Side view of the loading plan'}
    viewBox={`${minX * SCALE - PAD} ${-PAD} ${(maxX - minX) * SCALE + PAD * 2} ${bottom + PAD}`}>
    <rect x={0} y={0} width={truck.length * SCALE} height={depth * SCALE} fill="#f7f9fc" stroke="#899dbb" strokeWidth={2}/>
    {ordered.map(box => {
      const [length, width, height] = box.dimensions
      const boxDepth = view === 'top' ? width : height
      const x = (box.position.x - length / 2) * SCALE
      const y = view === 'top' ? (box.position.z - width / 2) * SCALE : (truck.height - box.position.y - height / 2) * SCALE
      const labelSize = Math.min(20, length * SCALE * 0.45, boxDepth * SCALE * 0.6)
      return <g key={box.id}>
        <rect x={x} y={y} width={length * SCALE} height={boxDepth * SCALE} fill={box.color} stroke="#ffffff" strokeWidth={1.5}/>
        {labelSize >= 9 && <text x={x + length * SCALE / 2} y={y + boxDepth * SCALE / 2} fontSize={labelSize} fill="#ffffff" fontWeight={700} textAnchor="middle" dominantBaseline="central">{sequence.get(box.id)}</text>}
      </g>
    })}
    {axles && [axles.front, axles.rear].map((position, index) => <g key={index}>
      <circle cx={position * SCALE} cy={(depth + wheel) * SCALE} r={wheel * SCALE} fill="#ffffff" stroke="#596a86" strokeWidth={4}/>
      <text x={position * SCALE} y={(depth + wheel) * SCALE} fontSize={15} fill="#596a86" fontWeight={700} textAnchor="middle" dominantBaseline="central">{index ? 'R' : 'F'}</text>
    </g>)}
    <text x={0} y={-12} fontSize={17} fill="#78849a" fontWeight={600}>FRONT</text>
    <text x={truck.length * SCALE} y={-12} fontSize={17} fill="#78849a" fontWeight={600} textAnchor="end">REAR DOOR</text>
    <text x={truck.length * SCALE / 2} y={bottom - 8} fontSize={17} fill="#78849a" textAnchor="middle">
      {view === 'top' ? `Top view · ${truck.length} × ${truck.width} m` : `Side view · ${truck.length} × ${truck.height} m`}
    </text>
  </svg>
}
