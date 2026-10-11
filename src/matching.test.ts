import { HOSPITALS, teachingPairs, shuffledPairs, canGive, bloodCompatible } from "./data";
import { buildGraph, enumerateCycles, isRejectionProof, solve, recipientOfDonor } from "./matching";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const pairs = teachingPairs();
for (const pair of pairs) {
  for (const donorId of pair.allowedDonors) {
    const donor = pairs.find((item) => item.id === donorId);
    assert(!!donor, `missing donor ${donorId}`);
    assert(
      bloodCompatible(donor!.donor.blood, pair.recipient.blood),
      `${donorId} → ${pair.id} is ABO-illegal`,
    );
  }
}

const graph = buildGraph(pairs);
const cycles = enumerateCycles(graph);
console.log(`teaching cycles: ${cycles.length}`);
console.log(cycles.map((cycle) => `${cycle.pairIds.join("→")} (${cycle.shared ? "shared" : "internal"})`).join("\n"));

const started = Date.now();
const result = solve(graph);
console.log(`solve ${Date.now() - started}ms`);
console.log(
  result.reports
    .map((report) => `${report.hospitalId} ${report.internalCount} → ${report.exchangeCount} only=${report.onlyViaExchange.join(",")}`)
    .join("\n"),
);
console.log("chosen", result.cycles.map((cycle) => cycle.pairIds.join("→")).join(" | "));
console.log("totals", { rp: result.total, social: result.socialTotal, maxInt: result.maxIntTotal });

assert(isRejectionProof(result.cycles, cycles, graph), "proposal is not rejection-proof");
for (const report of result.reports) {
  assert(report.exchangeCount >= report.internalCount, `${report.hospitalId} loses transplants`);
}
assert(result.total === 8, `expected 8 transplants, got ${result.total}`);
assert(result.maxIntTotal < result.total, "MaxInt should trail MaxRP on the teaching pool");
assert(result.socialTotal === result.total, "social optimum should match MaxRP here");

const mercy = result.reports.find((report) => report.hospitalId === "mercy")!;
assert(mercy.internalCount === 1 && mercy.exchangeCount === 3, `mercy payoff ${mercy.internalCount}→${mercy.exchangeCount}`);
assert(mercy.onlyViaExchange.includes("m2") && mercy.onlyViaExchange.includes("m3"), "James and Priya should need the exchange");

const elenaCycle = result.cycles.find((cycle) => cycle.pairIds.includes("m1") && cycle.pairIds.length > 1);
assert(!!elenaCycle, "Elena should be in a shared cycle");
assert(recipientOfDonor(elenaCycle!, "m1") === "r1", "Elena's O donor should give to Noah, an O recipient");

const covered = new Set(result.cycles.flatMap((cycle) => cycle.pairIds));
assert(!covered.has("l3"), "Chris stays unmatched");
assert(result.cycles.some((cycle) => cycle.pairIds.length === 3), "missing a 3-cycle");

const forbidden = solve(graph, [elenaCycle!.key]);
const planKey = (solved: { cycles: { key: string }[] }) =>
  solved.cycles
    .map((cycle) => cycle.key)
    .sort()
    .join("|");
assert(planKey(forbidden) !== planKey(result), "rejecting Elena's cycle should recompute a different plan");
assert(
  isRejectionProof(
    forbidden.cycles,
    cycles.filter((cycle) => cycle.key !== elenaCycle!.key),
    graph,
  ),
  "recomputed plan should stay rejection-proof",
);
for (const report of forbidden.reports) {
  assert(report.exchangeCount >= report.internalCount, `${report.hospitalId} falls below internal after a rejection`);
}

for (let seed = 1; seed <= 8; seed += 1) {
  const sample = shuffledPairs(seed);
  const sampleGraph = buildGraph(sample);
  const t0 = Date.now();
  const solved = solve(sampleGraph);
  const ms = Date.now() - t0;
  console.log(`shuffle ${seed}: ${ms}ms cycles will be solved, total ${solved.total}, maxInt ${solved.maxIntTotal}, social ${solved.socialTotal}`);
  assert(ms < 2000, `shuffle ${seed} took ${ms}ms`);
  for (const report of solved.reports) {
    assert(report.exchangeCount >= report.internalCount, `seed ${seed} ${report.hospitalId} lost transplants`);
  }
  assert(solved.total <= solved.socialTotal, "RP exceeded the social optimum");
  assert(solved.maxIntTotal <= solved.socialTotal, "MaxInt exceeded the social optimum");
  assert(isRejectionProof(solved.cycles, enumerateCycles(sampleGraph), sampleGraph), `seed ${seed} not rejection-proof`);
}

assert(HOSPITALS.length === 3, "expected 3 hospitals");
assert(canGive(pairs[0], pairs[0]), "Elena should be directly compatible");

console.log("ok");
