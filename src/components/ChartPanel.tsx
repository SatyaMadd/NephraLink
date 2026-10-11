import { useState } from "react";
import { bloodCompatible, createPairId } from "../data";
import { hospitalById, pairStatus } from "../explain";
import type { BloodType, Hospital, Pair } from "../types";

type Draft = {
  recipientName: string;
  recipientAge: string;
  recipientSex: "F" | "M";
  recipientBlood: BloodType;
  recipientHla: string;
  donorName: string;
  donorAge: string;
  donorSex: "F" | "M";
  donorBlood: BloodType;
  donorHla: string;
  relationship: string;
  highlySensitized: boolean;
  pairedHlaIncompatible: boolean;
};

const EMPTY: Draft = {
  recipientName: "",
  recipientAge: "48",
  recipientSex: "F",
  recipientBlood: "O",
  recipientHla: "",
  donorName: "",
  donorAge: "45",
  donorSex: "M",
  donorBlood: "A",
  donorHla: "",
  relationship: "Spouse",
  highlySensitized: true,
  pairedHlaIncompatible: true,
};

const BLOODS: BloodType[] = ["O", "A", "B", "AB"];

export function ChartPanel({
  hospital,
  pairs,
  inspected,
  creating,
  unlockedIds,
  onInspect,
  onCreating,
  onAdd,
}: {
  hospital: Hospital;
  pairs: Pair[];
  inspected: Pair | null;
  creating: boolean;
  unlockedIds: Set<string>;
  onInspect: (id: string) => void;
  onCreating: (value: boolean) => void;
  onAdd: (pair: Pair) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState("");
  const own = pairs.filter((pair) => pair.hospitalId === hospital.id);
  const foreign = inspected && inspected.hospitalId !== hospital.id ? inspected : null;
  const selected = foreign ? null : (own.find((pair) => pair.id === inspected?.id) ?? own[0] ?? null);

  function save() {
    const recipientName = draft.recipientName.trim();
    const donorName = draft.donorName.trim();
    if (!recipientName || !donorName) {
      setError("Enter both the recipient and the donor.");
      return;
    }
    const aboOk = bloodCompatible(draft.donorBlood, draft.recipientBlood);
    const id = createPairId();
    onAdd({
      id,
      hospitalId: hospital.id,
      mrn: `MRN-${id.toUpperCase()}-${Date.now().toString().slice(-4)}`,
      relationship: draft.relationship,
      highlySensitized: draft.highlySensitized,
      pairedHlaIncompatible: !aboOk || draft.pairedHlaIncompatible,
      curated: false,
      allowedDonors: [],
      recipient: {
        name: recipientName,
        age: Number(draft.recipientAge) || 0,
        sex: draft.recipientSex,
        blood: draft.recipientBlood,
        hla: draft.recipientHla.trim() || "Not entered",
      },
      donor: {
        name: donorName,
        age: Number(draft.donorAge) || 0,
        sex: draft.donorSex,
        blood: draft.donorBlood,
        hla: draft.donorHla.trim() || "Not entered",
      },
    });
    setDraft(EMPTY);
    setError("");
  }

  return (
    <section className="panel" aria-label="Patient chart">
      <header className="panel-head">
        <div>
          <p className="kicker">Chart</p>
          <h2>{hospital.name}</h2>
        </div>
        <button type="button" className="btn primary" onClick={() => onCreating(true)}>
          New pair
        </button>
      </header>
      <div className="chart-body">
        <ul className="worklist">
          {own.map((pair) => {
            const status = pairStatus(pair);
            return (
              <li key={pair.id}>
                <button
                  type="button"
                  className={selected?.id === pair.id && !creating ? "work-item selected" : "work-item"}
                  onClick={() => {
                    onCreating(false);
                    onInspect(pair.id);
                  }}
                >
                  <span className="work-name">{pair.recipient.name}</span>
                  <span className="work-meta">
                    {pair.recipient.blood} · donor {pair.donor.blood}
                  </span>
                  <span className={`pill ${status.tone}`}>{status.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="chart-sheet">
          {creating ? (
            <PairForm
              hospital={hospital}
              draft={draft}
              error={error}
              onChange={setDraft}
              onCancel={() => {
                setError("");
                onCreating(false);
              }}
              onSave={save}
            />
          ) : foreign ? (
            <LockedChart pair={foreign} unlocked={unlockedIds.has(foreign.id)} />
          ) : selected ? (
            <OpenChart pair={selected} />
          ) : (
            <p className="empty">No pairs at this hospital yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function OpenChart({ pair }: { pair: Pair }) {
  const status = pairStatus(pair);
  return (
    <article>
      <div className="epic-bar">
        <div>
          <h3>
            {pair.recipient.name}, {pair.recipient.sex}, {pair.recipient.age}y
          </h3>
          <p>
            {pair.mrn} · Donor {pair.donor.name}, {pair.relationship.toLowerCase()}
          </p>
        </div>
        <span className="pair-code">{pair.id.toUpperCase()}</span>
      </div>
      <div className={`banner ${status.tone}`}>
        <strong>{status.title}</strong>
        <p>{status.body}</p>
      </div>
      <div className="bio-grid">
        <PersonCard title="Recipient" person={pair.recipient} extra={pair.highlySensitized ? "Highly sensitized" : "Not highly sensitized"} />
        <PersonCard title="Donor" person={pair.donor} extra={pair.relationship} />
      </div>
      <p className="lock-note">
        Entering this chart puts the pair in the live pool. The matcher receives blood type and a yes/no crossmatch. Name, MRN, and the HLA string stay in the chart until a cycle is approved.
      </p>
    </article>
  );
}

function PersonCard({
  title,
  person,
  extra,
}: {
  title: string;
  person: Pair["recipient"];
  extra: string;
}) {
  return (
    <div className="bio-card">
      <h4>{title}</h4>
      <p className="bio-name">{person.name}</p>
      <dl>
        <div>
          <dt>ABO</dt>
          <dd>{person.blood}</dd>
        </div>
        <div>
          <dt>Age / sex</dt>
          <dd>
            {person.age} · {person.sex}
          </dd>
        </div>
        <div>
          <dt>HLA</dt>
          <dd>{person.hla}</dd>
        </div>
        <div>
          <dt>Note</dt>
          <dd>{extra}</dd>
        </div>
      </dl>
    </div>
  );
}

function LockedChart({ pair, unlocked }: { pair: Pair; unlocked: boolean }) {
  const hospital = hospitalById(pair.hospitalId);
  return (
    <article className="locked-sheet">
      <div className="epic-bar">
        <div>
          <h3>{unlocked ? pair.recipient.name : `${hospital?.short} pair ${pair.id.toUpperCase()}`}</h3>
          <p>{hospital?.name}</p>
        </div>
      </div>
      <div className="banner warn">
        <strong>{unlocked ? "Cycle approved" : "Chart locked"}</strong>
        <p>
          {unlocked
            ? `Name released for surgical coordination. The HLA string stays in ${hospital?.name}'s chart.`
            : `Identity and HLA stay in ${hospital?.name}'s chart until a cycle containing this pair is approved. The matcher can see the crossmatch below.`}
        </p>
      </div>
      <dl className="locked-facts">
        <div>
          <dt>Donor ABO</dt>
          <dd>{pair.donor.blood}</dd>
        </div>
        <div>
          <dt>Recipient ABO</dt>
          <dd>{pair.recipient.blood}</dd>
        </div>
        <div>
          <dt>Paired crossmatch</dt>
          <dd>{pairStatus(pair).title}</dd>
        </div>
      </dl>
    </article>
  );
}

function PairForm({
  hospital,
  draft,
  error,
  onChange,
  onCancel,
  onSave,
}: {
  hospital: Hospital;
  draft: Draft;
  error: string;
  onChange: (draft: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const aboOk = bloodCompatible(draft.donorBlood, draft.recipientBlood);
  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    onChange({ ...draft, [key]: value });
  }
  return (
    <article>
      <div className="epic-bar">
        <div>
          <h3>New donor–recipient pair</h3>
          <p>{hospital.name} · goes into the live pool on save</p>
        </div>
      </div>
      <div className={`banner ${aboOk ? "warn" : "bad"}`}>
        <strong>{aboOk ? "ABO compatible so far" : "ABO incompatible"}</strong>
        <p>
          {aboOk
            ? "Check the HLA box if this donor still cannot give to this recipient."
            : `Type ${draft.donorBlood} cannot give to type ${draft.recipientBlood}.`}
        </p>
      </div>
      <div className="bio-grid">
        <fieldset>
          <legend>Recipient</legend>
          <label>
            Name
            <input value={draft.recipientName} onChange={(event) => set("recipientName", event.target.value)} />
          </label>
          <label>
            Age
            <input value={draft.recipientAge} onChange={(event) => set("recipientAge", event.target.value)} inputMode="numeric" />
          </label>
          <label>
            Sex
            <select value={draft.recipientSex} onChange={(event) => set("recipientSex", event.target.value as "F" | "M")}>
              <option value="F">F</option>
              <option value="M">M</option>
            </select>
          </label>
          <label>
            ABO
            <select value={draft.recipientBlood} onChange={(event) => set("recipientBlood", event.target.value as BloodType)}>
              {BLOODS.map((blood) => (
                <option key={blood}>{blood}</option>
              ))}
            </select>
          </label>
          <label>
            HLA
            <input value={draft.recipientHla} placeholder="A*02:01, B*44:02, DRB1*07:01" onChange={(event) => set("recipientHla", event.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={draft.highlySensitized} onChange={(event) => set("highlySensitized", event.target.checked)} />
            Highly sensitized (only an identical blood type crossmatches)
          </label>
        </fieldset>
        <fieldset>
          <legend>Donor</legend>
          <label>
            Name
            <input value={draft.donorName} onChange={(event) => set("donorName", event.target.value)} />
          </label>
          <label>
            Age
            <input value={draft.donorAge} onChange={(event) => set("donorAge", event.target.value)} inputMode="numeric" />
          </label>
          <label>
            Sex
            <select value={draft.donorSex} onChange={(event) => set("donorSex", event.target.value as "F" | "M")}>
              <option value="F">F</option>
              <option value="M">M</option>
            </select>
          </label>
          <label>
            ABO
            <select value={draft.donorBlood} onChange={(event) => set("donorBlood", event.target.value as BloodType)}>
              {BLOODS.map((blood) => (
                <option key={blood}>{blood}</option>
              ))}
            </select>
          </label>
          <label>
            HLA
            <input value={draft.donorHla} placeholder="Optional" onChange={(event) => set("donorHla", event.target.value)} />
          </label>
          <label>
            Relationship
            <select value={draft.relationship} onChange={(event) => set("relationship", event.target.value)}>
              {["Spouse", "Sibling", "Parent", "Child", "Friend"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={!aboOk || draft.pairedHlaIncompatible}
              disabled={!aboOk}
              onChange={(event) => set("pairedHlaIncompatible", event.target.checked)}
            />
            HLA incompatible with this recipient
          </label>
        </fieldset>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn primary" onClick={onSave}>
          Save pair
        </button>
      </div>
    </article>
  );
}
