import { bloodCompatible, HOSPITALS } from "./data";
import { donorPairForRecipient, recipientOfDonor } from "./matching";
import type { Cycle, Pair } from "./types";

export const CYCLE_COLORS = ["#c2410c", "#1d4ed8", "#7c3aed", "#15803d"];

const DAYS = ["Tuesday, Oct 13", "Wednesday, Oct 14", "Thursday, Oct 15", "Friday, Oct 16", "Monday, Oct 19"];

export function hospitalById(id: string) {
  return HOSPITALS.find((hospital) => hospital.id === id);
}

export function pairStatus(pair: Pair): { tone: "bad" | "warn" | "good"; title: string; body: string } {
  const abo = bloodCompatible(pair.donor.blood, pair.recipient.blood);
  if (!abo) {
    return {
      tone: "bad",
      title: "ABO incompatible",
      body: `Donor type ${pair.donor.blood} cannot give to recipient type ${pair.recipient.blood}. This pair cannot be transplanted inside the hospital.`,
    };
  }
  if (pair.pairedHlaIncompatible) {
    return {
      tone: "warn",
      title: "HLA incompatible",
      body: "Blood types fit, but the crossmatch with this donor does not. A direct transplant is off. An exchange can still use the donor kidney.",
    };
  }
  let body = "A direct transplant inside this hospital is possible.";
  if (pair.donor.blood === "O" && pair.recipient.blood !== "O") {
    body += ` This donor is type O, so the kidney could also go to a type O patient. The recipient is type ${pair.recipient.blood} and can accept a non-O kidney.`;
  }
  return { tone: "good", title: "Directly compatible", body };
}

export function cycleTitle(cycle: Cycle): string {
  if (cycle.pairIds.length === 1) return `Direct transplant · ${cycle.pairIds[0].toUpperCase()}`;
  const kind = cycle.pairIds.length === 2 ? "2-way exchange" : "3-way exchange";
  return `${kind} · ${cycle.pairIds.map((id) => id.toUpperCase()).join(" · ")}`;
}

export type PatientView = {
  pairId: string;
  chip: string;
  tone: "gain" | "same" | "wait";
  detail: string;
};

export function describePair(
  pair: Pair,
  pairs: Pair[],
  exchange: Cycle[],
  internal: Cycle[],
  nameOf: (pairId: string, who: "recipient" | "donor") => string,
): PatientView {
  const byId = new Map(pairs.map((item) => [item.id, item]));
  const ex = exchange.find((cycle) => cycle.pairIds.includes(pair.id));
  const inn = internal.find((cycle) => cycle.pairIds.includes(pair.id));
  const hard = !bloodCompatible(pair.donor.blood, pair.recipient.blood)
    ? `Paired donor type ${pair.donor.blood} cannot give to type ${pair.recipient.blood}.`
    : pair.pairedHlaIncompatible
      ? "The HLA crossmatch with the paired donor fails."
      : "";

  if (!ex && inn) {
    return {
      pairId: pair.id,
      chip: "Internal only",
      tone: "wait",
      detail: "Matched if the hospital keeps this pair internal. Not part of the current exchange plan.",
    };
  }
  if (!ex) {
    return {
      pairId: pair.id,
      chip: "Unmatched",
      tone: "wait",
      detail: hard ? `${hard} Not included in this plan.` : "Not included in this plan.",
    };
  }

  const givesTo = byId.get(recipientOfDonor(ex, pair.id))!;
  const receivesFrom = byId.get(donorPairForRecipient(ex, pair.id))!;
  let detail: string;
  if (ex.pairIds.length === 1) {
    detail = `Direct transplant at ${hospitalById(pair.hospitalId)?.short}. ${nameOf(pair.id, "donor")} (${pair.donor.blood}) gives to ${nameOf(pair.id, "recipient")} (${pair.recipient.blood}). The kidney does not leave the hospital.`;
  } else {
    const article = receivesFrom.donor.blood === "B" ? "a" : "an";
    detail = `${nameOf(pair.id, "donor")} (${pair.donor.blood}) gives to ${nameOf(givesTo.id, "recipient")} (${givesTo.recipient.blood}). ${nameOf(pair.id, "recipient")} receives ${article} ${receivesFrom.donor.blood} kidney from ${nameOf(receivesFrom.id, "donor")}.`;
    if (pair.donor.blood === "O" && givesTo.recipient.blood !== "O") {
      detail += " This spends an O kidney on a recipient who is not type O.";
    }
    if (inn && inn.pairIds.length === 1 && pair.donor.blood === "O" && givesTo.id !== pair.id && pair.recipient.blood !== "O") {
      detail += ` Inside the hospital, this O kidney would have gone to ${nameOf(pair.id, "recipient")} (${pair.recipient.blood}).`;
    }
  }

  if (!inn) {
    return {
      pairId: pair.id,
      chip: "Exchange only",
      tone: "gain",
      detail: hard ? `${hard} ${detail}` : detail,
    };
  }
  return { pairId: pair.id, chip: "Also possible internally", tone: "same", detail };
}

export function mechanismNote(total: number, social: number, maxInt: number): string {
  if (maxInt < total) {
    return `If each hospital first kept a maximum internal match, and only leftover pairs were traded, this pool would transplant ${maxInt} patients. This plan transplants ${total}. Every hospital is still at least as well off as matching at home, so none of them can do better by rejecting it.`;
  }
  if (social > total) {
    return `A larger plan would transplant ${social} patients, but at least one hospital could do better by rejecting it. This plan transplants ${total}, and rejecting it cannot raise any hospital's own count.`;
  }
  return `This plan transplants ${total} patients. Rejecting it and matching at home cannot raise any hospital's own count.`;
}

export type TimelineDay = {
  day: string;
  title: string;
  note: string;
  steps: string[];
};

export function buildTimeline(cycles: Cycle[], pairs: Pair[]): TimelineDay[] {
  const byId = new Map(pairs.map((pair) => [pair.id, pair]));
  const ordered = [...cycles].sort((a, b) => {
    if (a.shared !== b.shared) return a.shared ? -1 : 1;
    return a.key.localeCompare(b.key);
  });
  return ordered.map((cycle, index) => {
    const steps: string[] = [];
    if (cycle.pairIds.length === 1) {
      const pair = byId.get(cycle.pairIds[0])!;
      const place = hospitalById(pair.hospitalId)?.name ?? pair.hospitalId;
      steps.push(`07:30  Donor nephrectomy: ${pair.donor.name} at ${place}.`);
      steps.push(`11:00  Transplant into ${pair.recipient.name} at ${place}.`);
      steps.push(`${pair.donor.name} donates only because ${pair.recipient.name} is transplanted the same morning.`);
      return {
        day: DAYS[index] ?? `Day ${index + 1}`,
        title: cycleTitle(cycle),
        note: "Internal transplant. No kidney has to travel.",
        steps,
      };
    }
    cycle.pairIds.forEach((donorId) => {
      const donorPair = byId.get(donorId)!;
      const recipientPair = byId.get(recipientOfDonor(cycle, donorId))!;
      const from = hospitalById(donorPair.hospitalId)?.name;
      const to = hospitalById(recipientPair.hospitalId)?.name;
      steps.push(`07:30  ${donorPair.donor.name} (${donorPair.donor.blood}) donor nephrectomy at ${from}.`);
      steps.push(
        from === to
          ? `10:00  Kidney stays at ${from} for ${recipientPair.recipient.name} (${recipientPair.recipient.blood}).`
          : `10:00  Kidney moves from ${from} to ${to} for ${recipientPair.recipient.name} (${recipientPair.recipient.blood}).`,
      );
      steps.push(`12:00  Transplant into ${recipientPair.recipient.name} at ${to}.`);
    });
    steps.push("Each donor is anesthetized only because their paired patient receives a kidney in this same cycle.");
    return {
      day: DAYS[index] ?? `Day ${index + 1}`,
      title: cycleTitle(cycle),
      note: "Same-day schedule so the kidneys cross while every paired patient is covered.",
      steps,
    };
  });
}
