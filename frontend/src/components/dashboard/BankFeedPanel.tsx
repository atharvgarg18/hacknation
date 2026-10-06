/**
 * BankFeedPanel — Deep-Tech Bank Edge Enclaves Telemetry
 * Left sidebar showcasing Layer 1 Edge node states, token volumes, and pipeline health.
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { useGraphStore } from '@/store/graphStore';
import { BANK_CONFIGS, BankId } from '@/lib/types';

export default function BankFeedPanel() {
  const { bankStats } = useGraphStore();

  const totalTxns = bankStats.reduce((sum, s) => sum + s.totalTransactions, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Telemetry Header */}
      <div className="section-header">
        <span>EDGE ENCLAVES</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--cyan)' }}>
          {totalTxns} TXNS INGESTED
        </span>
      </div>

      {/* Bank Nodes */}
      {bankStats.map((stat) => {
        const config = BANK_CONFIGS[stat.bank];
        const isAlert = stat.riskScore > 75;
        const riskColor = stat.riskScore > 75 ? 'var(--crimson)' : stat.riskScore > 40 ? 'var(--amber)' : 'var(--emerald)';

        return (
          <Link
            key={stat.bank}
            href={`/bank?bank=${stat.bank}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className={`bank-card bank-card--${stat.bank}`}>
              {/* Header */}
              <div className="bank-card__header">
                <div className="bank-card__title-group">
                  <span className={`bank-card__badge bank-card__badge--${stat.bank}`}>
                    {config.shortName}
                  </span>
                  <span className="bank-card__name">{config.name}</span>
                </div>

                <span className={`bank-card__edge-status ${isAlert ? 'bank-card__edge-status--alert' : ''}`}>
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: isAlert ? 'var(--crimson)' : 'var(--emerald)',
                    }}
                  />
                  {stat.activeAlerts > 0 ? `L1: ${stat.activeAlerts} Flags` : 'L1: Armed'}
                </span>
              </div>

              {/* Data Grid */}
              <div className="bank-card__stats">
                <div className="bank-card__stat-item">
                  <span className="bank-card__stat-label">Txn Count</span>
                  <span className="bank-card__stat-value">{stat.totalTransactions.toLocaleString()}</span>
                </div>

                <div className="bank-card__stat-item">
                  <span className="bank-card__stat-label">Tokens</span>
                  <span className="bank-card__stat-value" style={{ color: 'var(--cyan)' }}>
                    {stat.tokensSent.toLocaleString()}
                  </span>
                </div>

                <div className="bank-card__stat-item">
                  <span className="bank-card__stat-label">Risk Index</span>
                  <span
                    className="bank-card__stat-value"
                    style={{ color: riskColor }}
                  >
                    {stat.riskScore}
                  </span>
                </div>
              </div>

              {/* High-Precision Risk Meter Bar */}
              <div className="bank-card__meter-bar">
                <div
                  className="bank-card__meter-fill"
                  style={{
                    width: `${Math.min(stat.riskScore, 100)}%`,
                    background: riskColor,
                    boxShadow: `0 0 8px ${riskColor}`,
                  }}
                />
              </div>
            </div>
          </Link>
        );
      })}

      {/* Deep-Tech Cryptographic Pipeline Health */}
      <div className="section-header" style={{ marginTop: 4 }}>
        <span>PIPELINE TELEMETRY</span>
      </div>

      <div className="net-status">
        <div className="net-status__header">
          <div className="net-status__title">
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--emerald)',
                boxShadow: '0 0 6px var(--emerald)',
              }}
            />
            <span>ZKP COORDINATOR</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--emerald)' }}>
            HEALTHY
          </span>
        </div>

        <div className="net-status__row">
          <span>Consensus Protocol</span>
          <span className="net-status__val net-status__val--green">BFT-Gossip v2.1</span>
        </div>

        <div className="net-status__row">
          <span>Privacy Budget</span>
          <span className="net-status__val" style={{ color: 'var(--cyan)' }}>
            ε = 0.15 (DP)
          </span>
        </div>

        <div className="net-status__row">
          <span>Enclave Latency</span>
          <span className="net-status__val">11.8 ms</span>
        </div>

        <div className="net-status__row">
          <span>Detection Engine</span>
          <span className="net-status__val">GraphSAGE GNN</span>
        </div>
      </div>
    </div>
  );
}
