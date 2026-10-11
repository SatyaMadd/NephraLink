import { hospitalById } from "../explain";
import type { Cycle, Hospital, Pair } from "../types";

export function GraphPanel({
  hospitals,
  pairs,
  edges,
  cycles,
  colorOf,
  focusCycle,
  inspectedId,
  showEdges,
  nodeLabel,
  onToggleEdges,
  onInspect,
  onFocus,
}: {
  hospitals: Hospital[];
  pairs: Pair[];
  edges: { from: string; to: string }[];
  cycles: Cycle[];
  colorOf: Map<string, string>;
  focusCycle: string | null;
  inspectedId: string | null;
  showEdges: boolean;
  nodeLabel: (pair: Pair) => string;
  onToggleEdges: () => void;
  onInspect: (id: string) => void;
  onFocus: (key: string | null) => void;
}) {
  const width = 700;
  const rows = Math.max(1, ...hospitals.map((hospital) => pairs.filter((pair) => pair.hospitalId === hospital.id).length));
  const height = Math.max(520, 100 + (rows - 1) * 120 + 90);
  const positions = new Map<string, { x: number; y: number }>();
  hospitals.forEach((hospital, column) => {
    pairs
      .filter((pair) => pair.hospitalId === hospital.id)
      .forEach((pair, row) => {
        positions.set(pair.id, { x: 120 + column * 230, y: 92 + row * 120 });
      });
  });

  const chosen = new Set<string>();
  const edgeColor = new Map<string, string>();
  for (const cycle of cycles) {
    if (cycle.pairIds.length < 2) continue;
    cycle.pairIds.forEach((donorId, index) => {
      const recipientId = cycle.pairIds[(index + 1) % cycle.pairIds.length];
      const key = `${donorId}>${recipientId}`;
      chosen.add(key);
      edgeColor.set(key, colorOf.get(cycle.key) ?? "#334155");
    });
  }

  const matched = new Set(cycles.flatMap((cycle) => cycle.pairIds));
  const direct = new Set(cycles.filter((cycle) => cycle.pairIds.length === 1).flatMap((cycle) => cycle.pairIds));

  function point(id: string) {
    return positions.get(id) ?? { x: 0, y: 0 };
  }

  function bend(from: string, to: string) {
    return from < to ? 36 : -36;
  }

  function path(fromId: string, toId: string) {
    const start = inset(point(fromId), point(toId), 34);
    const end = inset(point(toId), point(fromId), 36);
    const mx = (start.x + end.x) / 2;
    const my = (start.y + end.y) / 2;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy) || 1;
    const offset = bend(fromId, toId);
    const cx = mx + (-dy / len) * offset;
    const cy = my + (dx / len) * offset;
    return `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`;
  }

  const colors = [...new Set([...colorOf.values()])];

  return (
    <section className="panel" aria-label="Exchange graph">
      <header className="panel-head">
        <div>
          <p className="kicker">Exchange</p>
          <h2>Cycles</h2>
        </div>
        <button type="button" className={showEdges ? "btn primary" : "btn"} onClick={onToggleEdges} aria-pressed={showEdges}>
          {showEdges ? "Hide other links" : "Show other links"}
        </button>
      </header>
      <div className="panel-scroll graph-scroll">
        <p className="graph-help">
          A node is a patient–donor pair. A bold arrow is a kidney in the proposed plan. Other links are compatible donors who are not used in this plan.
        </p>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={graphLabel(cycles, hospitals)}>
          <defs>
            <marker id="arrow-faint" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M 0 0 L 8 3 L 0 6 Z" fill="#94a3b8" />
            </marker>
            {colors.map((color) => (
              <marker key={color} id={markerId(color)} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M 0 0 L 8 3 L 0 6 Z" fill={color} />
              </marker>
            ))}
          </defs>
          {hospitals.map((hospital, column) => (
            <g key={hospital.id}>
              <rect x={28 + column * 230} y={28} width="184" height={height - 56} rx="8" fill={hospital.color} opacity="0.06" />
              <text x={120 + column * 230} y={52} textAnchor="middle" className="col-label" fill={hospital.color}>
                {hospital.short}
              </text>
            </g>
          ))}
          {showEdges
            ? edges
                .filter((edge) => !chosen.has(`${edge.from}>${edge.to}`))
                .map((edge) => (
                  <path
                    key={`${edge.from}-${edge.to}`}
                    d={path(edge.from, edge.to)}
                    className="faint-edge"
                    markerEnd="url(#arrow-faint)"
                  />
                ))
            : null}
          {cycles
            .filter((cycle) => cycle.pairIds.length > 1)
            .flatMap((cycle) =>
              cycle.pairIds.map((donorId, index) => {
                const recipientId = cycle.pairIds[(index + 1) % cycle.pairIds.length];
                const color = colorOf.get(cycle.key) ?? "#334155";
                const dim = focusCycle !== null && focusCycle !== cycle.key;
                return (
                  <path
                    key={`${cycle.key}-${donorId}`}
                    d={path(donorId, recipientId)}
                    stroke={color}
                    strokeWidth={focusCycle === cycle.key ? 3.4 : 2.4}
                    fill="none"
                    opacity={dim ? 0.2 : 1}
                    markerEnd={`url(#${markerId(color)})`}
                    className="cycle-edge"
                    onClick={() => onFocus(focusCycle === cycle.key ? null : cycle.key)}
                  />
                );
              }),
            )}
          {pairs.map((pair) => {
            const at = point(pair.id);
            const hospital = hospitalById(pair.hospitalId);
            const inPlan = matched.has(pair.id);
            const cycle = cycles.find((item) => item.pairIds.includes(pair.id));
            const ring = cycle ? colorOf.get(cycle.key) : undefined;
            return (
              <g
                key={pair.id}
                className="node"
                role="button"
                tabIndex={0}
                aria-label={`${nodeLabel(pair)}, donor ${pair.donor.blood} to recipient ${pair.recipient.blood}`}
                onClick={() => onInspect(pair.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onInspect(pair.id);
                }}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={at.x}
                  cy={at.y}
                  r="28"
                  fill={inPlan ? "#fff" : "#eef2f6"}
                  stroke={inspectedId === pair.id ? "#111827" : (hospital?.color ?? "#334155")}
                  strokeWidth={inspectedId === pair.id ? 3 : 2}
                  strokeDasharray={inPlan ? undefined : "4 3"}
                />
                {ring ? <circle cx={at.x} cy={at.y} r="33" fill="none" stroke={ring} strokeWidth="3" /> : null}
                <text x={at.x} y={at.y - 2} textAnchor="middle" className="node-label">
                  {nodeLabel(pair)}
                </text>
                <text x={at.x} y={at.y + 13} textAnchor="middle" className="node-sub">
                  {pair.donor.blood}→{pair.recipient.blood}
                </text>
                {direct.has(pair.id) ? (
                  <text x={at.x} y={at.y + 48} textAnchor="middle" className="direct-tag">
                    Direct
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        <ul className="legend">
          {cycles.map((cycle) => (
            <li key={cycle.key}>
              <button type="button" className="legend-btn" onClick={() => onFocus(focusCycle === cycle.key ? null : cycle.key)}>
                <span className="swatch" style={{ background: colorOf.get(cycle.key) }} />
                {cycle.pairIds.length === 1 ? "Direct" : `${cycle.pairIds.length}-way`} {cycle.pairIds.map((id) => id.toUpperCase()).join(" · ")}
              </button>
            </li>
          ))}
          <li>
            <span className="swatch dashed" /> Unmatched
          </li>
        </ul>
      </div>
    </section>
  );
}

function inset(from: { x: number; y: number }, to: { x: number; y: number }, radius: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / len) * radius, y: from.y + (dy / len) * radius };
}

function markerId(color: string) {
  return `arrow-${color.replace("#", "")}`;
}

function graphLabel(cycles: Cycle[], hospitals: Hospital[]) {
  if (cycles.length === 0) return "No cycles in the current plan.";
  const names = cycles.map((cycle) => cycle.pairIds.map((id) => id.toUpperCase()).join(" to ")).join("; ");
  return `Exchange graph for ${hospitals.map((hospital) => hospital.short).join(", ")}. Proposed cycles: ${names}.`;
}
