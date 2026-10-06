/**
 * AlertPanel — Right sidebar with premium alert cards.
 */

'use client';

import React from 'react';
import { useGraphStore } from '@/store/graphStore';
import type { Alert } from '@/lib/types';

function AlertCard({ alert, isSelected }: { alert: Alert; isSelected: boolean }) {
  const { selectAlert } = useGraphStore();

  return (
    <div
      className={`alert-card alert-card--${alert.severity} ${isSelected ? 'alert-card--selected' : ''}`}
      onClick={() => selectAlert(isSelected ? null : alert.id)}
      style={isSelected ? { boxShadow: 'var(--shadow-glow-red)' } : undefined}
    >
      <div className="alert-card__header">
        <div className="alert-card__chain-name">
          <span className={`alert-card__severity-dot alert-card__severity-dot--${alert.severity}`} />
          Chain {alert.chainId.split('-')[1]?.toUpperCase() || 'X'}
        </div>
      </div>

      <div className="alert-card__score" style={{
        color: alert.score > 75 ? 'var(--red)' : alert.score > 50 ? 'var(--orange)' : 'var(--yellow)',
      }}>
        {alert.score}
      </div>

      <div className="alert-card__meta">
        <span>{alert.banksInvolved.length} banks</span>
        <span style={{ color: 'var(--text-muted)' }}>·</span>
        <span>{alert.nodeCount} accounts</span>
        <span style={{ color: 'var(--text-muted)' }}>·</span>
        <span>{alert.totalAmount}</span>
      </div>

      <div className="alert-card__detection">
        ⚡ {alert.detectionTime.toFixed(1)}s detection
      </div>

      {isSelected && (
        <div className="alert-card__summary animate-fade-in">
          {alert.summary}
        </div>
      )}
    </div>
  );
}

export default function AlertPanel() {
  const { alerts, selectedAlertId } = useGraphStore();
  const sorted = [...alerts].sort((a, b) => b.score - a.score);

  return (
    <div>
      <div className="section-header">
        Alerts
        {alerts.filter(a => a.status === 'active').length > 0 && (
          <span className="section-header__badge">
            {alerts.filter(a => a.status === 'active').length}
          </span>
        )}
      </div>

      {sorted.map((alert) => (
        <AlertCard key={alert.id} alert={alert} isSelected={selectedAlertId === alert.id} />
      ))}

      {alerts.length === 0 && (
        <div className="legend-card" style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}>
          No alerts detected.<br />
          <span style={{ fontSize: 10 }}>Run simulation to generate alerts.</span>
        </div>
      )}

      <div className="section-header" style={{ marginTop: 8 }}>Legend</div>
      <div className="legend-card">
        <div className="legend-card__item">
          <span className="legend-card__dot" style={{ background: 'var(--red)' }} />
          <span style={{ color: 'var(--red)', fontWeight: 700 }}>75+</span> Critical
        </div>
        <div className="legend-card__item">
          <span className="legend-card__dot" style={{ background: 'var(--orange)' }} />
          <span style={{ color: 'var(--orange)', fontWeight: 700 }}>50–74</span> High
        </div>
        <div className="legend-card__item">
          <span className="legend-card__dot" style={{ background: 'var(--yellow)' }} />
          <span style={{ color: 'var(--yellow)', fontWeight: 700 }}>25–49</span> Watch
        </div>
        <div className="legend-card__item">
          <span className="legend-card__dot" style={{ background: 'var(--cyan)' }} />
          <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>0–24</span> Info
        </div>
      </div>
    </div>
  );
}
