import type { BloodType, Hospital, Pair } from "./types";

export const HOSPITALS: Hospital[] = [
  { id: "mercy", name: "Mercy General", short: "Mercy", city: "Allegheny", color: "#0f5fa8" },
  { id: "riverside", name: "Riverside Medical", short: "Riverside", city: "Cedar Bend", color: "#0c7a6e" },
  { id: "lakeside", name: "Lakeside Transplant", short: "Lakeside", city: "Harbor Point", color: "#a15c07" },
];

/**
 * Curated crossmatches. Each edge is donor pair → recipient pair.
 * Blood type is checked again in the compatibility function.
 * The interesting structure:
 * - Elena (Mercy, O donor, AB recipient) can transplant directly, but that spends an O kidney on AB.
 * - A 3-cycle sends her O kidney to Noah, an O recipient, and still transplants Elena.
 * - James (O recipient) and David (B recipient) are transplanted only through a second 3-cycle.
 */
const EDGES: [string, string][] = [
  ["m1", "m1"],
  ["r3", "r3"],
  ["l2", "l2"],
  ["m1", "r1"],
  ["r1", "m1"],
  ["l1", "r2"],
  ["r2", "m2"],
  ["m2", "l1"],
  ["r1", "m3"],
  ["l1", "m3"],
  ["m3", "m1"],
  ["m3", "r2"],
  ["m1", "l3"],
  ["r2", "l3"],
  ["l3", "m3"],
  ["l3", "m1"],
  ["l3", "r2"],
  ["l2", "l1"],
  ["l2", "m1"],
  ["m2", "r3"],
  ["r3", "m1"],
];

function donorsFor(recipientId: string): string[] {
  return EDGES.filter(([, recipient]) => recipient === recipientId).map(([donor]) => donor);
}

function pair(input: Omit<Pair, "allowedDonors" | "curated" | "mrn"> & { mrn?: string }): Pair {
  return {
    ...input,
    mrn: input.mrn ?? `MRN-${input.id.toUpperCase()}`,
    curated: true,
    allowedDonors: donorsFor(input.id),
  };
}

export function teachingPairs(): Pair[] {
  return [
    pair({
      id: "m1",
      hospitalId: "mercy",
      mrn: "MRN-441028",
      relationship: "Brother",
      highlySensitized: false,
      pairedHlaIncompatible: false,
      recipient: { name: "Elena Vasquez", age: 42, sex: "F", blood: "AB", hla: "A*02:01, B*35:01, DRB1*04:01" },
      donor: { name: "Mateo Vasquez", age: 39, sex: "M", blood: "O", hla: "A*01:01, B*08:01, DRB1*03:01" },
    }),
    pair({
      id: "m2",
      hospitalId: "mercy",
      mrn: "MRN-441106",
      relationship: "Spouse",
      highlySensitized: true,
      pairedHlaIncompatible: true,
      recipient: { name: "James Okonkwo", age: 55, sex: "M", blood: "O", hla: "A*30:01, B*42:01, DRB1*03:02" },
      donor: { name: "Ada Okonkwo", age: 51, sex: "F", blood: "B", hla: "A*23:01, B*07:02, DRB1*11:01" },
    }),
    pair({
      id: "m3",
      hospitalId: "mercy",
      mrn: "MRN-441177",
      relationship: "Brother",
      highlySensitized: true,
      pairedHlaIncompatible: true,
      recipient: { name: "Priya Shah", age: 33, sex: "F", blood: "A", hla: "A*11:01, B*52:01, DRB1*15:02" },
      donor: { name: "Rohan Shah", age: 36, sex: "M", blood: "A", hla: "A*24:02, B*40:06, DRB1*04:03" },
    }),
    pair({
      id: "r1",
      hospitalId: "riverside",
      mrn: "MRN-228014",
      relationship: "Mother",
      highlySensitized: true,
      pairedHlaIncompatible: true,
      recipient: { name: "Noah Kim", age: 28, sex: "M", blood: "O", hla: "A*33:03, B*44:03, DRB1*13:02" },
      donor: { name: "Grace Kim", age: 54, sex: "F", blood: "A", hla: "A*02:06, B*46:01, DRB1*09:01" },
    }),
    pair({
      id: "r2",
      hospitalId: "riverside",
      mrn: "MRN-228090",
      relationship: "Spouse",
      highlySensitized: false,
      pairedHlaIncompatible: true,
      recipient: { name: "Sofia Alvarez", age: 47, sex: "F", blood: "A", hla: "A*68:01, B*39:01, DRB1*16:02" },
      donor: { name: "Luis Alvarez", age: 49, sex: "M", blood: "O", hla: "A*26:01, B*38:01, DRB1*13:01" },
    }),
    pair({
      id: "r3",
      hospitalId: "riverside",
      mrn: "MRN-228144",
      relationship: "Spouse",
      highlySensitized: false,
      pairedHlaIncompatible: false,
      recipient: { name: "Hannah Brooks", age: 61, sex: "F", blood: "AB", hla: "A*03:01, B*14:02, DRB1*01:01" },
      donor: { name: "Owen Brooks", age: 58, sex: "M", blood: "AB", hla: "A*03:01, B*14:01, DRB1*01:02" },
    }),
    pair({
      id: "l1",
      hospitalId: "lakeside",
      mrn: "MRN-770312",
      relationship: "Sister",
      highlySensitized: false,
      pairedHlaIncompatible: true,
      recipient: { name: "David Chen", age: 44, sex: "M", blood: "B", hla: "A*11:01, B*15:02, DRB1*12:02" },
      donor: { name: "Mei Chen", age: 40, sex: "F", blood: "A", hla: "A*11:02, B*15:01, DRB1*12:01" },
    }),
    pair({
      id: "l2",
      hospitalId: "lakeside",
      mrn: "MRN-770355",
      relationship: "Spouse",
      highlySensitized: false,
      pairedHlaIncompatible: false,
      recipient: { name: "Amira Hassan", age: 36, sex: "F", blood: "B", hla: "A*32:01, B*49:01, DRB1*11:04" },
      donor: { name: "Samir Hassan", age: 38, sex: "M", blood: "B", hla: "A*32:01, B*51:01, DRB1*11:01" },
    }),
    pair({
      id: "l3",
      hospitalId: "lakeside",
      mrn: "MRN-770401",
      relationship: "Sister",
      highlySensitized: true,
      pairedHlaIncompatible: true,
      recipient: { name: "Chris Patel", age: 50, sex: "M", blood: "O", hla: "A*31:01, B*27:05, DRB1*04:04" },
      donor: { name: "Nina Patel", age: 47, sex: "F", blood: "O", hla: "A*31:01, B*57:01, DRB1*07:01" },
    }),
  ];
}

const FIRST = ["Maya", "Leon", "Imani", "Oscar", "Ruth", "Felix", "Nadia", "Hugo", "Celia", "Ivan", "Willa", "Omar"];
const LAST = ["Nguyen", "Berg", "Diallo", "Costa", "Walsh", "Ibrahim", "Petrov", "Singh", "Moreau", "Keller", "Abebe", "Rossi"];
const HLA_ALLELES = ["A*02:01", "A*03:01", "A*24:02", "B*07:02", "B*44:02", "B*51:01", "DRB1*04:01", "DRB1*07:01", "DRB1*15:01"];

export function bloodCompatible(donor: BloodType, recipient: BloodType): boolean {
  if (donor === "O") return true;
  if (donor === "A") return recipient === "A" || recipient === "AB";
  if (donor === "B") return recipient === "B" || recipient === "AB";
  return recipient === "AB";
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function weightedBlood(rng: () => number): BloodType {
  const x = rng();
  if (x < 0.46) return "O";
  if (x < 0.86) return "A";
  if (x < 0.96) return "B";
  return "AB";
}

function hlaString(rng: () => number): string {
  const copy = [...HLA_ALLELES];
  const chosen: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const index = Math.floor(rng() * copy.length);
    chosen.push(copy.splice(index, 1)[0]);
  }
  return chosen.join(", ");
}

/** A fresh 9-pair pool. Crossmatches follow blood type, sensitization, and a random HLA block. */
export function shuffledPairs(seed: number): Pair[] {
  const rng = mulberry32(seed);
  const used = new Set<string>();
  const pairs: Pair[] = [];
  let n = 0;
  for (const hospital of HOSPITALS) {
    for (let k = 0; k < 3; k += 1) {
      n += 1;
      let recipientName = "";
      let donorName = "";
      do {
        recipientName = `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
      } while (used.has(recipientName));
      used.add(recipientName);
      do {
        donorName = `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
      } while (used.has(donorName));
      used.add(donorName);
      const recipientBlood = weightedBlood(rng);
      const donorBlood = weightedBlood(rng);
      const aboOk = bloodCompatible(donorBlood, recipientBlood);
      const pairedHlaIncompatible = aboOk ? rng() < 0.55 : true;
      pairs.push({
        id: `s${n}`,
        hospitalId: hospital.id,
        mrn: `MRN-${seed}-${n}`,
        relationship: pick(rng, ["Spouse", "Sibling", "Parent", "Friend"]),
        highlySensitized: rng() < 0.5,
        pairedHlaIncompatible,
        curated: false,
        allowedDonors: [],
        recipient: {
          name: recipientName,
          age: 25 + Math.floor(rng() * 40),
          sex: rng() < 0.5 ? "F" : "M",
          blood: recipientBlood,
          hla: hlaString(rng),
        },
        donor: {
          name: donorName,
          age: 25 + Math.floor(rng() * 40),
          sex: rng() < 0.5 ? "F" : "M",
          blood: donorBlood,
          hla: hlaString(rng),
        },
      });
    }
  }
  // Extra random HLA failures so a shuffled pool stays sparse enough to solve quickly.
  for (const recipient of pairs) {
    const blocked = pairs
      .filter((donor) => donor.id !== recipient.id && rng() < 0.45)
      .map((donor) => donor.id);
    recipient.curated = true;
    recipient.allowedDonors = pairs
      .filter((donor) => {
        if (!bloodCompatible(donor.donor.blood, recipient.recipient.blood)) return false;
        if (donor.id === recipient.id) return !recipient.pairedHlaIncompatible;
        if (blocked.includes(donor.id)) return false;
        if (recipient.highlySensitized && donor.donor.blood !== recipient.recipient.blood) return false;
        return true;
      })
      .map((donor) => donor.id);
  }
  return pairs;
}

export function canGive(donorPair: Pair, recipientPair: Pair): boolean {
  if (!bloodCompatible(donorPair.donor.blood, recipientPair.recipient.blood)) return false;
  if (donorPair.curated && recipientPair.curated) {
    return recipientPair.allowedDonors.includes(donorPair.id);
  }
  if (donorPair.id === recipientPair.id) return !recipientPair.pairedHlaIncompatible;
  if (recipientPair.highlySensitized) {
    return donorPair.donor.blood === recipientPair.recipient.blood;
  }
  return true;
}

export function selfCompatible(pair: Pair): boolean {
  return canGive(pair, pair);
}

let customSerial = 1;

export function createPairId(): string {
  customSerial += 1;
  return `c${customSerial}`;
}
