/**
 * Alert Investigation — Screen 3
 * Deep-Tech Forensic Analysis of Correlated Cross-Bank Laundering Chains.
 * Includes interactive swim-lane timeline, step ledger, risk score gauge, and cryptographic action debrief.
 */

'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BANK_CONFIGS } from '@/lib/types';
import type { BankId } from '@/lib/types';
import { generateAlertInvestigation, type AlertInvestigation, type TimelineEvent, type ScoreFactor } from '@/lib/alertData';
import Link from 'next/link';

// ============================================
// Score Ring (Apple / Aerospace Telemetry Reticle)
// ============================================

function ScoreRing({ score, size = 130 }: { score: number; size?: number }) {
  const strokeWidth = 7;
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score > 75 ? 'var(--crimson)' : score > 50 ? 'var(--amber)' : 'var(--cyan)';

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Subtle grid track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        {/* Glowing Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ / 4}
          style={{
            filter: `drop-shadow(0 0 8px ${color})`,
            transition: 'stroke-dasharray 1.2s var(--ease-apple)',
          }}
        />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="score-ring__value" style={{ color }}>
          {score}
        </div>
        <div className="score-ring__label">
          {score > 75 ? 'CRITICAL RISK' : 'WATCHLIST'}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Score Factor Bar
// ============================================

function FactorBar({ factor }: { factor: ScoreFactor }) {
  const barColor =
    factor.score > 75
      ? 'var(--crimson)'
      : factor.score > 50
      ? 'var(--amber)'
      : 'var(--cyan)';

  return (
    <div className="factor-bar">
      <div className="factor-bar__header">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{factor.icon}</span>
          <span style={{ fontWeight: 700, color: '#fff' }}>{factor.name}</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>
            {(factor.weight * 100).toFixed(0)}% WT
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              fontSize: 12,
              color: barColor,
            }}
          >
            {factor.score}
          </span>
        </div>
      </div>

      <div className="factor-bar__track">
        <div
          className="factor-bar__fill"
          style={{
            width: `${factor.score}%`,
            background: barColor,
            boxShadow: `0 0 8px ${barColor}`,
          }}
        />
      </div>

      <div className="factor-bar__desc">{factor.description}</div>
    </div>
  );
}

// ============================================
// Swim-lane Timeline & Interactive Step Ledger
// ============================================

const PHASE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  entry: { label: 'ENTRY', color: 'var(--crimson)', bg: 'rgba(244, 63, 94, 0.15)' },
  spread: { label: 'SPREAD', color: 'var(--amber)', bg: 'rgba(245, 158, 11, 0.15)' },
  merge: { label: 'MERGE', color: 'var(--cyan)', bg: 'rgba(6, 182, 212, 0.15)' },
  cashout: { label: 'CASH-OUT', color: 'var(--crimson)', bg: 'rgba(244, 63, 94, 0.15)' },
};

function SwimLaneTimeline({
  events,
  banks,
  selectedEventId,
  onSelectEvent,
}: {
  events: TimelineEvent[];
  banks: BankId[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
}) {
  const lanes = banks.map((bank) => ({
    bank,
    config: BANK_CONFIGS[bank],
    events: events.filter((e) => e.bank === bank),
  }));

  const times = events.map((e) => e.timestamp.getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const range = maxTime - minTime || 1;

  return (
    <div className="swimlane">
      <div className="swimlane__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Cross-Bank Money Flow Chronology</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>
          {events.length} TRANSFERS CORRELATED
        </span>
      </div>

      <div className="swimlane__body">
        {/* Time Axis Markers */}
        <div className="swimlane__time-axis">
          <span>{events[0]?.timeFormatted}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>
            ← Transit Duration: {((maxTime - minTime) / 60000).toFixed(0)} min →
          </span>
          <span>{events[events.length - 1]?.timeFormatted}</span>
        </div>

        {/* Bank Lanes */}
        {lanes.map((lane) => (
          <div key={lane.bank} className="swimlane__lane">
            <div className="swimlane__lane-label">
              <span
                className="swimlane__lane-badge"
                style={{
                  background:
                    lane.bank === 'axis'
                      ? 'linear-gradient(135deg, #97144d, #c91e5e)'
                      : lane.bank === 'icici'
                      ? 'linear-gradient(135deg, #e05500, #f97316)'
                      : 'linear-gradient(135deg, #004c8f, #0284c7)',
                }}
              >
                {lane.config.shortName}
              </span>
              <span>{lane.config.name}</span>
            </div>

            <div className="swimlane__lane-track">
              <div className="swimlane__track-grid" />

              {/* Event Nodes on Track (No overlapping text!) */}
              {lane.events.map((evt) => {
                const left = ((evt.timestamp.getTime() - minTime) / range) * 94 + 3;
                const isSelected = selectedEventId === evt.id;
                const phaseConf = PHASE_CONFIG[evt.phase] || PHASE_CONFIG.spread;

                return (
                  <div
                    key={evt.id}
                    className="swimlane__event-node"
                    style={{ left: `${left}%` }}
                    onClick={() => onSelectEvent(evt.id)}
                    title={`${phaseConf.label}: ${evt.fromToken} → ${evt.toToken} (${evt.amountBand} via ${evt.channel})`}
                  >
                    <div
                      className="swimlane__event-dot"
                      style={{
                        background: phaseConf.color,
                        boxShadow: isSelected
                          ? `0 0 14px ${phaseConf.color}, 0 0 0 3px rgba(255,255,255,0.8)`
                          : `0 0 8px ${phaseConf.color}`,
                        transform: isSelected ? 'scale(1.4)' : 'scale(1)',
                      }}
                    />
                  </div>
                );
              })}

              {lane.events.length === 0 && (
                <div style={{ marginLeft: 16, fontSize: 10, color: 'var(--text-muted)' }}>
                  No transit activity recorded in this lane
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Step-by-Step Chronological Transfer Ledger */}
        <div className="timeline-stepper">
          <div className="timeline-stepper__title">
            Step-by-Step Execution Sequence (Click to inspect transfer)
          </div>

          <div className="timeline-stepper__cards">
            {events.map((evt, idx) => {
              const isSelected = selectedEventId === evt.id;
              const phaseConf = PHASE_CONFIG[evt.phase] || PHASE_CONFIG.spread;
              const bankConf = BANK_CONFIGS[evt.bank];

              return (
                <div
                  key={evt.id}
                  className={`step-card ${isSelected ? 'step-card--active' : ''}`}
                  onClick={() => onSelectEvent(evt.id)}
                >
                  <div className="step-card__top">
                    <span className="step-card__step-num">STEP #{idx + 1}</span>
                    <span
                      className="step-card__phase"
                      style={{
                        background: phaseConf.bg,
                        color: phaseConf.color,
                      }}
                    >
                      {phaseConf.label}
                    </span>
                  </div>

                  <div className="step-card__flow">
                    {evt.fromToken === 'EXTERNAL' ? 'EXTERNAL' : evt.fromToken} → {evt.toToken}
                  </div>

                  <div className="step-card__details">
                    <div style={{ color: '#fff', fontWeight: 600 }}>{bankConf.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {evt.amountBand} · {evt.channel} · {evt.timeFormatted}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Investigation Content Page
// ============================================

function AlertInvestigationContent() {
  const searchParams = useSearchParams();
  const chainParam = searchParams.get('chain');
  const initialChain = chainParam === '1' ? 1 : 0;

  const [activeChain, setActiveChain] = useState<number>(initialChain);
  const investigation = useMemo(() => generateAlertInvestigation(activeChain), [activeChain]);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    investigation.timeline[0]?.id || null
  );

  const [isFrozen, setIsFrozen] = useState(false);

  const recColor =
    investigation.recommendation === 'block'
      ? 'var(--crimson)'
      : investigation.recommendation === 'escalate'
      ? 'var(--amber)'
      : 'var(--cyan)';

  return (
    <div className="investigation">
      {/* Top Header */}
      <header className="investigation__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" className="btn btn--ghost" style={{ fontSize: 11, textDecoration: 'none' }}>
            ← Command Center
          </Link>
          <div style={{ height: 20, width: 1, background: 'var(--border-light)' }} />
          <div className="logo">
            <div className="logo__icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="#06b6d4" strokeWidth="2" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="#06b6d4" strokeWidth="2" />
              </svg>
            </div>
            <div className="logo__text-group">
              <div className="logo__text">
                ALERT INVESTIGATION
                <span className="logo__badge">FORENSICS</span>
              </div>
              <div className="logo__subtitle">Graph Correlation & Multi-Bank Reconstruction</div>
            </div>
          </div>
        </div>

        {/* Chain Selector Tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${activeChain === 0 ? 'btn--simulate' : 'btn--ghost'}`}
            onClick={() => {
              setActiveChain(0);
              setIsFrozen(false);
            }}
          >
            CHAIN TKQDQ — SCORE 92 (CRITICAL)
          </button>
          <button
            className={`btn ${activeChain === 1 ? 'btn--simulate' : 'btn--ghost'}`}
            onClick={() => {
              setActiveChain(1);
              setIsFrozen(false);
            }}
          >
            CHAIN TR9FN — SCORE 41 (WATCH)
          </button>
        </div>
      </header>

      {/* Main Forensic Grid */}
      <div className="investigation__grid">
        {/* Left Column — Telemetry & Reconstruction */}
        <div className="investigation__left">
          {/* Metadata Strip */}
          <div className="investigation__summary">
            <div className="investigation__summary-item">
              <span className="investigation__summary-label">Chain ID</span>
              <span className="investigation__summary-value" style={{ color: 'var(--cyan)' }}>
                {investigation.chainId.split('-')[1]}
              </span>
            </div>

            <div className="investigation__summary-item">
              <span className="investigation__summary-label">Institutions</span>
              <span className="investigation__summary-value">{investigation.banksInvolved.length} Banks</span>
            </div>

            <div className="investigation__summary-item">
              <span className="investigation__summary-label">Accounts</span>
              <span className="investigation__summary-value">{investigation.nodeCount} Entities</span>
            </div>

            <div className="investigation__summary-item">
              <span className="investigation__summary-label">Transfers</span>
              <span className="investigation__summary-value">{investigation.edgeCount} Hops</span>
            </div>

            <div className="investigation__summary-item">
              <span className="investigation__summary-label">Total Volume</span>
              <span className="investigation__summary-value">{investigation.totalAmount}</span>
            </div>

            <div className="investigation__summary-item">
              <span className="investigation__summary-label">Transit Time</span>
              <span className="investigation__summary-value">{investigation.transitTime}</span>
            </div>

            <div className="investigation__summary-item">
              <span className="investigation__summary-label">Detection</span>
              <span className="investigation__summary-value" style={{ color: 'var(--emerald)' }}>
                {investigation.detectionTime}s
              </span>
            </div>
          </div>

          {/* Swim-Lane Timeline */}
          <SwimLaneTimeline
            events={investigation.timeline}
            banks={investigation.banksInvolved}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
          />

          {/* AI Forensic Narrative & Tactical Execution Box */}
          <div className="investigation__narrative">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, fontWeight: 700 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" color="var(--cyan)">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>AI Forensic Reconstruction Debrief</span>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
              {investigation.narrative}
            </p>

            <div className="investigation__recommendation-bar" style={{ borderColor: recColor }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 'var(--r-xs)',
                    background: recColor,
                    color: '#fff',
                  }}
                >
                  SYSTEM RECOMMENDATION
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>
                  {investigation.recommendation.toUpperCase()}
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn--simulate"
                  onClick={() => setIsFrozen(true)}
                  disabled={isFrozen}
                  style={isFrozen ? { background: 'var(--emerald)', borderColor: 'var(--emerald)' } : undefined}
                >
                  {isFrozen ? '✓ FREEZE BROADCASTED' : '🚨 BROADCAST ENCLAVE FREEZE'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column — Risk Matrix & Factors */}
        <div className="investigation__right">
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-tertiary)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              Risk Assessment Model
            </div>
            <ScoreRing score={investigation.overallScore} />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
              Multi-factor GraphSAGE inference composite
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="section-header">
              <span>WEIGHTED RISK FACTORS</span>
            </div>

            {investigation.scoreFactors.map((f) => (
              <FactorBar key={f.id} factor={f} />
            ))}
          </div>

          {/* Weighted Aggregate */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px',
              borderRadius: 'var(--r-md)',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-light)',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
              Weighted Anomaly Sum
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 16,
                fontWeight: 800,
                color: investigation.overallScore > 75 ? 'var(--crimson)' : 'var(--amber)',
              }}
            >
              {investigation.scoreFactors.reduce((s, f) => s + f.weighted, 0).toFixed(1)} / 100
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AlertInvestigationPage() {
  return (
    <Suspense fallback={<div className="investigation"><div className="loader-ring" /></div>}>
      <AlertInvestigationContent />
    </Suspense>
  );
}
