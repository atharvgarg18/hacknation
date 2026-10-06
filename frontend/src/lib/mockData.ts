/**
 * Mock data generator for the SATARK graph visualization.
 * Generates realistic-looking transaction graph data with:
 * - 150-300 background "noise" nodes (normal traffic)
 * - Laundering chain patterns (fan-out → merge → cash-out)
 * - Bank-colored nodes with realistic token IDs
 */

import {
  BankId,
  GraphNode,
  GraphEdge,
  GraphData,
  Alert,
  AmountBand,
  ScoreBreakdown,
  BankStats,
  BANK_CONFIGS,
} from './types';

// ============================================
// Token Generator
// ============================================

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 't';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function randomBank(): BankId {
  const banks: BankId[] = ['axis', 'icici', 'hdfc'];
  return banks[Math.floor(Math.random() * banks.length)];
}

function randomAmountBand(): AmountBand {
  const bands: AmountBand[] = ['0-10K', '10K-50K', '50K-1L', '1L-5L', '5L-10L', '10L+'];
  const weights = [0.35, 0.3, 0.2, 0.1, 0.04, 0.01];
  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < bands.length; i++) {
    cumulative += weights[i];
    if (r < cumulative) return bands[i];
  }
  return bands[0];
}

function amountBandToWeight(band: AmountBand): number {
  const map: Record<AmountBand, number> = {
    '0-10K': 0.5,
    '10K-50K': 1,
    '50K-1L': 2,
    '1L-5L': 3,
    '5L-10L': 4,
    '10L+': 5,
  };
  return map[band];
}

// ============================================
// Background Noise Generator
// ============================================

function generateBackgroundNodes(count: number): GraphNode[] {
  const nodes: GraphNode[] = [];

  for (let i = 0; i < count; i++) {
    const bank = randomBank();
    const token = generateToken();
    nodes.push({
      id: token,
      bank,
      label: BANK_CONFIGS[bank].shortName,
      totalIn: Math.floor(Math.random() * 500000),
      totalOut: Math.floor(Math.random() * 500000),
      txCount: Math.floor(Math.random() * 20) + 1,
      riskScore: Math.floor(Math.random() * 25), // Low risk for normal nodes
      isFlagged: false,
    });
  }

  return nodes;
}

function generateBackgroundEdges(nodes: GraphNode[], edgeCount: number): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const now = Date.now();

  for (let i = 0; i < edgeCount; i++) {
    const sourceIdx = Math.floor(Math.random() * nodes.length);
    let targetIdx = Math.floor(Math.random() * nodes.length);
    while (targetIdx === sourceIdx) {
      targetIdx = Math.floor(Math.random() * nodes.length);
    }

    const source = nodes[sourceIdx];
    const target = nodes[targetIdx];
    const amountBand = randomAmountBand();

    edges.push({
      id: `e-${generateToken()}`,
      source: source.id,
      target: target.id,
      amountBand,
      timestamp: new Date(now - Math.random() * 3600000).toISOString(),
      sourceBank: source.bank,
      targetBank: target.bank,
      isFlagged: false,
    });
  }

  return edges;
}

// ============================================
// Laundering Chain Generator
// ============================================

export interface ChainConfig {
  entryBank: BankId;
  spreadBanks: BankId[];
  mergeBank: BankId;
  cashOutBank: BankId;
  spreadCount: number; // fan-out width (3-7)
  amountBand: AmountBand;
}

function generateLaunderingChain(config: ChainConfig): {
  nodes: GraphNode[];
  edges: GraphEdge[];
  chainId: string;
} {
  const chainId = `chain-${generateToken()}`;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const now = Date.now();

  // 1. Entry node (Bank A) — positioned at left of diamond
  const entryToken = generateToken();
  const entryNode: GraphNode = {
    id: entryToken,
    bank: config.entryBank,
    label: BANK_CONFIGS[config.entryBank].shortName,
    totalIn: 0,
    totalOut: 1500000,
    txCount: config.spreadCount,
    riskScore: 85,
    isFlagged: true,
    chainId,
    // Fixed position: left side of diamond
    fx: -60,
    fy: 0,
    fz: 0,
  };
  nodes.push(entryNode);

  // 2. Spread nodes (fan-out — multiple banks)
  const spreadTokens: string[] = [];
  for (let i = 0; i < config.spreadCount; i++) {
    const bank = config.spreadBanks[i % config.spreadBanks.length];
    const token = generateToken();
    spreadTokens.push(token);

    // Fan spread nodes vertically in the middle
    const spreadY = (i - (config.spreadCount - 1) / 2) * 30;
    const spreadZ = (i % 2 === 0 ? 1 : -1) * 15;
    nodes.push({
      id: token,
      bank,
      label: BANK_CONFIGS[bank].shortName,
      totalIn: Math.floor(1500000 / config.spreadCount),
      totalOut: Math.floor(1500000 / config.spreadCount),
      txCount: 2,
      riskScore: 72,
      isFlagged: true,
      chainId,
      fx: 0,
      fy: spreadY,
      fz: spreadZ,
    });

    // Edge: entry → spread
    edges.push({
      id: `e-${generateToken()}`,
      source: entryToken,
      target: token,
      amountBand: config.amountBand,
      timestamp: new Date(now - 600000 + i * 30000).toISOString(), // staggered by 30s
      sourceBank: config.entryBank,
      targetBank: bank,
      isFlagged: true,
      chainId,
    });
  }

  // 3. Merge node (fan-in — Bank C)
  const mergeToken = generateToken();
  nodes.push({
    id: mergeToken,
    bank: config.mergeBank,
    label: BANK_CONFIGS[config.mergeBank].shortName,
    totalIn: 1500000,
    totalOut: 1500000,
    txCount: config.spreadCount + 1,
    riskScore: 90,
    isFlagged: true,
    chainId,
    fx: 60,
    fy: 0,
    fz: 0,
  });

  for (const spreadToken of spreadTokens) {
    const spreadNode = nodes.find((n) => n.id === spreadToken)!;
    edges.push({
      id: `e-${generateToken()}`,
      source: spreadToken,
      target: mergeToken,
      amountBand: config.amountBand,
      timestamp: new Date(now - 300000 + Math.random() * 60000).toISOString(),
      sourceBank: spreadNode.bank,
      targetBank: config.mergeBank,
      isFlagged: true,
      chainId,
    });
  }

  // 4. Cash-out node (back to Bank A or exit)
  const cashOutToken = generateToken();
  nodes.push({
    id: cashOutToken,
    bank: config.cashOutBank,
    label: BANK_CONFIGS[config.cashOutBank].shortName,
    totalIn: 1500000,
    totalOut: 0,
    txCount: 1,
    riskScore: 88,
    isFlagged: true,
    chainId,
    fx: 100,
    fy: 0,
    fz: 0,
  });

  edges.push({
    id: `e-${generateToken()}`,
    source: mergeToken,
    target: cashOutToken,
    amountBand: '10L+',
    timestamp: new Date(now - 60000).toISOString(),
    sourceBank: config.mergeBank,
    targetBank: config.cashOutBank,
    isFlagged: true,
    chainId,
  });

  return { nodes, edges, chainId };
}

// ============================================
// Alert Generator
// ============================================

function generateAlert(
  chainId: string,
  chainNodes: GraphNode[],
  chainEdges: GraphEdge[],
  detectionTimeMs: number,
): Alert {
  const banksInvolved = [...new Set(chainNodes.map((n) => n.bank))];

  const breakdown: ScoreBreakdown[] = [
    { factor: 'Fast pass-through', points: 30, description: 'Money left within 2 minutes of arrival at intermediary accounts' },
    { factor: 'Fan-out pattern', points: 20, description: `Funds split into ${chainNodes.length - 2} separate channels` },
    { factor: 'Multi-bank hop', points: 15, description: `Transaction crossed ${banksInvolved.length} different banks` },
    { factor: 'Amount structuring', points: 12, description: 'Individual amounts kept below reporting threshold' },
    { factor: 'Rapid reconvergence', points: 15, description: 'All split funds merged back to single account within 10 minutes' },
  ];

  const totalScore = breakdown.reduce((sum, b) => sum + b.points, 0);

  const bankNames = banksInvolved.map((b) => BANK_CONFIGS[b].name);
  const summary = `Money entered at ${bankNames[0]}, was split ${chainNodes.length - 2} ways through ${bankNames.slice(1, -1).join(' and ')}, merged at ${bankNames[bankNames.length - 1]}, and returned to ${bankNames[0]}. Total transit time: 11 minutes.`;

  return {
    id: `alert-${generateToken()}`,
    chainId,
    score: Math.min(totalScore, 100),
    severity: totalScore > 75 ? 'critical' : totalScore > 50 ? 'high' : 'medium',
    banksInvolved,
    nodeCount: chainNodes.length,
    edgeCount: chainEdges.length,
    totalAmount: '₹15.0L',
    duration: '11 minutes',
    detectionTime: detectionTimeMs / 1000,
    summary,
    breakdown,
    chainNodeIds: chainNodes.map((n) => n.id),
    chainEdgeIds: chainEdges.map((e) => e.id),
    timestamp: new Date().toISOString(),
    status: 'active',
  };
}

// ============================================
// Main Generator
// ============================================

export function generateMockGraphData(options?: {
  backgroundNodeCount?: number;
  backgroundEdgeCount?: number;
  includeChain?: boolean;
}): {
  graphData: GraphData;
  alerts: Alert[];
  bankStats: BankStats[];
} {
  const bgNodeCount = options?.backgroundNodeCount ?? 220;
  const bgEdgeCount = options?.backgroundEdgeCount ?? 450;
  const includeChain = options?.includeChain ?? true;

  // Generate background noise
  const bgNodes = generateBackgroundNodes(bgNodeCount);
  const bgEdges = generateBackgroundEdges(bgNodes, bgEdgeCount);

  let allNodes = [...bgNodes];
  let allEdges = [...bgEdges];
  const alerts: Alert[] = [];

  if (includeChain) {
    // Generate primary laundering chain
    const chain1 = generateLaunderingChain({
      entryBank: 'axis',
      spreadBanks: ['icici', 'hdfc', 'icici', 'hdfc', 'icici'],
      mergeBank: 'hdfc',
      cashOutBank: 'axis',
      spreadCount: 5,
      amountBand: '1L-5L',
    });

    allNodes = [...allNodes, ...chain1.nodes];
    allEdges = [...allEdges, ...chain1.edges];

    alerts.push(generateAlert(chain1.chainId, chain1.nodes, chain1.edges, 4200));

    // Generate a secondary watch-level chain (lower score)
    const chain2 = generateLaunderingChain({
      entryBank: 'icici',
      spreadBanks: ['hdfc', 'axis'],
      mergeBank: 'axis',
      cashOutBank: 'icici',
      spreadCount: 2,
      amountBand: '50K-1L',
    });

    // Make chain2 lower risk (watch state)
    chain2.nodes.forEach((n) => {
      n.riskScore = Math.floor(n.riskScore * 0.55);
      n.isFlagged = false; // not yet flagged, just watched
    });
    chain2.edges.forEach((e) => {
      e.isFlagged = false;
    });

    allNodes = [...allNodes, ...chain2.nodes];
    allEdges = [...allEdges, ...chain2.edges];

    const watchAlert = generateAlert(chain2.chainId, chain2.nodes, chain2.edges, 8100);
    watchAlert.score = 41;
    watchAlert.severity = 'medium';
    watchAlert.status = 'investigating';
    alerts.push(watchAlert);
  }

  // Generate bank stats
  const bankStats: BankStats[] = (['axis', 'icici', 'hdfc'] as BankId[]).map((bank) => {
    const bankNodes = allNodes.filter((n) => n.bank === bank);
    const bankEdges = allEdges.filter((e) => e.sourceBank === bank);
    return {
      bank,
      totalTransactions: bankEdges.length,
      tokensSent: bankNodes.length,
      activeAlerts: alerts.filter((a) => a.banksInvolved.includes(bank) && a.status === 'active').length,
      riskScore: Math.max(...bankNodes.map((n) => n.riskScore)),
    };
  });

  return {
    graphData: { nodes: allNodes, links: allEdges },
    alerts,
    bankStats,
  };
}

/**
 * Generates a single new transaction for real-time simulation.
 * Call this on a timer to simulate live traffic.
 */
export function generateLiveTransaction(existingNodes: GraphNode[]): {
  node?: GraphNode;
  edge: GraphEdge;
} {
  const sourceIdx = Math.floor(Math.random() * existingNodes.length);
  const source = existingNodes[sourceIdx];

  // 80% chance to connect to existing node, 20% chance to create new one
  const createNewNode = Math.random() < 0.2;

  let targetNode: GraphNode;
  let newNode: GraphNode | undefined;

  if (createNewNode) {
    const bank = randomBank();
    const token = generateToken();
    targetNode = {
      id: token,
      bank,
      label: BANK_CONFIGS[bank].shortName,
      totalIn: 0,
      totalOut: 0,
      txCount: 0,
      riskScore: Math.floor(Math.random() * 15),
      isFlagged: false,
    };
    newNode = targetNode;
  } else {
    let targetIdx = Math.floor(Math.random() * existingNodes.length);
    while (targetIdx === sourceIdx) {
      targetIdx = Math.floor(Math.random() * existingNodes.length);
    }
    targetNode = existingNodes[targetIdx];
  }

  const amountBand = randomAmountBand();

  const edge: GraphEdge = {
    id: `e-${generateToken()}`,
    source: source.id,
    target: targetNode.id,
    amountBand,
    timestamp: new Date().toISOString(),
    sourceBank: source.bank,
    targetBank: targetNode.bank,
    isFlagged: false,
  };

  return { node: newNode, edge };
}
