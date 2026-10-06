/**
 * Mock transaction data for the Bank Console.
 * Generates realistic Indian names, account numbers, and transactions,
 * plus their tokenized counterparts.
 */

import type { BankId, AmountBand } from './types';

// ============================================
// Indian Name Generator
// ============================================

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun',
  'Reyansh', 'Sai', 'Arnav', 'Dhruv', 'Kabir',
  'Ananya', 'Diya', 'Myra', 'Sara', 'Aanya',
  'Isha', 'Kavya', 'Riya', 'Priya', 'Neha',
  'Rahul', 'Rohan', 'Vikram', 'Suresh', 'Ramesh',
  'Pooja', 'Sunita', 'Meena', 'Deepa', 'Lakshmi',
  'Rajesh', 'Mahesh', 'Ganesh', 'Kiran', 'Amit',
  'Sneha', 'Anjali', 'Swati', 'Nisha', 'Divya',
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta',
  'Agarwal', 'Mehta', 'Shah', 'Joshi', 'Verma',
  'Iyer', 'Nair', 'Reddy', 'Rao', 'Pillai',
  'Chatterjee', 'Banerjee', 'Mukherjee', 'Das', 'Bose',
  'Malhotra', 'Kapoor', 'Khanna', 'Chopra', 'Sethi',
  'Desai', 'Modi', 'Thakur', 'Chauhan', 'Yadav',
];

function randomName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

// ============================================
// Account Number Generator (realistic format)
// ============================================

const BANK_PREFIXES: Record<BankId, string> = {
  axis: '9180',
  icici: '0040',
  hdfc: '5020',
};

function generateAccountNumber(bank: BankId): string {
  const prefix = BANK_PREFIXES[bank];
  let num = prefix;
  for (let i = 0; i < 8; i++) {
    num += Math.floor(Math.random() * 10).toString();
  }
  return num;
}

function maskAccount(account: string): string {
  return 'XXXX' + account.slice(-4);
}

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

// ============================================
// Amount to Band
// ============================================

function amountToBand(amount: number): AmountBand {
  if (amount < 10000) return '0-10K';
  if (amount < 50000) return '10K-50K';
  if (amount < 100000) return '50K-1L';
  if (amount < 500000) return '1L-5L';
  if (amount < 1000000) return '5L-10L';
  return '10L+';
}

function formatINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

function timeToWindow(timestamp: Date): string {
  const h = timestamp.getHours().toString().padStart(2, '0');
  const m = Math.floor(timestamp.getMinutes() / 15) * 15;
  const mStr = m.toString().padStart(2, '0');
  const mEnd = ((m + 15) % 60).toString().padStart(2, '0');
  const hEnd = m + 15 >= 60 ? (timestamp.getHours() + 1).toString().padStart(2, '0') : h;
  return `${h}:${mStr}–${hEnd}:${mEnd}`;
}

// ============================================
// Types
// ============================================

export interface RawTransactionRow {
  id: string;
  senderName: string;
  senderAccount: string;
  receiverName: string;
  receiverAccount: string;
  amount: number;
  amountFormatted: string;
  timestamp: Date;
  timeFormatted: string;
  channel: 'UPI' | 'NEFT' | 'RTGS' | 'IMPS';
  status: 'completed' | 'pending';
}

export interface TokenizedTransactionRow {
  id: string;
  senderToken: string;
  receiverToken: string;
  amountBand: AmountBand;
  timeWindow: string;
  channel: string; // kept
  hubStatus: 'sent' | 'queued' | 'held';
}

// Channel Edge — fast rule-based risk check (Layer 1, inside bank)
export type RuleId = 'structuring' | 'velocity' | 'drain' | 'odd_hours' | 'rapid_succession' | 'round_amount';

export interface ChannelEdgeFlag {
  ruleId: RuleId;
  ruleName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

export const RULE_DEFINITIONS: Record<RuleId, { name: string; severity: 'critical' | 'high' | 'medium' | 'low'; template: string }> = {
  structuring: {
    name: 'Structuring',
    severity: 'critical',
    template: 'Multiple sub-₹50K txns to same receiver within 30 min — possible threshold evasion',
  },
  velocity: {
    name: 'Velocity Spike',
    severity: 'high',
    template: '{count} outbound txns in {mins} min from account {acct} — unusual volume',
  },
  drain: {
    name: 'Account Drain',
    severity: 'critical',
    template: 'Account {acct} balance dropping rapidly — {pct}% outflow in {mins} min',
  },
  odd_hours: {
    name: 'Odd Hours',
    severity: 'medium',
    template: 'High-value txn at {time} — outside normal business hours',
  },
  rapid_succession: {
    name: 'Rapid Succession',
    severity: 'high',
    template: '{count} txns within {secs}s from same sender — bot-like pattern',
  },
  round_amount: {
    name: 'Round Amount',
    severity: 'low',
    template: 'Exact round figure ₹{amount} — commonly used in layering',
  },
};

export interface TransactionPair {
  raw: RawTransactionRow;
  tokenized: TokenizedTransactionRow;
  isSuspicious: boolean;
  channelEdgeFlags: ChannelEdgeFlag[]; // rules fired by Channel Edge
}

// ============================================
// Generator
// ============================================

const CHANNELS: ('UPI' | 'NEFT' | 'RTGS' | 'IMPS')[] = ['UPI', 'NEFT', 'RTGS', 'IMPS'];

export function generateBankTransactions(bank: BankId, count: number = 25): TransactionPair[] {
  const pairs: TransactionPair[] = [];
  const now = new Date();

  // Pre-generate a sender-token map for consistency
  const tokenMap = new Map<string, string>();
  const getToken = (account: string): string => {
    if (!tokenMap.has(account)) {
      tokenMap.set(account, generateToken());
    }
    return tokenMap.get(account)!;
  };

  for (let i = 0; i < count; i++) {
    const senderName = randomName();
    const receiverName = randomName();
    const senderAccount = generateAccountNumber(bank);
    // 70% same bank, 30% other bank
    const otherBanks: BankId[] = (['axis', 'icici', 'hdfc'] as BankId[]).filter(b => b !== bank);
    const receiverBank = Math.random() > 0.3 ? bank : otherBanks[Math.floor(Math.random() * otherBanks.length)];
    const receiverAccount = generateAccountNumber(receiverBank);

    // Amounts: mostly small, some large
    const amountWeights = [
      { min: 500, max: 9999, weight: 0.35 },
      { min: 10000, max: 49999, weight: 0.3 },
      { min: 50000, max: 99999, weight: 0.15 },
      { min: 100000, max: 499999, weight: 0.12 },
      { min: 500000, max: 999999, weight: 0.05 },
      { min: 1000000, max: 5000000, weight: 0.03 },
    ];
    let amount = 5000;
    const r = Math.random();
    let cum = 0;
    for (const aw of amountWeights) {
      cum += aw.weight;
      if (r < cum) {
        amount = Math.floor(aw.min + Math.random() * (aw.max - aw.min));
        break;
      }
    }

    const timestamp = new Date(now.getTime() - Math.random() * 3600000 * 2); // last 2 hours
    const channel = CHANNELS[Math.floor(Math.random() * CHANNELS.length)];
    const isSuspicious = i < 3; // first 3 are suspicious (for demo)

    // === Channel Edge: fast rule-based checks ===
    const channelEdgeFlags: ChannelEdgeFlag[] = [];

    if (isSuspicious) {
      // Suspicious txns trigger structuring + velocity
      channelEdgeFlags.push({
        ruleId: 'structuring',
        ruleName: 'Structuring',
        severity: 'critical',
        description: `${3 + Math.floor(Math.random() * 4)} sub-₹50K txns to ${maskAccount(receiverAccount)} in 28 min — threshold evasion pattern`,
      });
      channelEdgeFlags.push({
        ruleId: 'velocity',
        ruleName: 'Velocity Spike',
        severity: 'high',
        description: `${5 + Math.floor(Math.random() * 6)} outbound txns in 12 min from ${maskAccount(senderAccount)}`,
      });
    } else if (amount > 500000 && timestamp.getHours() < 6) {
      // Large late-night txns
      channelEdgeFlags.push({
        ruleId: 'odd_hours',
        ruleName: 'Odd Hours',
        severity: 'medium',
        description: `₹${(amount / 100000).toFixed(1)}L txn at ${timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} — outside business hours`,
      });
    } else if (amount % 100000 === 0 && amount >= 100000) {
      // Exact round figures
      channelEdgeFlags.push({
        ruleId: 'round_amount',
        ruleName: 'Round Amount',
        severity: 'low',
        description: `Exact ₹${(amount / 100000).toFixed(0)}L — round figures common in layering`,
      });
    } else if (i === 4 || i === 7) {
      // A couple more for demo variety
      const rules: ChannelEdgeFlag[] = [
        {
          ruleId: 'drain',
          ruleName: 'Account Drain',
          severity: 'critical',
          description: `Account ${maskAccount(senderAccount)} outflow 87% in 45 min — possible account takeover`,
        },
        {
          ruleId: 'rapid_succession',
          ruleName: 'Rapid Succession',
          severity: 'high',
          description: `4 txns within 8s from ${maskAccount(senderAccount)} — bot-like pattern`,
        },
      ];
      channelEdgeFlags.push(rules[i === 4 ? 0 : 1]);
    }

    const raw: RawTransactionRow = {
      id: `txn-${bank}-${i.toString().padStart(3, '0')}`,
      senderName,
      senderAccount,
      receiverName,
      receiverAccount,
      amount,
      amountFormatted: formatINR(amount),
      timestamp,
      timeFormatted: timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      channel,
      status: Math.random() > 0.05 ? 'completed' : 'pending',
    };

    const tokenized: TokenizedTransactionRow = {
      id: raw.id,
      senderToken: getToken(senderAccount),
      receiverToken: getToken(receiverAccount),
      amountBand: amountToBand(amount),
      timeWindow: timeToWindow(timestamp),
      channel: channel,
      hubStatus: isSuspicious ? 'held' : (channelEdgeFlags.length > 0 ? 'queued' : (Math.random() > 0.1 ? 'sent' : 'queued')),
    };

    pairs.push({ raw, tokenized, isSuspicious, channelEdgeFlags });
  }

  // Sort by timestamp descending (newest first)
  pairs.sort((a, b) => b.raw.timestamp.getTime() - a.raw.timestamp.getTime());

  return pairs;
}
