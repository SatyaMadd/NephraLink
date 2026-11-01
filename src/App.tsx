import { useMemo, useState } from "react";
import { ChartPanel } from "./components/ChartPanel";
import { GraphPanel } from "./components/GraphPanel";
import { PayoffPanel } from "./components/PayoffPanel";
import { HOSPITALS, shuffledPairs, teachingPairs } from "./data";
import { CYCLE_COLORS, hospitalById, mechanismNote } from "./explain";
import { buildGraph, solve } from "./matching";
import type { Pair } from "./types";

export function App() {
  const [pairs, setPairs] = useState<Pair[]>(() => teachingPairs());
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [poolName, setPoolName] = useState("Teaching example");
  const [activeHospital, setActiveHospital] = useState(HOSPITALS[0].id);
  const [inspectedId, setInspectedId] = useState("m1");
  const [creating, setCreating] = useState(false);
  const [forbidden, setForbidden] = useState<string[]>([]);
  const [approvals, setApprovals] = useState<Record<string, string[]>>({});
  const [focusCycle, setFocusCycle] = useState<string | null>(null);
  const [showEdges, setShowEdges] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const activePairs = useMemo(() => pairs.filter((pair) => !pendingIds.includes(pair.id)), [pairs, pendingIds]);
  const graph = useMemo(() => buildGraph(activePairs), [activePairs]);
  const result = useMemo(() => solve(graph, forbidden), [graph, forbidden]);
  const hospital = HOSPITALS.find((item) => item.id === activeHospital) ?? HOSPITALS[0];
  const report = result.reports.find((item) => item.hospitalId === hospital.id) ?? result.reports[0];
  const colorOf = useMemo(
    () => new Map(result.cycles.map((cycle, index) => [cycle.key, CYCLE_COLORS[index % CYCLE_COLORS.length]])),
    [result.cycles],
  );
  const planLocked =
    result.cycles.length > 0 &&
    result.cycles.every((cycle) => cycle.hospitalIds.every((id) => (approvals[cycle.key] ?? []).includes(id)));
  const unlockedIds = new Set(
    result.cycles
      .filter((cycle) => cycle.hospitalIds.every((id) => (approvals[cycle.key] ?? []).includes(id)))
      .flatMap((cycle) => cycle.pairIds),
  );
  const inspected = pairs.find((pair) => pair.id === inspectedId) ?? null;

  function personName(pairId: string, who: "recipient" | "donor") {
    const pair = pairs.find((item) => item.id === pairId);
    if (!pair) return pairId;
    const open = pair.hospitalId === activeHospital || unlockedIds.has(pair.id);
    if (open) return who === "recipient" ? pair.recipient.name : pair.donor.name;
    const owner = hospitalById(pair.hospitalId);
    const code = `${owner?.short ?? "Hospital"} pair ${pair.id.toUpperCase()}`;
    return who === "recipient" ? code : `${code}'s donor`;
  }

  function viewAs(hospitalId: string) {
    setActiveHospital(hospitalId);
    setCreating(false);
    const first = pairs.find((pair) => pair.hospitalId === hospitalId);
    if (first) setInspectedId(first.id);
  }

  function clearDecisions() {
    setForbidden([]);
    setApprovals({});
    setFocusCycle(null);
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <p className="eyebrow">Rough draft</p>
          <h1>Kidney exchange</h1>
          <p className="pool">{poolName} · counts are home → exchange</p>
        </div>
        <div className="switcher" role="group" aria-label="Hospital viewpoint">
          {HOSPITALS.map((item) => {
            const itemReport = result.reports.find((reportItem) => reportItem.hospitalId === item.id);
            const active = item.id === activeHospital;
            return (
              <button
                key={item.id}
                type="button"
                className={active ? "hosp active" : "hosp"}
                aria-pressed={active}
                onClick={() => viewAs(item.id)}
              >
                <span className="swatch" style={{ background: item.color }} />
                <span className="hosp-name">
                  <strong>{item.name}</strong>
                  <small>{item.city}</small>
                </span>
                <span className="count" title="Patients transplanted inside the hospital, then in this exchange">
                  {itemReport?.internalCount ?? 0}
                  <span aria-hidden="true"> → </span>
                  {itemReport?.exchangeCount ?? 0}
                </span>
              </button>
            );
          })}
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              const next = teachingPairs();
              setPairs(next);
              setPendingIds([]);
              setPoolName("Teaching example");
              setActiveHospital("mercy");
              setInspectedId("m1");
              setCreating(false);
              clearDecisions();
              setNotice(null);
            }}
          >
            Restore example
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const seed = 1000 + Math.floor(Math.random() * 9000);
              const next = shuffledPairs(seed);
              setPairs(next);
              setPendingIds([]);
              setPoolName(`Shuffled pool ${seed}`);
              setActiveHospital(next[0]?.hospitalId ?? "mercy");
              setInspectedId(next[0]?.id ?? "");
              setCreating(false);
              clearDecisions();
              setNotice("New pool generated. Charts are in the live pool, and no cycle is approved yet.");
            }}
          >
            Shuffle pool
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              clearDecisions();
              setNotice("Rejections and approvals cleared.");
            }}
          >
            Reset decisions
          </button>
        </div>
      </header>
      <p className="mechanism">{mechanismNote(result.total, result.socialTotal, result.maxIntTotal)}</p>
      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}
      <main className="workspace">
        <ChartPanel
          hospital={hospital}
          pairs={pairs}
          inspected={inspected}
          creating={creating}
          unlockedIds={unlockedIds}
          onInspect={(id) => {
            setCreating(false);
            setInspectedId(id);
          }}
          onCreating={setCreating}
          onAdd={(pair) => {
            setPairs((current) => [...current, pair]);
            setPendingIds((current) => [...current, pair.id]);
            setApprovals({});
            setFocusCycle(null);
            setInspectedId(pair.id);
            setCreating(false);
            setNotice("Pair saved to the records. Surgeon permission is required before it enters the matching algorithm.");
          }}
        />
        <PayoffPanel
          hospital={hospital}
          pairs={pairs}
          report={report}
          cycles={result.cycles}
          pendingIds={pendingIds}
          internalCycles={result.internalCycles[hospital.id] ?? []}
          approvals={approvals}
          planLocked={planLocked}
          focusCycle={focusCycle}
          colorOf={colorOf}
          nameOf={personName}
          onFocus={setFocusCycle}
          onApprove={(key) => {
            setApprovals((current) => {
              const existing = current[key] ?? [];
              if (existing.includes(activeHospital)) return current;
              return { ...current, [key]: [...existing, activeHospital] };
            });
          }}
          onApprovePatient={(pairId) => {
            setPendingIds((current) => current.filter((id) => id !== pairId));
            setApprovals({});
            setFocusCycle(null);
            setNotice("Patient approved by the surgeon. The matching algorithm was updated; any previous cycle approvals were cleared.");
          }}
          onReject={(key) => {
            setForbidden((current) => (current.includes(key) ? current : [...current, key]));
            setApprovals({});
            setFocusCycle(null);
            setNotice("Cycle rejected. The plan was recomputed, and earlier approvals were cleared.");
          }}
        />
        <GraphPanel
          hospitals={HOSPITALS}
          pairs={pairs}
          edges={result.edges}
          cycles={result.cycles}
          colorOf={colorOf}
          focusCycle={focusCycle}
          inspectedId={inspectedId}
          showEdges={showEdges}
          nodeLabel={(pair) => {
            const open = pair.hospitalId === activeHospital || unlockedIds.has(pair.id);
            return open ? pair.recipient.name.split(" ")[0] : pair.id.toUpperCase();
          }}
          onToggleEdges={() => setShowEdges((value) => !value)}
          onInspect={(id) => {
            setCreating(false);
            setInspectedId(id);
          }}
          onFocus={setFocusCycle}
        />
      </main>
      <footer className="foot">
        Draft of a maximum rejection-proof exchange for a small pool (Blom, Smeulders, and Spieksma, arXiv:2206.11525). Cycles are 2-way or 3-way. A chart entry joins the live pool; a cycle is final only after every hospital in it approves.
      </footer>
    </div>
  );
}
