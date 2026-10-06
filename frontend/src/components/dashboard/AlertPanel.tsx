/**
 * AlertPanel — Threat Intelligence & Correlated Chains
 * Right sidebar with Apple-clear frosted alert cards and instant investigation deep-links.
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { useGraphStore } from '@/store/graphStore';
import type { Alert } from '@/lib/types';

function AlertCardItem({ alert, isSelected }: { alert: Alert; isSelected: boolean }) {
  const { selectAlert } = useGraphStore();

  const isCritical = alert.score > 75;
  const isHigh = alert.score > 50 && alert.score <= 75;
  const scoreClass = isCritical
    ? 'alert-card__score--critical'
    : isHigh
    ? 'alert-card__score--high'
    : 'alert-card__score--medium';

  const chainIndex = alert.chainId.includes('TKQDQ') || alert.id.includes('1') ? 0 : 1;

  return (
    <div
      className={`alert-card alert-card--${alert.severity} ${isSelected ? 'alert-card--selected' : ''}`}
      onClick={() => selectAlert(isSelected ? null : alert.id)}
    >
      {/* Top Header */}
      <div className="alert-card__top">
        <div className="alert-card__chain-id">
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isCritical ? 'var(--crimson)' : 'var(--amber)',
              boxShadow: isCritical ? '0 0 8px var(--crimson)' : '0 0 6px var(--amber)',
            }}
          />
          CHAIN // {alert.chainId.split('-')[1]?.toUpperCase() || 'TKQDQ'}
        </div>

        <div className={`alert-card__risk-score ${scoreClass}`}>
          {alert.score}
        </div>
      </div>

      {/* Cross-Bank Laundering Flow */}
      <div className="alert-card__transit-path">
        <span className="transit-node" style={{ color: 'var(--axis)' }}>AXIS</span>
        <span>→</span>
        <span className="transit-node" style={{ color: 'var(--icici)' }}>ICICI</span>
        <span>→</span>
        <span className="transit-node" style={{ color: 'var(--hdfc)' }}>HDFC</span>
        <span>→</span>
        <span className="transit-node" style={{ color: 'var(--axis)' }}>AXIS</span>
      </div>

      {/* Micro-Metrics Grid */}
      <div className="alert-card__meta-grid">
        <div className="alert-card__meta-item">
          <span className="alert-card__meta-label">Entities</span>
          <span className="alert-card__meta-val">{alert.nodeCount} accts</span>
        </div>
        <div className="alert-card__meta-item">
          <span className="alert-card__meta-label">Volume</span>
          <span className="alert-card__meta-val">{alert.totalAmount}</span>
        </div>
        <div className="alert-card__meta-item">
          <span className="alert-card__meta-label">Latency</span>
          <span className="alert-card__meta-val" style={{ color: 'var(--cyan)' }}>
            {alert.detectionTime.toFixed(1)}s
          </span>
        </div>
      </div>

      {/* Footer & Deep-Dive Link */}
      <div className="alert-card__footer">
        <span>⚡ Real-Time Graph Match</span>
        <Link
          href={`/investigate?chain=${chainIndex}`}
          className="alert-card__inspect-btn"
          onClick={(e) => e.stopPropagation()}
        >
          Investigate →
        </Link>
      </div>

      {isSelected && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: '1px solid var(--border-light)',
            fontSize: 11,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
          className="animate-fade-in"
        >
          {alert.summary}
        </div>
      )}
    </div>
  );
}

export default function AlertPanel() {
  const { alerts, selectedAlertId } = useGraphStore();
  const sorted = [...alerts].sort((a, b) => b.score - a.score);
  const activeCount = alerts.filter((a) => a.status === 'active').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div className="section-header">
        <span>THREAT INTELLIGENCE</span>
        {activeCount > 0 && (
          <span className="section-header__badge">{activeCount} CRITICAL</span>
        )}
      </div>

      {/* Alert List */}
      {sorted.map((alert) => (
        <AlertCardItem
          key={alert.id}
          alert={alert}
          isSelected={selectedAlertId === alert.id}
        />
      ))}

      {alerts.length === 0 && (
        <div
          className="legend-card"
          style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}
        >
          No correlated laundering chains active.<br />
          <span style={{ fontSize: 10 }}>Trigger attack simulation to correlate rings.</span>
        </div>
      )}

      {/* Threshold Reference */}
      <div className="section-header" style={{ marginTop: 4 }}>
        <span>ANOMALY THRESHOLDS</span>
      </div>

      <div className="legend-card">
        <div className="legend-card__grid">
          <div className="legend-card__item">
            <span className="legend-card__dot" style={{ background: 'var(--crimson)' }} />
            <span><strong>75+</strong> Critical Ring</span>
          </div>
          <div className="legend-card__item">
            <span className="legend-card__dot" style={{ background: 'var(--amber)' }} />
            <span><strong>50–74</strong> High Spread</span>
          </div>
          <div className="legend-card__item">
            <span className="legend-card__dot" style={{ background: 'var(--amber)', opacity: 0.7 }} />
            <span><strong>25–49</strong> Watchlist</span>
          </div>
          <div className="legend-card__item">
            <span className="legend-card__dot" style={{ background: 'var(--cyan)' }} />
            <span><strong>0–24</strong> Standard Flow</span>
          </div>
        </div>
      </div>
    </div>
  );
}
