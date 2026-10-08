/**
 * Model Lab — Precomputed Synthetic Federated Learning Data
 *
 * Deterministic. No live training. Everything a judge sees on screen
 * comes from here: embeddings, metrics, update norms, AUC curves.
 *
 * Honest limits (always shown on-screen):
 *   • Synthetic data, simulated attacker.
 *   • Galaxy = model's learned map in 2D projection (approximate).
 *   • Explanations = estimated influence, not ground truth.
 *   • "Behaviour, not identity" = no names/KYC; behaviour features
 *     can still correlate with demographics — features listed explicitly.
 */

// ============================================
// Seeded PRNG (reuse pattern from engine.ts)
// ============================================

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================
// Types
// ============================================

export type BankKey = 'axis' | 'icici' | 'hdfc' | 'sbi';
export type AccountClass = 'normal' | 'fraud' | 'mule';
export type RingType = 'fan-out' | 'cycle' | 'slow-drip' | 'chain';

export interface EmbeddingPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  cls: AccountClass;
  bank: BankKey;
  ringType?: RingType;
  riskScore: number;
  velocity: number;
  passThroughRatio: number;
  burstCount: number;
  timeToForward: number;
  inDegree: number;
  outDegree: number;
}

export interface TrainingFrame {
  epoch: number;
  bank: BankKey;
  loss: number;
  auc: number;
  embeddings: EmbeddingPoint[];
}

export interface FedRound {
  round: number;
  bankUpdates: {
    bank: BankKey;
    norm: number;
    similarity: number;
    poisoned: boolean;
  }[];
  globalAuc: number;
  fraudNormalSeparation: number;
  localAucs: Record<BankKey, number>;
  federatedAuc: number;
  ringRecall: {
    type: RingType;
    localRecall: number;
    fedRecall: number;
  }[];
  embeddings: EmbeddingPoint[];
}

export interface BehaviourTrail {
  accountId: string;
  bank: BankKey;
  cls: AccountClass;
  frames: {
    hour: number;
    x: number;
    y: number;
    z: number;
    velocity: number;
    passThroughRatio: number;
    burstCount: number;
    riskScore: number;
  }[];
}

export interface ArchetypeCard {
  id: string;
  label: string;
  ringType: RingType;
  memberIds: string[];
  radar: {
    velocity: number;
    passThroughRatio: number;
    burstCount: number;
    timeToForward: number;
    inDegree: number;
    outDegree: number;
  };
  exampleSubgraph: { from: string; to: string; weight: number }[];
  plainReason: string;
}

// ============================================
// Helpers
// ============================================

function gaussian(rng: () => number, mean = 0, std = 1): number {
  const u1 = Math.max(1e-10, rng());
  const u2 = rng();
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ============================================
// Reference set — 600 accounts, stable IDs
// ============================================

const BANKS: BankKey[] = ['axis', 'icici', 'hdfc', 'sbi'];
const RING_TYPES: RingType[] = ['fan-out', 'cycle', 'slow-drip', 'chain'];

const BANK_RING_BIAS: Record<BankKey, RingType[]> = {
  axis:  ['fan-out', 'chain'],
  icici: ['chain', 'slow-drip'],
  hdfc:  ['slow-drip', 'fan-out'],
  sbi:   ['cycle', 'chain'],
};

const CLUSTER_CENTRES: Record<string, [number, number]> = {
  normal:           [0.0, 0.0],
  fraud_fan_out:    [3.5, 1.5],
  'fraud_cycle':    [2.0, 3.8],
  'fraud_slow-drip': [-2.5, 3.2],
  fraud_chain:      [1.0, 4.5],
  mule:             [1.5, 1.0],
};

function makeEmbeddingPoint(
  id: string,
  bank: BankKey,
  cls: AccountClass,
  ringType: RingType | undefined,
  round: number,
  rng: () => number
): EmbeddingPoint {
  const key = cls === 'normal' ? 'normal'
    : cls === 'mule' ? 'mule'
    : `fraud_${ringType ?? 'chain'}`;
  const [cx, cy] = CLUSTER_CENTRES[key] ?? [0, 0];

  const pull = clamp(round / 5, 0, 1);
  const noise = 2.5 * (1 - pull * 0.7);

  const x = cx * pull + gaussian(rng, 0, noise);
  const y = cy * pull + gaussian(rng, 0, noise);
  const z = gaussian(rng, 0, 0.3);

  const isFraud = cls === 'fraud';
  const velocity = isFraud
    ? clamp(gaussian(rng, 18, 5), 5, 40)
    : clamp(gaussian(rng, 4, 2), 0.5, 15);
  const passThroughRatio = isFraud
    ? clamp(gaussian(rng, 0.92, 0.05), 0.7, 1)
    : clamp(gaussian(rng, 0.4, 0.2), 0, 0.85);
  const burstCount = isFraud
    ? clamp(Math.floor(gaussian(rng, 8, 3)), 2, 20)
    : clamp(Math.floor(gaussian(rng, 1.5, 1)), 0, 6);
  const timeToForward = isFraud
    ? clamp(gaussian(rng, 2, 1.5), 0.2, 8)
    : clamp(gaussian(rng, 45, 20), 5, 120);
  const inDegree = isFraud
    ? clamp(Math.floor(gaussian(rng, 5, 2)), 1, 12)
    : clamp(Math.floor(gaussian(rng, 2, 1)), 1, 8);
  const outDegree = isFraud
    ? clamp(Math.floor(gaussian(rng, 7, 3)), 2, 20)
    : clamp(Math.floor(gaussian(rng, 2, 1)), 1, 8);

  const riskScore = isFraud
    ? clamp(0.5 + pull * 0.4 + gaussian(rng, 0, 0.05), 0, 1)
    : clamp(gaussian(rng, 0.12, 0.08), 0, 0.4);

  return {
    id, x, y, z, cls, bank, ringType,
    riskScore, velocity, passThroughRatio,
    burstCount, timeToForward, inDegree, outDegree,
  };
}

function buildReferenceSet() {
  const r = mulberry32(42);
  const accounts: { id: string; bank: BankKey; cls: AccountClass; ringType?: RingType }[] = [];
  let idx = 0;

  for (const bank of BANKS) {
    const fraudTypes = BANK_RING_BIAS[bank];
    for (let i = 0; i < 110; i++) {
      accounts.push({ id: `acc-${bank}-n${idx++}`, bank, cls: 'normal' });
    }
    for (let i = 0; i < 25; i++) {
      const rt = fraudTypes[Math.floor(r() * fraudTypes.length)];
      accounts.push({ id: `acc-${bank}-f${idx++}`, bank, cls: 'fraud', ringType: rt });
    }
    for (let i = 0; i < 15; i++) {
      accounts.push({ id: `acc-${bank}-m${idx++}`, bank, cls: 'mule' });
    }
  }
  return accounts;
}

const REFERENCE_SET = buildReferenceSet();

// ============================================
// Local training frames per bank (epochs 0–10)
// ============================================

const BANK_LOCAL_AUC_CURVE: Record<BankKey, number[]> = {
  axis:  [0.52, 0.61, 0.70, 0.76, 0.80, 0.82],
  icici: [0.51, 0.59, 0.67, 0.73, 0.77, 0.80],
  hdfc:  [0.53, 0.62, 0.71, 0.75, 0.79, 0.81],
  sbi:   [0.50, 0.58, 0.65, 0.71, 0.75, 0.78],
};
const BANK_LOCAL_LOSS_CURVE: Record<BankKey, number[]> = {
  axis:  [0.69, 0.58, 0.48, 0.40, 0.34, 0.30],
  icici: [0.70, 0.60, 0.50, 0.43, 0.37, 0.33],
  hdfc:  [0.68, 0.57, 0.46, 0.39, 0.33, 0.29],
  sbi:   [0.71, 0.62, 0.53, 0.45, 0.40, 0.36],
};

export function buildLocalTrainingFrames(): TrainingFrame[] {
  const frames: TrainingFrame[] = [];
  const r = mulberry32(1);
  const EPOCHS = [0, 2, 4, 6, 8, 10];

  for (const bank of BANKS) {
    for (let ei = 0; ei < EPOCHS.length; ei++) {
      const epoch = EPOCHS[ei];
      const round = (ei / (EPOCHS.length - 1)) * 3;

      const bankAccounts = REFERENCE_SET.filter((a) => a.bank === bank);
      const embeddings = bankAccounts.map((a) =>
        makeEmbeddingPoint(a.id, a.bank, a.cls, a.ringType, round, r)
      );

      frames.push({
        epoch,
        bank,
        loss: BANK_LOCAL_LOSS_CURVE[bank][ei] + gaussian(r, 0, 0.005),
        auc: BANK_LOCAL_AUC_CURVE[bank][ei] + gaussian(r, 0, 0.003),
        embeddings,
      });
    }
  }
  return frames;
}

// ============================================
// Federated rounds (1–5)
// ============================================

const FED_GLOBAL_AUC: number[] = [0.83, 0.87, 0.90, 0.92, 0.94];
const FED_SEPARATION: number[] = [0.41, 0.55, 0.66, 0.74, 0.80];

const LOCAL_AUC_AT_ROUND: Record<BankKey, number[]> = {
  axis:  [0.82, 0.83, 0.84, 0.84, 0.85],
  icici: [0.80, 0.81, 0.82, 0.83, 0.83],
  hdfc:  [0.81, 0.82, 0.83, 0.83, 0.84],
  sbi:   [0.78, 0.80, 0.81, 0.82, 0.83],
};

const RING_RECALL_LOCAL: Record<BankKey, Record<RingType, number[]>> = {
  axis:  { 'fan-out': [0.78,0.80,0.82,0.83,0.84], 'cycle': [0.20,0.22,0.24,0.25,0.26], 'slow-drip': [0.30,0.32,0.34,0.35,0.36], 'chain': [0.70,0.72,0.74,0.75,0.76] },
  icici: { 'fan-out': [0.35,0.36,0.38,0.39,0.40], 'cycle': [0.28,0.30,0.31,0.32,0.33], 'slow-drip': [0.72,0.74,0.76,0.77,0.78], 'chain': [0.75,0.77,0.79,0.80,0.81] },
  hdfc:  { 'fan-out': [0.65,0.67,0.69,0.70,0.71], 'cycle': [0.22,0.24,0.25,0.26,0.27], 'slow-drip': [0.73,0.75,0.76,0.77,0.78], 'chain': [0.40,0.42,0.43,0.44,0.45] },
  sbi:   { 'fan-out': [0.30,0.31,0.32,0.33,0.34], 'cycle': [0.80,0.82,0.83,0.84,0.85], 'slow-drip': [0.35,0.36,0.37,0.38,0.39], 'chain': [0.72,0.74,0.75,0.76,0.77] },
};

const RING_RECALL_FED: Record<RingType, number[]> = {
  'fan-out':   [0.80, 0.85, 0.89, 0.91, 0.93],
  'cycle':     [0.72, 0.80, 0.87, 0.90, 0.92],
  'slow-drip': [0.75, 0.82, 0.87, 0.90, 0.92],
  'chain':     [0.78, 0.83, 0.88, 0.91, 0.93],
};

export function buildFedRounds(): FedRound[] {
  const r = mulberry32(2);
  const rounds: FedRound[] = [];

  for (let round = 1; round <= 5; round++) {
    const ri = round - 1;
    const poisonedBank: BankKey | null = round === 3 ? 'axis' : null;

    const bankUpdates = BANKS.map((bank) => {
      const poisoned = bank === poisonedBank;
      const norm = poisoned
        ? 4.2 + gaussian(r, 0, 0.3)
        : 1.0 + gaussian(r, 0, 0.15) + ri * 0.05;
      const similarity = poisoned
        ? 0.12 + gaussian(r, 0, 0.04)
        : 0.72 + ri * 0.04 + gaussian(r, 0, 0.03);
      return { bank, norm: clamp(norm, 0.3, 6), similarity: clamp(similarity, 0, 1), poisoned };
    });

    const embeddings = REFERENCE_SET.map((a) =>
      makeEmbeddingPoint(a.id, a.bank, a.cls, a.ringType, round, r)
    );

    const localAucs: Record<BankKey, number> = {} as Record<BankKey, number>;
    for (const bank of BANKS) {
      localAucs[bank] = LOCAL_AUC_AT_ROUND[bank][ri] + gaussian(r, 0, 0.005);
    }

    const ringRecall = RING_TYPES.map((type) => ({
      type,
      localRecall: BANKS.reduce((s, b) => s + RING_RECALL_LOCAL[b][type][ri], 0) / 4,
      fedRecall: RING_RECALL_FED[type][ri],
    }));

    rounds.push({
      round,
      bankUpdates,
      globalAuc: FED_GLOBAL_AUC[ri] + gaussian(r, 0, 0.004),
      fraudNormalSeparation: FED_SEPARATION[ri],
      localAucs,
      federatedAuc: FED_GLOBAL_AUC[ri],
      ringRecall,
      embeddings,
    });
  }
  return rounds;
}

// ============================================
// Knowledge transfer demo (Act 4)
// ============================================

export interface KnowledgeTransferDemo {
  bank: BankKey;
  ringType: RingType;
  accountIds: string[];
  before: EmbeddingPoint[];
  after: EmbeddingPoint[];
  localRecall: number;
  fedRecall: number;
}

export function buildKnowledgeTransferDemo(): KnowledgeTransferDemo {
  const r = mulberry32(99);
  const cycleAccounts = REFERENCE_SET.filter(
    (a) => a.bank === 'axis' && a.cls === 'fraud' && a.ringType === 'cycle'
  );

  const before = cycleAccounts.map((a) =>
    makeEmbeddingPoint(a.id, a.bank, a.cls, a.ringType, 0.2, r)
  );
  const after = cycleAccounts.map((a) =>
    makeEmbeddingPoint(a.id, a.bank, a.cls, a.ringType, 3.5, r)
  );

  return {
    bank: 'axis',
    ringType: 'cycle',
    accountIds: cycleAccounts.map((a) => a.id),
    before,
    after,
    localRecall: 0.22,
    fedRecall: 0.90,
  };
}

// ============================================
// Behaviour trails (Act 5)
// ============================================

export function buildBehaviourTrails(): BehaviourTrail[] {
  const r = mulberry32(7);
  const trails: BehaviourTrail[] = [];

  const muleFrames = [];
  for (let hour = 0; hour <= 24; hour++) {
    const progress = hour / 24;
    muleFrames.push({
      hour,
      x: 1.5 * progress + gaussian(r, 0, 0.2),
      y: 1.0 * progress + gaussian(r, 0, 0.2),
      z: gaussian(r, 0, 0.1),
      velocity: clamp(2 + progress * 16, 1, 20),
      passThroughRatio: clamp(0.3 + progress * 0.6, 0.2, 1),
      burstCount: Math.floor(1 + progress * 7),
      riskScore: clamp(0.1 + progress * 0.8, 0, 1),
    });
  }
  trails.push({ accountId: 'acc-axis-m0', bank: 'axis', cls: 'mule', frames: muleFrames });

  const attackerFrames = [];
  for (let hour = 0; hour <= 10; hour++) {
    const postUpdate = hour >= 6;
    attackerFrames.push({
      hour,
      x: (postUpdate ? 2.5 : -0.5) + gaussian(r, 0, 0.25),
      y: (postUpdate ? 3.5 : 0.3) + gaussian(r, 0, 0.25),
      z: gaussian(r, 0, 0.1),
      velocity: clamp(8 + hour * 0.5, 5, 15),
      passThroughRatio: clamp(0.6 + hour * 0.03, 0.5, 0.95),
      burstCount: 3 + (hour > 5 ? 2 : 0),
      riskScore: postUpdate ? clamp(0.7 + hour * 0.02, 0.65, 0.95) : clamp(0.25 + hour * 0.02, 0.2, 0.45),
    });
  }
  trails.push({ accountId: 'acc-sbi-evader', bank: 'sbi', cls: 'fraud', frames: attackerFrames });

  return trails;
}

// ============================================
// Archetype cards (Act 6)
// ============================================

export function buildArchetypeCards(): ArchetypeCard[] {
  return [
    {
      id: 'arc-fan-out',
      label: 'Rapid Fan-Out',
      ringType: 'fan-out',
      memberIds: REFERENCE_SET.filter((a) => a.cls === 'fraud' && a.ringType === 'fan-out').map((a) => a.id),
      radar: { velocity: 0.9, passThroughRatio: 0.95, burstCount: 0.85, timeToForward: 0.9, inDegree: 0.3, outDegree: 0.95 },
      exampleSubgraph: [
        { from: 'A', to: 'B', weight: 0.8 }, { from: 'A', to: 'C', weight: 0.8 },
        { from: 'A', to: 'D', weight: 0.8 }, { from: 'B', to: 'E', weight: 0.9 },
        { from: 'C', to: 'E', weight: 0.9 }, { from: 'D', to: 'E', weight: 0.9 },
      ],
      plainReason: 'Funds split into 5+ channels within seconds, reconverged at exit in <2 min.',
    },
    {
      id: 'arc-cycle',
      label: 'Round-Trip Cycle',
      ringType: 'cycle',
      memberIds: REFERENCE_SET.filter((a) => a.cls === 'fraud' && a.ringType === 'cycle').map((a) => a.id),
      radar: { velocity: 0.7, passThroughRatio: 0.8, burstCount: 0.5, timeToForward: 0.6, inDegree: 0.7, outDegree: 0.7 },
      exampleSubgraph: [
        { from: 'A', to: 'B', weight: 0.7 }, { from: 'B', to: 'C', weight: 0.7 },
        { from: 'C', to: 'A', weight: 0.7 },
      ],
      plainReason: 'Money cycles A→B→C→A to obscure origin; loop detected via graph structure.',
    },
    {
      id: 'arc-slow-drip',
      label: 'Slow Drip',
      ringType: 'slow-drip',
      memberIds: REFERENCE_SET.filter((a) => a.cls === 'fraud' && a.ringType === 'slow-drip').map((a) => a.id),
      radar: { velocity: 0.2, passThroughRatio: 0.75, burstCount: 0.15, timeToForward: 0.15, inDegree: 0.5, outDegree: 0.5 },
      exampleSubgraph: [
        { from: 'A', to: 'B', weight: 0.3 }, { from: 'A', to: 'B', weight: 0.3 },
        { from: 'A', to: 'B', weight: 0.3 },
      ],
      plainReason: 'Small, infrequent transfers over days to stay under thresholds; detected by timing variance.',
    },
    {
      id: 'arc-chain',
      label: 'Chain Pass-Through',
      ringType: 'chain',
      memberIds: REFERENCE_SET.filter((a) => a.cls === 'fraud' && a.ringType === 'chain').map((a) => a.id),
      radar: { velocity: 0.75, passThroughRatio: 0.98, burstCount: 0.6, timeToForward: 0.8, inDegree: 0.4, outDegree: 0.9 },
      exampleSubgraph: [
        { from: 'A', to: 'B', weight: 0.9 }, { from: 'B', to: 'C', weight: 0.9 },
        { from: 'C', to: 'D', weight: 0.9 }, { from: 'D', to: 'E', weight: 0.9 },
      ],
      plainReason: 'Linear chain; each account forwards ≥95% of received funds within minutes.',
    },
  ];
}

// ============================================
// Feature list (Act 1 — no names/KYC)
// ============================================

export const BEHAVIOUR_FEATURES = [
  { name: 'velocity',         label: 'Transaction velocity',  unit: 'txns/hr' },
  { name: 'passThroughRatio', label: 'Pass-through ratio',    unit: 'out÷in'  },
  { name: 'burstCount',       label: 'Burst event count',     unit: 'count'   },
  { name: 'timeToForward',    label: 'Time to forward',       unit: 'minutes' },
  { name: 'inDegree',         label: 'In-degree (graph)',     unit: 'edges'   },
  { name: 'outDegree',        label: 'Out-degree (graph)',    unit: 'edges'   },
];

// ============================================
// "Beat the model" live risk scorer
// ============================================

export interface AttackerConfig {
  hops: number;
  splitFactor: number;
  delayHours: number;
  muleAge: number;
  crossBankRouting: boolean;
}

export function computeAttackerRisk(cfg: AttackerConfig): {
  riskScore: number;
  galaxyX: number;
  galaxyY: number;
  detectedAfterUpdate: boolean;
} {
  const r2 = mulberry32(cfg.hops * 17 + cfg.splitFactor * 31);
  const hopPenalty    = Math.min(cfg.hops / 8, 1) * 0.3;
  const splitPenalty  = Math.min(cfg.splitFactor / 6, 1) * 0.25;
  const delayBonus    = Math.min(cfg.delayHours / 72, 1) * 0.2;
  const muleBonus     = Math.min(cfg.muleAge / 90, 1) * 0.15;
  const crossPenalty  = cfg.crossBankRouting ? 0.1 : 0;

  const risk = clamp(0.85 - hopPenalty - splitPenalty + delayBonus + muleBonus - crossPenalty, 0.1, 0.98);
  const pull = risk;
  const galaxyX = pull * 2.5 + gaussian(r2, 0, 0.3);
  const galaxyY = pull * 3.0 + gaussian(r2, 0, 0.3);

  return {
    riskScore: risk,
    galaxyX,
    galaxyY,
    detectedAfterUpdate: risk > 0.35 || cfg.crossBankRouting,
  };
}

// ============================================
// Lazy cache
// ============================================

let _localFrames: TrainingFrame[] | null = null;
let _fedRounds: FedRound[] | null = null;
let _ktDemo: KnowledgeTransferDemo | null = null;
let _trails: BehaviourTrail[] | null = null;
let _archetypes: ArchetypeCard[] | null = null;

export const getLocalTrainingFrames = () => (_localFrames ??= buildLocalTrainingFrames());
export const getFedRounds = () => (_fedRounds ??= buildFedRounds());
export const getKnowledgeTransferDemo = () => (_ktDemo ??= buildKnowledgeTransferDemo());
export const getBehaviourTrails = () => (_trails ??= buildBehaviourTrails());
export const getArchetypeCards = () => (_archetypes ??= buildArchetypeCards());
