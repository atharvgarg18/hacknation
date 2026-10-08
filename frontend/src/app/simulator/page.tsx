'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import NetworkGraph from '@/components/graph/NetworkGraph';
import { useGraphStore } from '@/store/graphStore';
import { BANK_CONFIGS } from '@/lib/types';
import type { BankId, GraphNode, GraphEdge, AmountBand } from '@/lib/types';

// ── Types ──────────────────────────────────────────────────────────────────────

type SimState = 'armed' | 'executing' | 'captured';

interface AttackPatternDef {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  detectionMs: number;
  defaultHops: number;
}

interface HopEvent {
  node?: GraphNode;
  edge: GraphEdge;
  score: number;
  eventText: string;
  timeLabel: string;
  chainId: string;
  allNodeIds: string[];
  allEdgeIds: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ATTACK_PATTERNS: AttackPatternDef[] = [
  {
    id: 'fan-out-fan-in',
    name: 'Fan-Out / Fan-In',
    subtitle: 'Classic Smurfing Diamond',
    description:
      'Large lump sum split into sub-threshold transfers across multiple banks, then reconsolidated at a single exit point.',
    icon: '\u25c8',
    color: '#f43f5e',
    bg: 'rgba(244,63,94,0.08)',
    border: 'rgba(244,63,94,0.3)',
    detectionMs: 4200,
    defaultHops: 4,
  },
  {
    id: 'rapid-pass-through',
    name: 'Rapid Pass-Through',
    subtitle: 'Zero-Dwell Velocity',
    description:
      'Funds enter and exit accounts in under 60 seconds via IMPS instant rails to eliminate forensic dwell traces.',
    icon: '\u2192',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.3)',
    detectionMs: 3100,
    defaultHops: 6,
  },
  {
    id: 'chain',
    name: 'Linear Chain',
    subtitle: 'Sequential Hop Layering',
    description:
      'Money hops sequentially across banks one at a time, attempting to obscure the origin through transaction depth.',
    icon: '\u2b36',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.3)',
    detectionMs: 5800,
    defaultHops: 5,
  },
  {
    id: 'cycle',
    name: 'Cycle / Ring',
    subtitle: 'Circular Fund Routing',
    description:
      'Money circulates through a ring of accounts returning near origin to confuse reconciliation and freeze requests.',
    icon: '\u21ba',
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.08)',
    border: 'rgba(6,182,212,0.3)',
    detectionMs: 6900,
    defaultHops: 5,
  },
];

const ALL_BANKS: BankId[] = ['axis', 'icici', 'hdfc', 'sbi'];

const BANK_COLORS: Record<BankId, string> = {
  axis: '#c91e5e',
  icici: '#f97316',
  hdfc: '#0284c7',
  sbi: '#3949ab',
};

// ── Hop Generator ──────────────────────────────────────────────────────────────

function tok(): string {
  return 't' + Math.random().toString(36).slice(2, 6);
}

function generateAttackHops(
  patternId: string,
  banks: BankId[],
  amountLakh: number,
  hopCount: number,
): HopEvent[] {
  const chainId = 'chain-' + tok();
  const hops: HopEvent[] = [];
  const allNodeIds: string[] = [];
  const allEdgeIds: string[] = [];
  const bks = banks.length >= 2 ? banks : ALL_BANKS;
  const amountBand: AmountBand = amountLakh >= 10 ? '10L+' : amountLakh >= 5 ? '5L-10L' : '1L-5L';
  const subBand: AmountBand = amountLakh >= 10 ? '5L-10L' : '1L-5L';

  const mkNode = (bank: BankId, fx: number, fy: number, fz: number, extra: Partial<GraphNode> = {}): GraphNode => ({
    id: tok(), bank, label: BANK_CONFIGS[bank].shortName,
    totalIn: 0, totalOut: 0, txCount: 0,
    riskScore: 75 + Math.floor(Math.random() * 15),
    isFlagged: true, chainId, fx, fy, fz, ...extra,
  });

  const mkEdge = (src: string, tgt: string, srcB: BankId, tgtB: BankId, band = amountBand): GraphEdge => ({
    id: 'e-' + tok(), source: src, target: tgt,
    amountBand: band, timestamp: new Date().toISOString(),
    sourceBank: srcB, targetBank: tgtB, isFlagged: true, chainId,
  });

  const snap = () => ({ allNodeIds: [...allNodeIds], allEdgeIds: [...allEdgeIds] });

  if (patternId === 'fan-out-fan-in') {
    const eBank = bks[0];
    const sBanks = bks.slice(1);
    const mBank = bks[bks.length - 1];
    const coBank = bks[0];
    const spread = Math.min(hopCount, 4);

    const entry = mkNode(eBank, -90, 0, 0, { totalOut: amountLakh * 100000 });
    allNodeIds.push(entry.id);
    hops.push({ node: entry, edge: mkEdge(entry.id, entry.id, eBank, eBank, '10L+'), score: 18, eventText: 'Inbound \u20b9' + amountLakh + 'L RTGS \u2192 ' + BANK_CONFIGS[eBank].name, timeLabel: 'T+00:00', chainId, ...snap() });

    const sNodes: GraphNode[] = [];
    const sEdges: GraphEdge[] = [];
    for (let i = 0; i < spread; i++) {
      const b = sBanks[i % sBanks.length];
      const y = (i - (spread - 1) / 2) * 40;
      const z = i % 2 === 0 ? 20 : -20;
      const n = mkNode(b, -25, y, z, { totalIn: Math.floor(amountLakh * 100000 / spread), totalOut: Math.floor(amountLakh * 100000 / spread) });
      sNodes.push(n);
      sEdges.push(mkEdge(entry.id, n.id, eBank, b, subBand));
    }
    sNodes.forEach((n) => allNodeIds.push(n.id));
    sEdges.forEach((e) => allEdgeIds.push(e.id));
    sNodes.forEach((n, i) => {
      hops.push({ node: n, edge: sEdges[i], score: 38 + i * 8, eventText: 'Structuring split ' + (i + 1) + '/' + spread + ': \u20b9' + (amountLakh / spread).toFixed(1) + 'L \u2192 ' + BANK_CONFIGS[n.bank].name + ' (sub-threshold)', timeLabel: 'T+0' + (i + 2) + ':' + String(10 + i * 15).padStart(2, '0'), chainId, ...snap() });
    });

    const merge = mkNode(mBank, 45, 0, 0, { totalIn: amountLakh * 100000, totalOut: amountLakh * 100000 });
    allNodeIds.push(merge.id);
    const mEdge = mkEdge(sNodes[0].id, merge.id, sNodes[0].bank, mBank);
    allEdgeIds.push(mEdge.id);
    hops.push({ node: merge, edge: mEdge, score: 78, eventText: 'Fan-in convergence: ' + spread + ' streams \u2192 ' + BANK_CONFIGS[mBank].name, timeLabel: 'T+0' + (spread + 2) + ':45', chainId, ...snap() });

    const co = mkNode(coBank, 110, 0, 0, { totalIn: amountLakh * 100000 });
    allNodeIds.push(co.id);
    const coEdge = mkEdge(merge.id, co.id, mBank, coBank, '10L+');
    allEdgeIds.push(coEdge.id);
    hops.push({ node: co, edge: coEdge, score: 92, eventText: '\u26a0 Terminal cashout: \u20b9' + amountLakh + 'L \u2192 ' + BANK_CONFIGS[coBank].name, timeLabel: 'T+0' + (spread + 3) + ':20', chainId, ...snap() });

  } else if (patternId === 'rapid-pass-through') {
    const steps = Math.min(hopCount, 6);
    let prevId = '';
    let prevBank = bks[0];
    for (let i = 0; i < steps; i++) {
      const b = bks[i % bks.length];
      const n = mkNode(b, (i - steps / 2) * 55, i % 2 === 0 ? 10 : -10, 0);
      allNodeIds.push(n.id);
      if (i === 0) {
        prevId = n.id; prevBank = b;
        hops.push({ node: n, edge: mkEdge(n.id, n.id, b, b), score: 15, eventText: 'Entry: \u20b9' + amountLakh + 'L arrives \u2192 ' + BANK_CONFIGS[b].name + ' via IMPS', timeLabel: 'T+00:00', chainId, ...snap() });
      } else {
        const e = mkEdge(prevId, n.id, prevBank, b);
        allEdgeIds.push(e.id);
        const dwell = 30 + Math.floor(Math.random() * 60);
        hops.push({ node: n, edge: e, score: 22 + i * 12, eventText: 'Hop ' + i + ': <' + dwell + 's dwell \u2192 ' + BANK_CONFIGS[b].name + ' [velocity alert]', timeLabel: 'T+0' + i + ':' + dwell, chainId, ...snap() });
        prevId = n.id; prevBank = b;
      }
    }

  } else if (patternId === 'chain') {
    const steps = Math.min(hopCount, 6);
    let prevId = '';
    let prevBank = bks[0];
    for (let i = 0; i < steps; i++) {
      const b = bks[i % bks.length];
      const n = mkNode(b, -120 + i * 60, i % 2 === 0 ? -15 : 15, i % 3 === 0 ? 10 : -10);
      allNodeIds.push(n.id);
      if (i === 0) {
        prevId = n.id; prevBank = b;
        hops.push({ node: n, edge: mkEdge(n.id, n.id, b, b), score: 12, eventText: 'Origin: \u20b9' + amountLakh + 'L deposited at ' + BANK_CONFIGS[b].name, timeLabel: 'T+00:00', chainId, ...snap() });
      } else {
        const e = mkEdge(prevId, n.id, prevBank, b);
        allEdgeIds.push(e.id);
        hops.push({ node: n, edge: e, score: 18 + i * 10, eventText: 'Hop ' + i + '/' + (steps - 1) + ': ' + BANK_CONFIGS[prevBank].shortName + ' \u2192 ' + BANK_CONFIGS[b].shortName, timeLabel: 'T+' + String(i * 2).padStart(2, '0') + ':' + String(Math.floor(Math.random() * 59)).padStart(2, '0'), chainId, ...snap() });
        prevId = n.id; prevBank = b;
      }
    }

  } else {
    const steps = Math.min(hopCount, 5);
    const cNodes: GraphNode[] = [];
    const cEdges: GraphEdge[] = [];
    const r = 70;
    for (let i = 0; i < steps; i++) {
      const b = bks[i % bks.length];
      const a = (i / steps) * Math.PI * 2;
      const n = mkNode(b, Math.cos(a) * r, 0, Math.sin(a) * r);
      cNodes.push(n); allNodeIds.push(n.id);
    }
    for (let i = 0; i < steps; i++) {
      const e = mkEdge(cNodes[i].id, cNodes[(i + 1) % steps].id, cNodes[i].bank, cNodes[(i + 1) % steps].bank);
      cEdges.push(e); allEdgeIds.push(e.id);
    }
    cNodes.forEach((n, i) => {
      hops.push({ node: n, edge: cEdges[i], score: 14 + i * 12, eventText: i === 0 ? 'Cycle origin: \u20b9' + amountLakh + 'L enters ' + BANK_CONFIGS[n.bank].name : 'Ring hop ' + i + ': \u2192 ' + BANK_CONFIGS[n.bank].name + ' [circular flow]', timeLabel: 'T+' + String(i).padStart(2, '0') + ':' + String(i * 22).padStart(2, '0'), chainId, ...snap() });
    });
  }

  return hops;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SimulatorPage() {
  const { initializeGraph, graphData, startSimulation, stopSimulation, setFocusedChain, triggerDetection, clearDetection, addTransaction } = useGraphStore();

  useEffect(() => {
    if (graphData.nodes.length === 0) initializeGraph();
    startSimulation();
    return () => stopSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [simState, setSimState] = useState<SimState>('armed');
  const [selPattern, setSelPattern] = useState<AttackPatternDef>(ATTACK_PATTERNS[0]);
  const [selBanks, setSelBanks] = useState<BankId[]>(['axis', 'icici', 'hdfc', 'sbi']);
  const [amountLakh, setAmountLakh] = useState(15);
  const [hopCount, setHopCount] = useState(4);

  const [hopIdx, setHopIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [log, setLog] = useState<{ text: string; time: string; score: number; bank?: BankId }[]>([]);
  const [detectedAt, setDetectedAt] = useState(0);
  const [trigger, setTrigger] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const hopsRef = useRef<HopEvent[]>([]);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const t0Ref = useRef(0);
  const capturedRef = useRef(false);

  const clear = () => {
    if (clockRef.current) clearInterval(clockRef.current);
    if (hopRef.current) clearInterval(hopRef.current);
  };

  const handleFire = useCallback(() => {
    const hops = generateAttackHops(selPattern.id, selBanks, amountLakh, hopCount);
    hopsRef.current = hops;
    capturedRef.current = false;
    setSimState('executing');
    setHopIdx(0); setScore(0); setElapsed(0); setLog([]);
    setDetectedAt(0); setTrigger(''); setCollapsed(true);
    clearDetection(); clear();
    t0Ref.current = Date.now();

    clockRef.current = setInterval(() => setElapsed(Date.now() - t0Ref.current), 50);

    let idx = 0;
    hopRef.current = setInterval(() => {
      if (idx >= hops.length) { clear(); return; }
      const hop = hops[idx++];
      setHopIdx(idx); setScore(hop.score);
      addTransaction(hop.node, hop.edge);
      setFocusedChain({ chainId: hop.chainId, nodeIds: hop.allNodeIds, edgeIds: hop.allEdgeIds });
      setLog((prev) => [{ text: hop.eventText, time: hop.timeLabel, score: hop.score, bank: hop.node?.bank }, ...prev]);

      if (hop.score >= 80 && !capturedRef.current) {
        capturedRef.current = true;
        const detMs = Date.now() - t0Ref.current;
        setDetectedAt(detMs); setTrigger(hop.eventText);
        triggerDetection(hop.chainId, detMs);
        setTimeout(() => { clear(); setSimState('captured'); setCollapsed(false); }, 1800);
      }
    }, 1600);
  }, [selPattern, selBanks, amountLakh, hopCount, addTransaction, setFocusedChain, triggerDetection, clearDetection]);

  const handleReset = useCallback(() => {
    clear(); clearDetection(); capturedRef.current = false;
    setSimState('armed'); setScore(0); setElapsed(0); setLog([]); setCollapsed(false);
  }, [clearDetection]);

  useEffect(() => () => clear(), []);

  const toggleBank = (bank: BankId) =>
    setSelBanks((prev) => prev.includes(bank) ? (prev.length <= 2 ? prev : prev.filter((b) => b !== bank)) : [...prev, bank]);

  const scoreColor = score >= 80 ? '#f43f5e' : score >= 60 ? '#f97316' : score >= 35 ? '#f59e0b' : '#06b6d4';
  const p = selPattern;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-void)', overflow: 'hidden' }}>
      <DashboardHeader />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* 3D Graph */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <NetworkGraph />

          {simState === 'executing' && (
            <div className="animate-fade-in" style={{ position: 'absolute', bottom: 24, left: 20, width: 340, zIndex: 40, display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* Score Ring */}
              <div style={{ padding: '12px 18px', borderRadius: 'var(--r-lg)', background: 'rgba(10,12,19,0.88)', backdropFilter: 'blur(20px)', border: '1px solid ' + scoreColor + '60', boxShadow: '0 0 24px ' + scoreColor + '20', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative', width: 52, height: 52 }}>
                  <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="26" cy="26" r="22" stroke="rgba(255,255,255,0.06)" strokeWidth="4" fill="none" />
                    <circle cx="26" cy="26" r="22" stroke={scoreColor} strokeWidth="4" strokeDasharray={138.2} strokeDashoffset={138.2 - 138.2 * score / 100} strokeLinecap="round" fill="none" style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.4s ease' }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: scoreColor }}>{score}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>THREAT SCORE</div>
                  <div style={{ fontSize: 22, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff' }}>{(elapsed / 1000).toFixed(1)}s</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Hop {hopIdx}/{hopsRef.current.length}</div>
                </div>
              </div>

              {/* Event Log */}
              <div style={{ borderRadius: 'var(--r-md)', background: 'rgba(10,12,19,0.88)', backdropFilter: 'blur(20px)', border: '1px solid var(--border-light)', overflow: 'hidden', maxHeight: 220 }}>
                <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', display: 'inline-block' }} />
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>ENCLAVE TELEMETRY</span>
                </div>
                <div style={{ overflowY: 'auto', maxHeight: 180 }}>
                  {log.map((ev, i) => (
                    <div key={i} style={{ padding: '7px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 10, alignItems: 'flex-start', background: i === 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, paddingTop: 1 }}>{ev.time}</span>
                      <span style={{ fontSize: 11, color: i === 0 ? '#fff' : 'var(--text-secondary)', lineHeight: 1.4, flex: 1 }}>{ev.text}</span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: i === 0 ? scoreColor : 'var(--text-tertiary)', fontWeight: 700, flexShrink: 0 }}>{ev.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div style={{ width: collapsed ? 280 : 400, flexShrink: 0, borderLeft: '1px solid var(--border-light)', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)' }}>

          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
                {simState === 'armed' ? 'ATTACK CONFIGURATOR' : simState === 'executing' ? 'LIVE EXECUTION' : '\u26a1 INTERDICTED'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                {simState === 'armed' ? 'Configure pattern and fire' : simState === 'executing' ? p.name + ' in progress' : 'Captured in ' + (detectedAt / 1000).toFixed(1) + 's'}
              </div>
            </div>
            {simState === 'executing' && (
              <button onClick={() => setCollapsed((c) => !c)} style={{ background: 'none', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text-tertiary)', padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}>
                {collapsed ? '\u25c2' : '\u25b8'}
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── ARMED ── */}
            {simState === 'armed' && (
              <>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 10 }}>ATTACK PATTERN</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ATTACK_PATTERNS.map((ap) => (
                      <button key={ap.id} onClick={() => { setSelPattern(ap); setHopCount(ap.defaultHops); }} style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', border: '1px solid ' + (selPattern.id === ap.id ? ap.color : 'var(--border-light)'), background: selPattern.id === ap.id ? ap.bg : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ width: 36, height: 36, borderRadius: 8, background: selPattern.id === ap.id ? ap.bg : 'rgba(255,255,255,0.03)', border: '1px solid ' + (selPattern.id === ap.id ? ap.border : 'var(--border-subtle)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: selPattern.id === ap.id ? ap.color : 'var(--text-tertiary)', flexShrink: 0 }}>{ap.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: selPattern.id === ap.id ? ap.color : 'var(--text-primary)' }}>{ap.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{ap.subtitle}</div>
                        </div>
                        {selPattern.id === ap.id && <span style={{ width: 6, height: 6, borderRadius: '50%', background: ap.color, flexShrink: 0 }} />}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ padding: '10px 14px', borderRadius: 'var(--r-md)', background: p.bg, border: '1px solid ' + p.border, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {p.description}
                </div>

                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 10 }}>BANKS INVOLVED</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {ALL_BANKS.map((bank) => {
                      const active = selBanks.includes(bank);
                      const col = BANK_COLORS[bank];
                      return (
                        <button key={bank} onClick={() => toggleBank(bank)} style={{ padding: '7px 14px', borderRadius: 'var(--r-sm)', border: '1px solid ' + (active ? col : 'var(--border-light)'), background: active ? col + '18' : 'transparent', color: active ? col : 'var(--text-tertiary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease' }}>
                          {BANK_CONFIGS[bank].shortName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>LAUNDERING AMOUNT</span>
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: p.color }}>\u20b9{amountLakh}L</span>
                  </div>
                  <input type="range" min={5} max={50} step={5} value={amountLakh} onChange={(e) => setAmountLakh(Number(e.target.value))} style={{ width: '100%', accentColor: p.color }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                    <span>\u20b95L</span><span>\u20b950L</span>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>INTERMEDIATE HOPS</span>
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: p.color }}>{hopCount}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[2, 3, 4, 5, 6, 7].map((n) => (
                      <button key={n} onClick={() => setHopCount(n)} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: hopCount === n ? '1px solid ' + p.color : '1px solid var(--border-light)', background: hopCount === n ? p.bg : 'transparent', color: hopCount === n ? p.color : 'var(--text-tertiary)', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: hopCount === n ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s ease' }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Est. detection time</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: p.color }}>~{(p.detectionMs / 1000).toFixed(1)}s</span>
                </div>

                <button onClick={handleFire} style={{ padding: '14px', borderRadius: 'var(--r-md)', border: 'none', background: 'linear-gradient(135deg,' + p.color + ',' + p.color + 'cc)', color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 24px ' + p.color + '40' }}>
                  <span style={{ fontSize: 16 }}>\u26a1</span> FIRE ATTACK
                </button>
              </>
            )}

            {/* ── EXECUTING ── */}
            {simState === 'executing' && (
              <>
                <div style={{ padding: '14px', borderRadius: 'var(--r-md)', background: p.bg, border: '1px solid ' + p.border, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 22 }}>{p.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: p.color }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>\u20b9{amountLakh}L \u00b7 {hopCount} hops \u00b7 {selBanks.length} banks</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                    <span style={{ fontSize: 10, color: '#10b981', fontFamily: 'var(--font-mono)' }}>LIVE</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 10 }}>BANK AWARENESS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ALL_BANKS.map((bank) => {
                      const involved = selBanks.includes(bank);
                      const col = BANK_COLORS[bank];
                      const seen = log.filter((e) => e.bank === bank).length;
                      return (
                        <div key={bank} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: involved ? col : 'var(--text-muted)', minWidth: 28 }}>{BANK_CONFIGS[bank].shortName}</span>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                            {involved && <div style={{ height: '100%', borderRadius: 2, background: col, width: Math.min(100, seen * 25) + '%', transition: 'width 0.5s ease' }} />}
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', minWidth: 60, textAlign: 'right' }}>
                            {involved ? (seen > 0 ? '\ud83d\udd34 ACTIVE' : '\u26ab BLIND') : 'N/A'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.6, padding: '4px 0' }}>
                  \ud83d\udd12 Privacy Enclave correlating<br />cross-bank token signatures...
                </div>
              </>
            )}

            {/* ── CAPTURED ── */}
            {simState === 'captured' && (
              <>
                <div className="animate-scale-in" style={{ padding: '18px', borderRadius: 'var(--r-lg)', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.5)', boxShadow: '0 0 32px rgba(244,63,94,0.2)', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>\u26a1</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#f43f5e', letterSpacing: '0.08em' }}>INTERDICTED</div>
                  <div style={{ fontSize: 34, fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#fff', margin: '10px 0' }}>{(detectedAt / 1000).toFixed(1)}s</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total detection time</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {([
                    { label: 'Pattern', value: p.name, color: p.color },
                    { label: 'Final Score', value: score + '/100', color: scoreColor },
                    { label: 'Amount Secured', value: '\u20b9' + amountLakh + 'L', color: '#10b981' },
                    { label: 'Banks Involved', value: selBanks.map((b) => BANK_CONFIGS[b].shortName).join(', '), color: 'var(--text-primary)' },
                    { label: 'Hops Traced', value: hopIdx + '/' + hopsRef.current.length, color: 'var(--text-primary)' },
                  ] as const).map((item) => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{item.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: item.color }}>{item.value}</span>
                    </div>
                  ))}
                </div>

                {trigger && (
                  <div style={{ padding: '10px 14px', borderRadius: 'var(--r-md)', background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.25)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#f43f5e', marginBottom: 4 }}>DETECTION TRIGGER</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{trigger}</div>
                  </div>
                )}

                <div style={{ padding: '10px 14px', borderRadius: 'var(--r-md)', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.25)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  \ud83d\udd12 <strong style={{ color: '#10b981' }}>Zero-Knowledge Proof Issued</strong> \u2014 Freeze order dispatched to {selBanks.length} banking cores. No customer PII transmitted.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={handleReset} style={{ padding: '12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    \u21ba Reset &amp; Reconfigure
                  </button>
                  <Link href="/investigate" style={{ padding: '12px', borderRadius: 'var(--r-md)', border: '1px solid rgba(244,63,94,0.4)', background: 'rgba(244,63,94,0.1)', color: '#f43f5e', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    View Full Alert \u2192
                  </Link>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
