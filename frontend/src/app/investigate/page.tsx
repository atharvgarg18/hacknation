/**
 * Alert Investigation — Screen 3
 *
 * Deep-dive into a detected laundering chain:
 * - Swim-lane timeline showing money flow across banks
 * - Score breakdown with weighted risk factors
 * - Chain metadata and recommendation
 */

'use client';

import React, { useState, useMemo } from 'react';
import { BANK_CONFIGS } from '@/lib/types';
import type { BankId } from '@/lib/types';
import { generateAlertInvestigation, type AlertInvestigation, type TimelineEvent, type ScoreFactor } from '@/lib/alertData';
import Link from 'next/link';

// ============================================
// Score Ring (SVG donut)
// ============================================

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score > 75 ? 'var(--red)' : score > 50 ? 'var(--orange)' : 'var(--yellow)';

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ / 4}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="score-ring__value" style={{ color }}>
        {score}
      </div>
    </div>
  );
}

// ============================================
// Score Factor Bar
// ============================================

function FactorBar({ factor }: { factor: ScoreFactor }) {
  const barColor = factor.score > 75 ? 'var(--red)' : factor.score > 50 ? 'var(--orange)' : factor.score > 25 ? 'var(--yellow)' : 'var(--cyan)';

  return (
    <div className="factor-bar">
      <div className="factor-bar__header">
        <span className="factor-bar__icon">{factor.icon}</span>
        <span className="factor-bar__name">{factor.name}</span>
        <span className="factor-bar__weight">{(factor.weight * 100).toFixed(0)}%</span>
        <span className="factor-bar__score" style={{ color: barColor }}>{factor.score}</span>
      </div>
      <div className="factor-bar__track">
        <div
          className="factor-bar__fill"
          style={{ width: `${factor.score}%`, background: barColor, boxShadow: `0 0 8px ${barColor}` }}
        />
      </div>
      <div className="factor-bar__desc">{factor.description}</div>
    </div>
  );
}

// ============================================
// Swim-lane Timeline
// ============================================

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  entry: { label: 'ENTRY', color: 'var(--red)' },
  spread: { label: 'SPREAD', color: 'var(--orange)' },
  merge: { label: 'MERGE', color: 'var(--yellow)' },
  cashout: { label: 'CASH-OUT', color: 'var(--red)' },
};

function SwimLaneTimeline({ events, banks }: { events: TimelineEvent[]; banks: BankId[] }) {
  // Group events by bank for swim lanes
  const lanes = banks.map(bank => ({
    bank,
    config: BANK_CONFIGS[bank],
    events: events.filter(e => e.bank === bank),
  }));

  // Time range for positioning
  const times = events.map(e => e.timestamp.getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const range = maxTime - minTime || 1;

  return (
    <div className="swimlane">
      <div className="swimlane__header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        Money Flow Timeline
      </div>

      <div className="swimlane__body">
        {/* Time axis labels */}
        <div className="swimlane__time-axis">
          <span>{events[0]?.timeFormatted}</span>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--text-muted)' }}>
            ← {((maxTime - minTime) / 60000).toFixed(0)} min →
          </span>
          <span>{events[events.length - 1]?.timeFormatted}</span>
        </div>

        {/* Lanes */}
        {lanes.map((lane) => (
          <div key={lane.bank} className="swimlane__lane">
            <div className={`swimlane__lane-label swimlane__lane-label--${lane.bank}`}>
              <span className="swimlane__lane-badge">{lane.config.shortName}</span>
              {lane.config.name}
            </div>
            <div className="swimlane__lane-track">
              {/* Connection lines */}
              {lane.events.map((evt, i) => {
                const left = ((evt.timestamp.getTime() - minTime) / range) * 100;
                return (
                  <div
                    key={evt.id}
                    className={`swimlane__event swimlane__event--${evt.phase}`}
                    style={{ left: `${Math.min(Math.max(left, 3), 97)}%` }}
                  >
                    <div className="swimlane__event-dot" />
                    <div className="swimlane__event-info">
                      <span className="swimlane__event-phase" style={{ color: PHASE_LABELS[evt.phase].color }}>
                        {PHASE_LABELS[evt.phase].label}
                      </span>
                      <span className="swimlane__event-tokens">
                        {evt.fromToken === 'EXTERNAL' ? '⬇ EXT' : evt.fromToken} → {evt.toToken}
                      </span>
                      <span className="swimlane__event-meta">
                        {evt.amountBand} · {evt.channel} · {evt.timeFormatted}
                      </span>
                    </div>
                  </div>
                );
              })}

              {lane.events.length === 0 && (
                <div className="swimlane__empty">No activity in this lane</div>
              )}
            </div>
          </div>
        ))}

        {/* Phase flow indicator */}
        <div className="swimlane__flow">
          {['entry', 'spread', 'merge', 'cashout'].map((phase) => (
            <div key={phase} className="swimlane__flow-step">
              <span className="swimlane__flow-dot" style={{ background: PHASE_LABELS[phase].color }} />
              <span style={{ color: PHASE_LABELS[phase].color }}>{PHASE_LABELS[phase].label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Page
// ============================================

export default function AlertInvestigationPage() {
  const [activeChain, setActiveChain] = useState(0);
  const investigation = useMemo(() => generateAlertInvestigation(activeChain), [activeChain]);

  const recColor = investigation.recommendation === 'block' ? 'var(--red)' :
                   investigation.recommendation === 'escalate' ? 'var(--orange)' : 'var(--yellow)';

  return (
    <div className="investigation">
      {/* Header */}
      <header className="investigation__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" className="btn btn--ghost" style={{ fontSize: 11, textDecoration: 'none' }}>
            ← Command Center
          </Link>
          <div style={{ height: 20, width: 1, background: 'var(--border-light)' }} />
          <div className="logo">
            <div className="logo__icon" style={{ width: 28, height: 28, fontSize: 12 }}>S</div>
            <div>
              <div className="logo__text" style={{ fontSize: 14 }}>Alert Investigation</div>
              <div className="logo__subtitle">Chain Analysis & Score Breakdown</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${activeChain === 0 ? 'btn--simulate' : 'btn--ghost'}`}
            onClick={() => setActiveChain(0)}
            style={{ fontSize: 11 }}
          >
            Chain TKQDQ — Score 92
          </button>
          <button
            className={`btn ${activeChain === 1 ? 'btn--simulate' : 'btn--ghost'}`}
            onClick={() => setActiveChain(1)}
            style={{ fontSize: 11 }}
          >
            Chain TR9FN — Score 41
          </button>
        </div>
      </header>

      {/* Content Grid */}
      <div className="investigation__grid">
        {/* Left — Timeline + Metadata */}
        <div className="investigation__left">
          {/* Chain Summary Bar */}
          <div className="investigation__summary">
            <div className="investigation__summary-item">
              <span className="investigation__summary-label">Chain</span>
              <span className="investigation__summary-value" style={{ color: 'var(--teal)', fontFamily: 'var(--font-mono)' }}>
                {investigation.chainId.split('-')[1]}
              </span>
            </div>
            <div className="investigation__summary-item">
              <span className="investigation__summary-label">Banks</span>
              <span className="investigation__summary-value">{investigation.banksInvolved.length}</span>
            </div>
            <div className="investigation__summary-item">
              <span className="investigation__summary-label">Accounts</span>
              <span className="investigation__summary-value">{investigation.nodeCount}</span>
            </div>
            <div className="investigation__summary-item">
              <span className="investigation__summary-label">Transfers</span>
              <span className="investigation__summary-value">{investigation.edgeCount}</span>
            </div>
            <div className="investigation__summary-item">
              <span className="investigation__summary-label">Amount</span>
              <span className="investigation__summary-value">{investigation.totalAmount}</span>
            </div>
            <div className="investigation__summary-item">
              <span className="investigation__summary-label">Transit</span>
              <span className="investigation__summary-value">{investigation.transitTime}</span>
            </div>
            <div className="investigation__summary-item">
              <span className="investigation__summary-label">Detection</span>
              <span className="investigation__summary-value" style={{ color: 'var(--green)' }}>
                {investigation.detectionTime}s
              </span>
            </div>
          </div>

          {/* Swim-lane Timeline */}
          <SwimLaneTimeline events={investigation.timeline} banks={investigation.banksInvolved} />

          {/* Narrative */}
          <div className="investigation__narrative">
            <div className="investigation__narrative-header">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Investigation Narrative
            </div>
            <p className="investigation__narrative-text">{investigation.narrative}</p>
            <div className="investigation__recommendation" style={{ borderColor: recColor }}>
              <span className="investigation__rec-label" style={{ color: recColor }}>
                RECOMMENDATION
              </span>
              <span className="investigation__rec-action" style={{ color: recColor }}>
                {investigation.recommendation.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Right — Score Breakdown */}
        <div className="investigation__right">
          <div className="investigation__score-header">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Risk Score
            </div>
            <ScoreRing score={investigation.overallScore} />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 4 }}>
              Weighted composite of {investigation.scoreFactors.length} factors
            </div>
          </div>

          <div className="investigation__factors">
            <div className="investigation__factors-title">Score Breakdown</div>
            {investigation.scoreFactors.map(f => (
              <FactorBar key={f.id} factor={f} />
            ))}
          </div>

          {/* Weighted total */}
          <div className="investigation__total">
            <span>Weighted Total</span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              color: investigation.overallScore > 75 ? 'var(--red)' : 'var(--orange)',
            }}>
              {investigation.scoreFactors.reduce((s, f) => s + f.weighted, 0).toFixed(1)} / 100
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
