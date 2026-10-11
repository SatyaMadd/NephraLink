import type { BloodType, CompatGraph, Cycle, HospitalReport, Pair, Score, SolveResult } from "./types";
import { canGive } from "./data";

export function buildGraph(pairs: Pair[]): CompatGraph {
  const edge = pairs.map((donor) => pairs.map((recipient) => canGive(donor, recipient)));
  return {
    pairIds: pairs.map((pair) => pair.id),
    hospitalOf: pairs.map((pair) => pair.hospitalId),
    donorBlood: pairs.map((pair) => pair.donor.blood),
    recipientBlood: pairs.map((pair) => pair.recipient.blood),
    edge,
  };
}

function cycleKey(pairIds: string[]): string {
  const rotations = pairIds.map((_, index) => pairIds.slice(index).concat(pairIds.slice(0, index)).join(">"));
  return rotations.sort()[0];
}

export function enumerateCycles(graph: CompatGraph): Cycle[] {
  const n = graph.pairIds.length;
  const cycles: Cycle[] = [];
  const seen = new Set<string>();

  const push = (indexes: number[]) => {
    const pairIds = indexes.map((index) => graph.pairIds[index]);
    const key = cycleKey(pairIds);
    if (seen.has(key)) return;
    seen.add(key);
    let mask = 0;
    for (const index of indexes) mask |= 1 << index;
    const hospitalIds = [...new Set(indexes.map((index) => graph.hospitalOf[index]))];
    cycles.push({
      key,
      pairIds,
      mask,
      shared: hospitalIds.length > 1,
      hospitalIds,
    });
  };

  for (let i = 0; i < n; i += 1) {
    if (graph.edge[i][i]) push([i]);
  }
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (graph.edge[i][j] && graph.edge[j][i]) push([i, j]);
    }
  }
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (j === i || !graph.edge[i][j]) continue;
      for (let k = 0; k < n; k += 1) {
        if (k === i || k === j || !graph.edge[j][k] || !graph.edge[k][i]) continue;
        push([i, j, k]);
      }
    }
  }
  cycles.sort((a, b) => a.key.localeCompare(b.key));
  return cycles;
}

function popcount(mask: number): number {
  let count = 0;
  let bits = mask;
  while (bits) {
    bits &= bits - 1;
    count += 1;
  }
  return count;
}

function qualityOfEdge(donor: BloodType, recipient: BloodType): number {
  let score = donor === recipient ? 2 : 1;
  if (donor === "O" && recipient !== "O") score -= 4;
  return score;
}

function scorePacking(cycles: Cycle[], graph: CompatGraph): Score {
  const indexOf = new Map(graph.pairIds.map((id, index) => [id, index]));
  let quality = 0;
  let hard = 0;
  let mask = 0;
  for (const cycle of cycles) {
    mask |= cycle.mask;
    cycle.pairIds.forEach((donorId, slot) => {
      const recipientId = cycle.pairIds[(slot + 1) % cycle.pairIds.length];
      const donorIndex = indexOf.get(donorId)!;
      const recipientIndex = indexOf.get(recipientId)!;
      quality += qualityOfEdge(graph.donorBlood[donorIndex], graph.recipientBlood[recipientIndex]);
      if (!graph.edge[recipientIndex][recipientIndex]) hard += 1;
    });
  }
  const key = cycles
    .map((cycle) => cycle.key)
    .sort()
    .join("|");
  return { total: popcount(mask), quality, hard, key };
}

function better(next: Score, current: Score | null): boolean {
  if (!current) return true;
  if (next.total !== current.total) return next.total > current.total;
  if (next.quality !== current.quality) return next.quality > current.quality;
  if (next.hard !== current.hard) return next.hard > current.hard;
  return next.key < current.key;
}

function patientsIn(cycles: Cycle[], graph: CompatGraph, hospitalId: string): string[] {
  const covered = new Set<string>();
  for (const cycle of cycles) {
    for (const pairId of cycle.pairIds) {
      const index = graph.pairIds.indexOf(pairId);
      if (graph.hospitalOf[index] === hospitalId) covered.add(pairId);
    }
  }
  return [...covered];
}

/** Best any hospital can do by refusing shared cycles and rematching its own pairs. */
export function rejectionValue(proposed: Cycle[], hospitalId: string, allCycles: Cycle[], graph: CompatGraph): number {
  const internal = allCycles.filter((cycle) => cycle.pairIds.every((id) => graph.hospitalOf[graph.pairIds.indexOf(id)] === hospitalId));
  const shared = proposed.filter((cycle) => cycle.shared && cycle.hospitalIds.includes(hospitalId));
  const menu = [...shared, ...internal];
  let best = 0;
  const walk = (index: number, used: number, count: number) => {
    if (index === menu.length) {
      if (count > best) best = count;
      return;
    }
    walk(index + 1, used, count);
    const cycle = menu[index];
    if ((used & cycle.mask) !== 0) return;
    const gain = cycle.pairIds.filter((id) => graph.hospitalOf[graph.pairIds.indexOf(id)] === hospitalId).length;
    walk(index + 1, used | cycle.mask, count + gain);
  };
  walk(0, 0, 0);
  return best;
}

export function isRejectionProof(proposed: Cycle[], allCycles: Cycle[], graph: CompatGraph): boolean {
  const hospitals = [...new Set(graph.hospitalOf)];
  return hospitals.every((hospitalId) => {
    const value = patientsIn(proposed, graph, hospitalId).length;
    return rejectionValue(proposed, hospitalId, allCycles, graph) <= value;
  });
}

type Mode = "social" | "rp" | "maxint";

function search(cycles: Cycle[], graph: CompatGraph, mode: Mode, betas?: Map<string, number>): Cycle[] {
  const hospitals = [...new Set(graph.hospitalOf)];
  let bestCycles: Cycle[] = [];
  let bestScore: Score | null = null;
  const chosen: Cycle[] = [];

  const internalWeight = (hospitalId: string) => {
    let count = 0;
    for (const cycle of chosen) {
      if (cycle.shared) continue;
      if (!cycle.pairIds.every((id) => graph.hospitalOf[graph.pairIds.indexOf(id)] === hospitalId)) continue;
      count += cycle.pairIds.length;
    }
    return count;
  };

  const consider = () => {
    if (mode === "rp" && !isRejectionProof(chosen, cycles, graph)) return;
    if (mode === "maxint" && betas) {
      const fits = hospitals.every((hospitalId) => internalWeight(hospitalId) === (betas.get(hospitalId) ?? 0));
      if (!fits) return;
    }
    const score = scorePacking(chosen, graph);
    if (better(score, bestScore)) {
      bestScore = score;
      bestCycles = chosen.slice();
    }
  };

  const walk = (start: number) => {
    consider();
    for (let index = start; index < cycles.length; index += 1) {
      const cycle = cycles[index];
      if (chosen.some((picked) => (picked.mask & cycle.mask) !== 0)) continue;
      chosen.push(cycle);
      walk(index + 1);
      chosen.pop();
    }
  };

  walk(0);
  return bestCycles;
}

function internalBest(graph: CompatGraph, cycles: Cycle[], hospitalId: string): Cycle[] {
  const own = cycles.filter((cycle) => !cycle.shared && cycle.hospitalIds.length === 1 && cycle.hospitalIds[0] === hospitalId);
  return search(own, graph, "social");
}

export function solve(graph: CompatGraph, forbidden: string[] = []): SolveResult {
  const available = enumerateCycles(graph).filter((cycle) => !forbidden.includes(cycle.key));
  const hospitals = [...new Set(graph.hospitalOf)];
  const internalCycles: Record<string, Cycle[]> = {};
  const betas = new Map<string, number>();
  for (const hospitalId of hospitals) {
    internalCycles[hospitalId] = internalBest(graph, available, hospitalId);
    betas.set(hospitalId, patientsIn(internalCycles[hospitalId], graph, hospitalId).length);
  }

  const chosen = search(available, graph, "rp");
  const social = search(available, graph, "social");
  const maxInt = search(available, graph, "maxint", betas);

  const reports: HospitalReport[] = hospitals.map((hospitalId) => {
    const internalPairIds = patientsIn(internalCycles[hospitalId], graph, hospitalId);
    const exchangePairIds = patientsIn(chosen, graph, hospitalId);
    const internalSet = new Set(internalPairIds);
    return {
      hospitalId,
      internalCount: internalPairIds.length,
      exchangeCount: exchangePairIds.length,
      internalPairIds,
      exchangePairIds,
      onlyViaExchange: exchangePairIds.filter((id) => !internalSet.has(id)),
    };
  });

  const edges: { from: string; to: string }[] = [];
  for (let donor = 0; donor < graph.pairIds.length; donor += 1) {
    for (let recipient = 0; recipient < graph.pairIds.length; recipient += 1) {
      if (donor === recipient) continue;
      if (graph.edge[donor][recipient]) edges.push({ from: graph.pairIds[donor], to: graph.pairIds[recipient] });
    }
  }

  return {
    cycles: chosen,
    edges,
    reports,
    total: scorePacking(chosen, graph).total,
    socialTotal: scorePacking(social, graph).total,
    maxIntTotal: scorePacking(maxInt, graph).total,
    internalCycles,
  };
}

export function recipientOfDonor(cycle: Cycle, donorPairId: string): string {
  const index = cycle.pairIds.indexOf(donorPairId);
  return cycle.pairIds[(index + 1) % cycle.pairIds.length];
}

export function donorPairForRecipient(cycle: Cycle, recipientPairId: string): string {
  const index = cycle.pairIds.indexOf(recipientPairId);
  return cycle.pairIds[(index - 1 + cycle.pairIds.length) % cycle.pairIds.length];
}

