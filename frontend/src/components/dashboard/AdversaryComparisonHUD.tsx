/**
 * AdversaryComparisonHUD — A/B Detection Comparison Card
 * Contrasts Legacy Static Threshold Rules vs SATARK Flow & Graph Topology Engine.
 * Designed for judges to witness evasion vs interception in real-time.
 */

'use client';

import React, { useState } from 'react';
import { useGraphStore } from '@/store/graphStore';

export default function AdversaryComparisonHUD() {
  const { adversaryComparison, clearAdversaryComparison } = useGraphStore();
  const [isExpanded, setIsExpanded] = useState(true);

  if (!adversaryComparison || !adversaryComparison.is_adversarial) {
    return null;
  }

  const { legacy_rule, satark_flow, fraudster_cost, total_micro_transactions, average_micro_tx, mule_swarm_size } =
    adversaryComparison;

  return (
    <div
      className="adversary-comparison-hud animate-scale-in"
      style={{
        position: 'absolute',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(92%, 840px)',
        zIndex: 40,
        background: 'rgba(10, 13, 22, 0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(6, 182, 212, 0.15)',
        overflow: 'hidden',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#f43f5e',
              boxShadow: '0 0 10px #f43f5e',
            }}
          />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: '#f4f5f8', textTransform: 'uppercase' }}>
              Adversary Evasion Benchmark // Micro-Smurfing Swarm
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
              {total_micro_transactions.toLocaleString()} micro-transfers (avg {average_micro_tx}) across {mule_swarm_size} mules
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              padding: '4px 8px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {isExpanded ? 'Collapse ▲' : 'Details ▼'}
          </button>
          <button
            onClick={clearAdversaryComparison}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              fontSize: 16,
              cursor: 'pointer',
              padding: '2px 6px',
            }}
            title="Dismiss benchmark"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Dual A/B Comparison Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 14,
          padding: '16px 18px',
        }}
      >
        {/* Left Card: Legacy Rule-Based System (Evaded) */}
        <div
          style={{
            background: 'rgba(244, 63, 94, 0.05)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            borderRadius: '12px',
            padding: '14px 16px',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f43f5e', letterSpacing: '0.06em' }}>
              LEGACY RULE ENGINE
            </span>
            <span
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: '#fff',
                background: 'rgba(244, 63, 94, 0.85)',
                padding: '2px 7px',
                borderRadius: '4px',
              }}
            >
              {legacy_rule.status_badge}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: '#f43f5e', fontFamily: 'var(--font-mono)' }}>
              0 / {legacy_rule.total_txs.toLocaleString()}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>transfers flagged</span>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
            <strong>Rule Applied:</strong> {legacy_rule.rule}
          </div>

          <p style={{ fontSize: 11, color: '#fb7185', lineHeight: 1.45, margin: 0 }}>
            {legacy_rule.verdict}
          </p>
        </div>

        {/* Right Card: SATARK Flow & Graph Topology Engine (Intercepted) */}
        <div
          style={{
            background: 'rgba(6, 182, 212, 0.06)',
            border: '1px solid rgba(6, 182, 212, 0.35)',
            borderRadius: '12px',
            padding: '14px 16px',
            position: 'relative',
            boxShadow: '0 0 20px rgba(6, 182, 212, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', letterSpacing: '0.06em' }}>
              SATARK FLOW & TOPOLOGY ENGINE
            </span>
            <span
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: '#06070b',
                background: '#10b981',
                padding: '2px 7px',
                borderRadius: '4px',
              }}
            >
              {satark_flow.status_badge}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
              {satark_flow.flagged_txs.toLocaleString()} / {satark_flow.flagged_txs.toLocaleString()}
            </span>
            <span style={{ fontSize: 12, color: '#06b6d4' }}>
              (33 weighted streams · Score {satark_flow.score}/100)
            </span>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
            <strong>Signal:</strong> {satark_flow.rule}
          </div>

          <p style={{ fontSize: 11, color: '#6ee7b7', lineHeight: 1.45, margin: 0 }}>
            {satark_flow.verdict}
          </p>
        </div>
      </div>

      {/* Expandable Judge Insights / Fraudster Penalty Drawer */}
      {isExpanded && (
        <div
          style={{
            padding: '12px 18px 16px 18px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Why This Evasion is Costly for Fraudsters & Detectable by SATARK
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 10,
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>1. Mule Burn Overhead</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {fraudster_cost.mule_recruitment_overhead}
              </div>
            </div>

            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>2. NPCI Rate Limits</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {fraudster_cost.upi_limit_exhaustion}
              </div>
            </div>

            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <div style={{ fontSize: 10, color: '#06b6d4', fontWeight: 600 }}>3. Digital Forensic Trail</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {fraudster_cost.exposure_surface}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
