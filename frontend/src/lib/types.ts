/**
 * Shared type definitions for the SATARK AML system.
 * These types define the data contracts between frontend, backend, and edge nodes.
 */

// ============================================
// Bank Identity
// ============================================

export type BankId = 'axis' | 'icici' | 'hdfc' | 'sbi';

export interface BankConfig {
  id: BankId;
  name: string;
  shortName: string;
  color: {
    primary: string;
    secondary: string;
    accent: string;
    gradient: [string, string];
  };
}

export const BANK_CONFIGS: Record<BankId, BankConfig> = {
  axis: {
    id: 'axis',
    name: 'Axis Bank',
    shortName: 'AX',
    color: {
      primary: '#97144d',
      secondary: '#c91e5e',
      accent: '#ff2d78',
      gradient: ['#97144d', '#c91e5e'],
    },
  },
  icici: {
    id: 'icici',
    name: 'ICICI Bank',
    shortName: 'IC',
    color: {
      primary: '#f37021',
      secondary: '#ff8c42',
      accent: '#ffaa00',
      gradient: ['#f37021', '#ff8c42'],
    },
  },
  hdfc: {
    id: 'hdfc',
    name: 'HDFC Bank',
    shortName: 'HD',
    color: {
      primary: '#004c8f',
      secondary: '#0284c7',
      accent: '#0066cc',
      gradient: ['#004c8f', '#0284c7'],
    },
  },
  sbi: {
    id: 'sbi',
    name: 'State Bank of India',
    shortName: 'SB',
    color: {
      primary: '#1a237e',
      secondary: '#3949ab',
      accent: '#5c6bc0',
      gradient: ['#1a237e', '#3949ab'],
    },
  },
};

// ============================================
// Transaction Types (Raw — inside bank only)
// ============================================

export interface RawTransaction {
  id: string;
  senderName: string;
  senderAccount: string;
  receiverName: string;
  receiverAccount: string;
  amount: number;
  currency: 'INR';
  timestamp: string; // ISO 8601
  channel: 'UPI' | 'NEFT' | 'RTGS' | 'IMPS';
  bank: BankId;
  status: 'completed' | 'pending' | 'failed';
}

// ============================================
// Tokenized Transaction (Shared with coordinator)
// ============================================

export type AmountBand = '0-10K' | '10K-50K' | '50K-1L' | '1L-5L' | '5L-10L' | '10L+';

export interface TokenizedTransaction {
  id: string;
  senderToken: string;  // e.g., "t7f3a"
  receiverToken: string; // e.g., "k2m9x"
  amountBand: AmountBand;
  timeWindow: string;    // e.g., "2024-03-15T14:00-14:15"
  sourceBank: BankId;
  destinationBank: BankId;
  timestamp: string;
  riskScore: number;     // 0-100 from edge node
}

// ============================================
// Graph Node & Edge Types (for visualization)
// ============================================

export interface GraphNode {
  id: string;         // token ID
  bank: BankId;
  label: string;      // short display label
  totalIn: number;    // total amount received (for display)
  totalOut: number;   // total amount sent (for display)
  txCount: number;    // number of transactions
  riskScore: number;  // 0-100
  isFlagged: boolean;
  chainId?: string;   // which alert chain this belongs to
  // 3d-force-graph position fields (assigned by physics engine)
  x?: number;
  y?: number;
  z?: number;
  fx?: number; // fixed position (for pinning)
  fy?: number;
  fz?: number;
}

export interface GraphEdge {
  id: string;
  source: string;     // source node ID (token)
  target: string;     // target node ID (token)
  amountBand: AmountBand;
  timestamp: string;
  sourceBank: BankId;
  targetBank: BankId;
  isFlagged: boolean;
  chainId?: string;
  animationProgress?: number; // 0-1 for edge appearance animation
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphEdge[];
}

// ============================================
// Alert Types
// ============================================

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ScoreBreakdown {
  factor: string;        // e.g., "fast pass-through"
  points: number;        // e.g., 30
  description: string;   // e.g., "Money left within 2 minutes of arrival"
}

export interface Alert {
  id: string;
  chainId: string;
  score: number;          // 0-100
  severity: AlertSeverity;
  banksInvolved: BankId[];
  nodeCount: number;
  edgeCount: number;
  totalAmount: string;    // formatted, e.g., "₹12.5L"
  duration: string;       // e.g., "11 minutes"
  detectionTime: number;  // seconds, e.g., 4.2
  summary: string;        // plain English: "Money entered at Axis, split five ways at ICICI..."
  breakdown: ScoreBreakdown[];
  chainNodeIds: string[];
  chainEdgeIds: string[];
  timestamp: string;
  status: 'active' | 'investigating' | 'resolved' | 'dismissed';
}

// ============================================
// Privacy Proof Types
// ============================================

export interface PrivacyField {
  fieldName: string;
  keptInside: boolean;
  sharedOutside: boolean;
  count: number;  // how many times shared (should be 0 for private fields)
}

export interface BankPrivacyProof {
  bank: BankId;
  tokensSent: number;
  fields: PrivacyField[];
}

// ============================================
// Simulator Types
// ============================================

export type AttackPattern = 'fan-out-fan-in' | 'chain' | 'cycle' | 'rapid-pass-through';

export interface SimulationConfig {
  normalTrafficRate: number;   // transactions per second
  attackEnabled: boolean;
  attackPattern: AttackPattern;
  attackHops: number;          // number of intermediate accounts
  attackBanks: BankId[];       // which banks involved
  attackAmount: number;        // total amount to launder
  falsePositiveTest: boolean;  // inject busy merchant + salary patterns
  speedMultiplier: number;     // 0.5x to 5x
}

// ============================================
// WebSocket Event Types
// ============================================

export type WSEventType =
  | 'transaction'
  | 'alert'
  | 'alert_update'
  | 'graph_update'
  | 'detection'
  | 'simulation_status'
  | 'bank_stats';

export interface WSEvent<T = unknown> {
  type: WSEventType;
  payload: T;
  timestamp: string;
}

export interface BankStats {
  bank: BankId;
  totalTransactions: number;
  tokensSent: number;
  activeAlerts: number;
  riskScore: number;
}

// ============================================
// STR (Suspicious Transaction Report) Types
// ============================================

export interface STRDraft {
  id: string;
  alertId: string;
  generatedAt: string;
  reportType: 'STR' | 'CTR';
  principalOfficer: string;
  summary: string;
  transactionDetails: TokenizedTransaction[];
  chainVisualizationUrl?: string;
  status: 'draft' | 'submitted' | 'acknowledged';
}

// ============================================
// Hold Request Types
// ============================================

export interface HoldRequest {
  id: string;
  alertId: string;
  accountToken: string;
  bank: BankId;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending_approval' | 'approved' | 'denied' | 'expired';
  approvedBy?: string;
  approvedAt?: string;
}

// ============================================
// Cryptographic Security & Audit Types
// ============================================

export interface MerkleProofStep {
  step: number;
  position: 'left' | 'right';
  sibling: string;
  resulting_hash: string;
}

export interface MerkleVerificationResult {
  valid: boolean;
  tampered?: boolean;
  event_id: string;
  computed_leaf: string;
  expected_root: string;
  on_chain_tx_hash?: string;
  trace: MerkleProofStep[];
  message: string;
}

export interface AuditBlockSummary {
  block_height: number;
  timestamp: number;
  timestamp_iso: string;
  prev_block_hash: string;
  merkle_root: string;
  block_hash: string;
  event_count: number;
  on_chain_tx_hash: string;
  chain_name: string;
}

export interface AuditLedgerSummary {
  total_blocks: number;
  total_events: number;
  pending_events_count: number;
  latest_merkle_root: string | null;
  latest_tx_hash: string | null;
  blocks: AuditBlockSummary[];
}

export interface PSIRunResult {
  status: string;
  protocol: string;
  elapsed_ms: number;
  banks: Record<string, { input_size: number; blinded_hash: string }>;
  pairwise_intersections: {
    axis_icici_count: number;
    axis_hdfc_count: number;
    icici_hdfc_count: number;
  };
  cross_bank_mules_count: number;
  cross_bank_mules: string[];
  triple_shared_mules: string[];
  zkp_guarantee: string;
}

export interface PrivacyTelemetry {
  status: string;
  dp_budget: {
    epsilon_max: number;
    epsilon_consumed: number;
    epsilon_remaining: number;
    budget_consumed_percentage: number;
    delta: number;
    sigma_noise_scale: number;
    clip_bound_C: number;
    federated_rounds_executed: number;
    participating_nodes: string[];
    accounting_mechanism: string;
  };
  salt_rotation: {
    epoch_id: string;
    rotation_interval_hours: number;
    time_remaining_seconds: number;
    salt_sha256_fingerprint: string;
    historical_epochs_count: number;
    forward_secrecy: string;
  };
  pii_leakage_guarantee: {
    raw_names_leaked: number;
    raw_accounts_leaked: number;
    enclave_type: string;
    verified: boolean;
  };
}

export interface RoleDefinition {
  title: string;
  description: string;
  permissions: string[];
}

