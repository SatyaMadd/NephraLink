import { buildTimeline, cycleTitle, describePair, hospitalById } from "../explain";
import type { Cycle, Hospital, HospitalReport, Pair } from "../types";

export function PayoffPanel({
  hospital,
  pairs,
  report,
  cycles,
  internalCycles,
  approvals,
  planLocked,
  focusCycle,
  colorOf,
  nameOf,
  onFocus,
  onApprove,
  onReject,
}: {
  hospital: Hospital;
  pairs: Pair[];
  report: HospitalReport;
  cycles: Cycle[];
  internalCycles: Cycle[];
  approvals: Record<string, string[]>;
  planLocked: boolean;
  focusCycle: string | null;
  colorOf: Map<string, string>;
  nameOf: (pairId: string, who: "recipient" | "donor") => string;
  onFocus: (key: string | null) => void;
  onApprove: (key: string) => void;
  onReject: (key: string) => void;
}) {
  const ownPairs = pairs.filter((pair) => pair.hospitalId === hospital.id);
  const delta = report.exchangeCount - report.internalCount;
  const mine = cycles.filter((cycle) => cycle.hospitalIds.includes(hospital.id));
  const others = cycles.filter((cycle) => !cycle.hospitalIds.includes(hospital.id));
  const timeline = planLocked ? buildTimeline(cycles, pairs) : [];

  return (
    <section className="panel" aria-label="Hospital payoff">
      <header className="panel-head">
        <div>
          <p className="kicker">Surgeon view</p>
          <h2>What {hospital.short} gets</h2>
        </div>
      </header>
      <div className="panel-scroll">
        <div className="compare">
          <div className="stat">
            <span className="num">{report.internalCount}</span>
            <span className="stat-label">Inside this hospital</span>
            <span className="stat-help">If {hospital.short} never joins a shared cycle</span>
          </div>
          <div className="stat gain">
            <span className="num">{report.exchangeCount}</span>
            <span className="stat-label">In this exchange</span>
            <span className="stat-help">{planLocked ? "Approved plan" : "Proposed, not final"}</span>
          </div>
        </div>
        <p className="delta">
          {delta > 0
            ? `+${delta} of ${hospital.short}'s patients, compared with matching only inside the hospital.`
            : `Same number of ${hospital.short} patients as matching at home. Rejecting the plan cannot raise that number.`}
        </p>

        <ul className="patient-list">
          {ownPairs.map((pair) => {
            const view = describePair(pair, pairs, cycles, internalCycles, nameOf);
            return (
              <li key={pair.id} className={`patient-row ${view.tone}`}>
                <div className="patient-top">
                  <strong>{pair.recipient.name}</strong>
                  <span className={`pill ${view.tone === "gain" ? "good" : view.tone === "wait" ? "warn" : "neutral"}`}>{view.chip}</span>
                </div>
                <p>{view.detail}</p>
              </li>
            );
          })}
        </ul>

        <h3 className="section-label">Cycles to approve</h3>
        {mine.length === 0 ? <p className="empty">No cycle in this plan uses {hospital.short}.</p> : null}
        <ul className="cycle-list">
          {mine.map((cycle) => (
            <CycleCard
              key={cycle.key}
              cycle={cycle}
              hospital={hospital}
              approvals={approvals}
              focused={focusCycle === cycle.key}
              color={colorOf.get(cycle.key) ?? "#334155"}
              planLocked={planLocked}
              nameOf={nameOf}
              onFocus={onFocus}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}
        </ul>

        {others.length > 0 ? (
          <>
            <h3 className="section-label">Other cycles in the plan</h3>
            <ul className="cycle-list">
              {others.map((cycle) => (
                <li key={cycle.key}>
                  <button
                    type="button"
                    className={focusCycle === cycle.key ? "quiet-cycle focused" : "quiet-cycle"}
                    onClick={() => onFocus(focusCycle === cycle.key ? null : cycle.key)}
                  >
                    <span className="swatch" style={{ background: colorOf.get(cycle.key) }} />
                    {cycleTitle(cycle)}
                    <small>{pendingText(cycle, approvals)}</small>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {planLocked ? (
          <div className="timeline">
            <div className="banner good">
              <strong>Schedule locked</strong>
              <p>Every hospital in the plan has approved. Donor surgery starts only when the paired patient is covered in the same cycle.</p>
            </div>
            {timeline.map((day) => (
              <article key={day.title + day.day} className="day">
                <h3>
                  {day.day}
                  <span>{day.title}</span>
                </h3>
                <p>{day.note}</p>
                <ul>
                  {day.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <p className="lock-note">The surgery timeline locks after every hospital in every cycle has approved. Switch the viewpoint to sign for another hospital.</p>
        )}
      </div>
    </section>
  );
}

function CycleCard({
  cycle,
  hospital,
  approvals,
  focused,
  color,
  planLocked,
  nameOf,
  onFocus,
  onApprove,
  onReject,
}: {
  cycle: Cycle;
  hospital: Hospital;
  approvals: Record<string, string[]>;
  focused: boolean;
  color: string;
  planLocked: boolean;
  nameOf: (pairId: string, who: "recipient" | "donor") => string;
  onFocus: (key: string | null) => void;
  onApprove: (key: string) => void;
  onReject: (key: string) => void;
}) {
  const signed = new Set(approvals[cycle.key] ?? []);
  const mineSigned = signed.has(hospital.id);
  const waiting = cycle.hospitalIds.filter((id) => !signed.has(id)).map((id) => hospitalById(id)?.short ?? id);

  return (
    <li>
      <article className={focused ? "cycle-card focused" : "cycle-card"} style={{ borderTopColor: color }}>
        <button type="button" className="cycle-focus" onClick={() => onFocus(focused ? null : cycle.key)}>
          <span className="swatch" style={{ background: color }} />
          <span>{cycleTitle(cycle)}</span>
        </button>
        <ul className="arrows">
          {cycle.pairIds.map((donorId) => {
            const recipientId = cycle.pairIds[(cycle.pairIds.indexOf(donorId) + 1) % cycle.pairIds.length];
            return (
              <li key={donorId}>
                {nameOf(donorId, "donor")} → {nameOf(recipientId, "recipient")}
              </li>
            );
          })}
        </ul>
        <p className="wait-line">
          {waiting.length === 0 ? "Accepted by every hospital in the cycle." : `Waiting on ${waiting.join(", ")}.`}
        </p>
        {!planLocked ? (
          <div className="form-actions">
            <button
              type="button"
              className="btn primary"
              disabled={mineSigned}
              aria-label={`Approve ${cycleTitle(cycle)} as ${hospital.short}`}
              onClick={() => onApprove(cycle.key)}
            >
              {mineSigned ? "Approved" : `Approve as ${hospital.short}`}
            </button>
            <button type="button" className="btn danger" aria-label={`Reject ${cycleTitle(cycle)}`} onClick={() => onReject(cycle.key)}>
              Reject cycle
            </button>
          </div>
        ) : null}
      </article>
    </li>
  );
}

function pendingText(cycle: Cycle, approvals: Record<string, string[]>): string {
  const signed = new Set(approvals[cycle.key] ?? []);
  const waiting = cycle.hospitalIds.filter((id) => !signed.has(id)).map((id) => hospitalById(id)?.short ?? id);
  return waiting.length === 0 ? "Accepted" : `Waiting on ${waiting.join(", ")}`;
}
