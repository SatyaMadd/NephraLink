export type BloodType = "O" | "A" | "B" | "AB";

export type Person = {
  name: string;
  age: number;
  sex: "F" | "M";
  blood: BloodType;
  hla: string;
};

export type Pair = {
  id: string;
  hospitalId: string;
  mrn: string;
  recipient: Person;
  donor: Person;
  relationship: string;
  /** Recipient rejects most donors and accepts only an identical blood type. */
  highlySensitized: boolean;
  /** Paired donor and recipient fail HLA even when ABO would allow a direct transplant. */
  pairedHlaIncompatible: boolean;
  /**
   * Teaching-pool pairs use an explicit crossmatch list.
   * Added or shuffled pairs use blood type plus the sensitization rule.
   */
  curated: boolean;
  allowedDonors: string[];
};

export type Hospital = {
  id: string;
  name: string;
  short: string;
  city: string;
  color: string;
};

/** Boolean crossmatch matrix. Names, MRNs, and HLA strings never enter the solver. */
export type CompatGraph = {
  pairIds: string[];
  hospitalOf: string[];
  donorBlood: BloodType[];
  recipientBlood: BloodType[];
  /** edge[donorIndex][recipientIndex] */
  edge: boolean[][];
};

export type Cycle = {
  key: string;
  pairIds: string[];
  /** Donor of pairIds[i] gives to the recipient of pairIds[(i + 1) % n]. */
  mask: number;
  shared: boolean;
  hospitalIds: string[];
};

export type Score = {
  total: number;
  quality: number;
  hard: number;
  key: string;
};

export type HospitalReport = {
  hospitalId: string;
  internalCount: number;
  exchangeCount: number;
  internalPairIds: string[];
  exchangePairIds: string[];
  onlyViaExchange: string[];
};

export type SolveResult = {
  cycles: Cycle[];
  edges: { from: string; to: string }[];
  reports: HospitalReport[];
  total: number;
  socialTotal: number;
  maxIntTotal: number;
  internalCycles: Record<string, Cycle[]>;
};
