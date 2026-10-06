/**
 * BankFeedPanel — Left sidebar with premium bank status cards.
 */

'use client';

import React from 'react';
import { useGraphStore } from '@/store/graphStore';
import { BANK_CONFIGS } from '@/lib/types';

export default function BankFeedPanel() {
  const { bankStats } = useGraphStore();

  return (
    <div>
      <div className="section-header">Bank Feeds</div>

      {bankStats.map((stat) => {
        const config = BANK_CONFIGS[stat.bank];
        return (
          <div key={stat.bank} className={`bank-card bank-card--${stat.bank}`}>
            <div className="bank-card__header">
              <span className="status-dot status-dot--active" />
              <span className="bank-card__name">{config.name}</span>
            </div>
            <div className="bank-card__stats">
              <div className="bank-card__stat-item">
                <span className="bank-card__stat-label">TXN</span>
                <span className="bank-card__stat-value">{stat.totalTransactions.toLocaleString()}</span>
              </div>
              <div className="bank-card__stat-item">
                <span className="bank-card__stat-label">Tokens</span>
                <span className="bank-card__stat-value">{stat.tokensSent.toLocaleString()}</span>
              </div>
              {stat.activeAlerts > 0 && (
                <div className="bank-card__stat-item">
                  <span className="bank-card__stat-label">Alerts</span>
                  <span className="bank-card__stat-value bank-card__stat-value--alert">{stat.activeAlerts}</span>
                </div>
              )}
              <div className="bank-card__stat-item">
                <span className="bank-card__stat-label">Risk</span>
                <span className="bank-card__stat-value" style={{
                  color: stat.riskScore > 70 ? 'var(--red)' : stat.riskScore > 40 ? 'var(--yellow)' : 'var(--teal)',
                  fontSize: 16,
                }}>{stat.riskScore}</span>
              </div>
            </div>
          </div>
        );
      })}

      <div className="section-header" style={{ marginTop: 6 }}>Network</div>
      <div className="net-status">
        <div className="net-status__header">
          <span className="status-dot status-dot--active" />
          Peer Sync Optimal
        </div>
        <div className="net-status__row">
          <span>Coordinator</span>
          <span className="net-status__val net-status__val--green">ONLINE</span>
        </div>
        <div className="net-status__row">
          <span>Edge Nodes</span>
          <span className="net-status__val net-status__val--green">3/3</span>
        </div>
        <div className="net-status__row">
          <span>Avg Latency</span>
          <span className="net-status__val">12ms</span>
        </div>
        <div className="net-status__row">
          <span>Model</span>
          <span className="net-status__val">GraphSAGE v1.2</span>
        </div>
      </div>
    </div>
  );
}
