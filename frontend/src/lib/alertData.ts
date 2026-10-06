/**
 * Mock data for Alert Investigation screen.
 * Generates swim-lane timeline events and score breakdown for detected chains.
 */

import type { BankId } from './types';
import { BANK_CONFIGS } from './types';

// ============================================
// Types
// ============================================

export interface TimelineEvent {
  id: string;
  bank: BankId;
  fromToken: string;
  toToken: string;
  amountBand: string;
  timestamp: Date;
  timeFormatted: string;
  channel: 'UPI' | 'NEFT' | 'RTGS' | 'IMPS';
  step: number; // 1-based step in the chain
  phase: 'entry' | 'spread' | 'merge' | 'cashout';
}

export interface ScoreFactor {
  id: string;
  name: string;
  score: number;     // 0-100 contribution
  weight: number;    // 0-1 weight
  weighted: number;  // score * weight
  description: string;
  icon: string;
}

export interface AlertInvestigation {
  chainId: string;
  overallScore: number;
  detectionTime: number; // seconds
  totalAmount: string;
  banksInvolved: BankId[];
  nodeCount: number;
  edgeCount: number;
  transitTime: string; // e.g. "11 minutes"
  timeline: TimelineEvent[];
  scoreFactors: ScoreFactor[];
  narrative: string;
  recommendation: 'block' | 'escalate' | 'monitor';
}

// ============================================
// Generator
// ============================================

function genToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let r = 't';
  for (let i = 0; i < 4; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

export function generateAlertInvestigation(chainIndex: number = 0): AlertInvestigation {
  const now = new Date();
  const chainId = chainIndex === 0 ? 'chain-TKQDQ' : 'chain-TR9FN';
  const isHighScore = chainIndex === 0;

  // Generate tokens for accounts in the chain
  const entryToken = genToken();
  const spreadTokens = Array.from({ length: isHighScore ? 6 : 4 }, () => genToken());
  const mergeToken = genToken();
  const cashoutToken = genToken();

  const banks: BankId[] = ['axis', 'icici', 'hdfc'];
  const timeline: TimelineEvent[] = [];
  let step = 1;
  const baseTime = new Date(now.getTime() - 720000); // 12 min ago

  // Entry — money enters at Bank A
  timeline.push({
    id: `evt-${step}`,
    bank: 'axis',
    fromToken: 'EXTERNAL',
    toToken: entryToken,
    amountBand: '10L+',
    timestamp: new Date(baseTime.getTime()),
    timeFormatted: baseTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    channel: 'RTGS',
    step: step++,
    phase: 'entry',
  });

  // Spread — fan-out to multiple accounts across banks
  const spreadCount = isHighScore ? 6 : 4;
  for (let i = 0; i < spreadCount; i++) {
    const bank = banks[i % 3] as BankId;
    const t = new Date(baseTime.getTime() + 30000 + i * 25000); // staggered 25s apart
    timeline.push({
      id: `evt-${step}`,
      bank,
      fromToken: entryToken,
      toToken: spreadTokens[i],
      amountBand: '1L-5L',
      timestamp: t,
      timeFormatted: t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      channel: i % 2 === 0 ? 'UPI' : 'NEFT',
      step: step++,
      phase: 'spread',
    });
  }

  // Merge — fan-in to single account at Bank C
  for (let i = 0; i < spreadCount; i++) {
    const t = new Date(baseTime.getTime() + 300000 + i * 15000); // 5 min later, staggered
    timeline.push({
      id: `evt-${step}`,
      bank: 'hdfc',
      fromToken: spreadTokens[i],
      toToken: mergeToken,
      amountBand: '1L-5L',
      timestamp: t,
      timeFormatted: t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      channel: 'NEFT',
      step: step++,
      phase: 'merge',
    });
  }

  // Cashout — exits back to Bank A
  const cashoutTime = new Date(baseTime.getTime() + 600000); // 10 min later
  timeline.push({
    id: `evt-${step}`,
    bank: 'axis',
    fromToken: mergeToken,
    toToken: cashoutToken,
    amountBand: '10L+',
    timestamp: cashoutTime,
    timeFormatted: cashoutTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    channel: 'RTGS',
    step: step++,
    phase: 'cashout',
  });

  // Score factors
  const scoreFactors: ScoreFactor[] = [
    {
      id: 'sf-velocity',
      name: 'Velocity',
      score: isHighScore ? 95 : 60,
      weight: 0.25,
      weighted: isHighScore ? 23.75 : 15,
      description: `${spreadCount} txns within ${isHighScore ? '3' : '8'} minutes — ${isHighScore ? 'extreme' : 'elevated'} speed`,
      icon: '⚡',
    },
    {
      id: 'sf-structure',
      name: 'Structuring Pattern',
      score: isHighScore ? 92 : 45,
      weight: 0.25,
      weighted: isHighScore ? 23 : 11.25,
      description: isHighScore
        ? 'Classic fan-out/fan-in diamond — textbook layering shape'
        : 'Partial fan pattern detected, but fewer legs',
      icon: '◇',
    },
    {
      id: 'sf-crossbank',
      name: 'Cross-Bank Hops',
      score: isHighScore ? 88 : 70,
      weight: 0.20,
      weighted: isHighScore ? 17.6 : 14,
      description: `Money touched ${banks.length} banks in ${isHighScore ? '11' : '14'} min — jurisdictional arbitrage`,
      icon: '🏦',
    },
    {
      id: 'sf-amount',
      name: 'Amount Anomaly',
      score: isHighScore ? 85 : 35,
      weight: 0.15,
      weighted: isHighScore ? 12.75 : 5.25,
      description: isHighScore
        ? '₹15L split into sub-₹2.5L legs — threshold evasion'
        : 'Amounts within normal range for account profile',
      icon: '₹',
    },
    {
      id: 'sf-timing',
      name: 'Temporal Pattern',
      score: isHighScore ? 90 : 40,
      weight: 0.10,
      weighted: isHighScore ? 9 : 4,
      description: isHighScore
        ? 'All legs completed within single 15-min window — orchestrated'
        : 'Spread over 30 min — less suspicious timing',
      icon: '🕐',
    },
    {
      id: 'sf-graph',
      name: 'Graph Topology',
      score: isHighScore ? 96 : 30,
      weight: 0.05,
      weighted: isHighScore ? 4.8 : 1.5,
      description: isHighScore
        ? 'Ring closure detected — money returned to origin bank'
        : 'No ring closure — linear chain only',
      icon: '🔗',
    },
  ];

  return {
    chainId,
    overallScore: isHighScore ? 92 : 41,
    detectionTime: isHighScore ? 4.2 : 8.1,
    totalAmount: '₹15.0L',
    banksInvolved: banks,
    nodeCount: isHighScore ? 8 : 5,
    edgeCount: isHighScore ? 11 : 7,
    transitTime: isHighScore ? '11 minutes' : '14 minutes',
    timeline,
    scoreFactors,
    narrative: isHighScore
      ? 'Money entered at Axis Bank, was split 6 ways through ICICI Bank, merged at HDFC Bank, and returned to Axis Bank. Classic diamond layering pattern with threshold evasion. Total transit time: 11 minutes.'
      : 'Funds moved through 3 banks in a partial fan pattern. Lower velocity and no ring closure reduce confidence. Recommend monitoring.',
    recommendation: isHighScore ? 'block' : 'monitor',
  };
}
