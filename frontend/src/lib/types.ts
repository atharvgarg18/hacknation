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
