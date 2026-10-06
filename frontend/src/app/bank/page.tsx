/**
 * Bank Console — Screen 2
 * 
 * Two-layer architecture inside each bank:
 * 1. Channel Edge — fast rule-based risk checks (structuring, velocity, drain)
 * 2. Transaction view — raw vs tokenized side-by-side with Hub status
 *
 * Bank login selector → Dashboard with both layers visible
 */

'use client';

import React, { useState, useMemo } from 'react';
import { BANK_CONFIGS } from '@/lib/types';
import type { BankId } from '@/lib/types';
import { generateBankTransactions, type TransactionPair, type ChannelEdgeFlag } from '@/lib/bankData';
import Link from 'next/link';

// ============================================
// Bank Login Screen
// ============================================

function BankLoginScreen({ onSelect }: { onSelect: (bank: BankId) => void }) {
  return (
    <div className="bank-login">
      <div className="bank-login__container">
        <div className="bank-login__header">
          <div className="logo" style={{ justifyContent: 'center' }}>
            <div className="logo__icon">S</div>
            <div>
              <div className="logo__text">FALSE SET</div>
              <div className="logo__subtitle">Bank Console Access</div>
            </div>
          </div>
          <p className="bank-login__desc">
            Select your institution to access the transaction monitoring console.
            Each bank sees only its own data — names and accounts never leave your system.
          </p>
        </div>

        <div className="bank-login__cards">
          {(['axis', 'icici', 'hdfc'] as BankId[]).map((bankId) => {
            const config = BANK_CONFIGS[bankId];
            return (
              <button
                key={bankId}
                className={`bank-login__card bank-login__card--${bankId}`}
                onClick={() => onSelect(bankId)}
              >
                <div className="bank-login__card-icon">
                  {config.shortName}
                </div>
                <div className="bank-login__card-name">{config.name}</div>
                <div className="bank-login__card-action">Access Console →</div>
              </button>
            );
          })}
        </div>

        <Link href="/" className="bank-login__back">
          ← Back to Command Center
        </Link>
      </div>
    </div>
  );
}

// ============================================
// Channel Edge Panel — Layer 1 (fast rules)
// ============================================

function ChannelEdgePanel({ pairs }: { pairs: TransactionPair[] }) {
  const flaggedPairs = pairs.filter(p => p.channelEdgeFlags.length > 0);
  const allFlags = flaggedPairs.flatMap(p =>
    p.channelEdgeFlags.map(f => ({ ...f, txnId: p.raw.id, sender: p.raw.senderName, time: p.raw.timeFormatted, amount: p.raw.amountFormatted }))
  );
  const criticalCount = allFlags.filter(f => f.severity === 'critical').length;
  const highCount = allFlags.filter(f => f.severity === 'high').length;
  const medCount = allFlags.filter(f => f.severity === 'medium' || f.severity === 'low').length;

  return (
    <div className="channel-edge">
      <div className="channel-edge__header">
        <div className="channel-edge__title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          Channel Edge — Fast Risk Check
          <span className="channel-edge__layer-tag">LAYER 1</span>
        </div>
        <div className="channel-edge__counts">
          {criticalCount > 0 && <span className="ce-count ce-count--critical">{criticalCount} critical</span>}
          {highCount > 0 && <span className="ce-count ce-count--high">{highCount} high</span>}
          {medCount > 0 && <span className="ce-count ce-count--med">{medCount} watch</span>}
          <span className="ce-count ce-count--clear">{pairs.length - flaggedPairs.length} clear</span>
        </div>
      </div>

      <div className="channel-edge__alerts">
        {allFlags.map((flag, i) => (
          <div key={i} className={`ce-alert ce-alert--${flag.severity}`}>
            <div className="ce-alert__top">
              <span className={`ce-alert__severity ce-alert__severity--${flag.severity}`}>
                {flag.severity.toUpperCase()}
              </span>
              <span className="ce-alert__rule">{flag.ruleName}</span>
              <span className="ce-alert__meta">{flag.sender} · {flag.time} · {flag.amount}</span>
            </div>
            <div className="ce-alert__desc">{flag.description}</div>
          </div>
        ))}
        {allFlags.length === 0 && (
          <div className="ce-alert ce-alert--empty">
            <span style={{ color: 'var(--green)' }}>✓</span> All transactions passed channel edge checks
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Transaction Tables
// ============================================

function RawTable({ pairs }: { pairs: TransactionPair[] }) {
  return (
    <div className="txn-table-wrap">
      <div className="txn-table__header">
        <span className="txn-table__header-dot" />
        <span>Raw Transactions</span>
        <span className="txn-table__header-badge txn-table__header-badge--private">PRIVATE — Inside Bank Only</span>
      </div>
      <div className="txn-table-scroll">
        <table className="txn-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Sender</th>
              <th>Account</th>
              <th>Receiver</th>
              <th>Account</th>
              <th>Amount</th>
              <th>Ch.</th>
              <th>Edge</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p) => (
              <tr key={p.raw.id} className={p.channelEdgeFlags.length > 0 ? 'txn-row--suspicious' : ''}>
                <td className="txn-cell--mono">{p.raw.timeFormatted}</td>
                <td className="txn-cell--name">{p.raw.senderName}</td>
                <td className="txn-cell--mono txn-cell--account">{p.raw.senderAccount}</td>
                <td className="txn-cell--name">{p.raw.receiverName}</td>
                <td className="txn-cell--mono txn-cell--account">{p.raw.receiverAccount}</td>
                <td className="txn-cell--mono txn-cell--amount">{p.raw.amountFormatted}</td>
                <td className="txn-cell--channel">{p.raw.channel}</td>
                <td>
                  {p.channelEdgeFlags.length > 0 ? (
                    <span className={`ce-inline ce-inline--${p.channelEdgeFlags[0].severity}`}>
                      {p.channelEdgeFlags.length}
                    </span>
                  ) : (
                    <span className="ce-inline ce-inline--clear">✓</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TokenizedTable({ pairs }: { pairs: TransactionPair[] }) {
  return (
    <div className="txn-table-wrap">
      <div className="txn-table__header">
        <span className="txn-table__header-dot txn-table__header-dot--teal" />
        <span>Tokenized View</span>
        <span className="txn-table__header-badge txn-table__header-badge--shared">SHARED — Sent to Hub</span>
      </div>
      <div className="txn-table-scroll">
        <table className="txn-table txn-table--tokenized">
          <thead>
            <tr>
              <th>Window</th>
              <th>Sender</th>
              <th>Receiver</th>
              <th>Band</th>
              <th>Ch.</th>
              <th>Hub</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p) => (
              <tr key={p.tokenized.id} className={p.channelEdgeFlags.length > 0 ? 'txn-row--suspicious' : ''}>
                <td className="txn-cell--mono">{p.tokenized.timeWindow}</td>
                <td className="txn-cell--token">{p.tokenized.senderToken}</td>
                <td className="txn-cell--token">{p.tokenized.receiverToken}</td>
                <td className="txn-cell--band">{p.tokenized.amountBand}</td>
                <td className="txn-cell--channel">{p.tokenized.channel}</td>
                <td>
                  <span className={`hub-status hub-status--${p.tokenized.hubStatus}`}>
                    {p.tokenized.hubStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// Bank Console Dashboard
// ============================================

function BankDashboard({ bank, onLogout }: { bank: BankId; onLogout: () => void }) {
  const config = BANK_CONFIGS[bank];
  const pairs = useMemo(() => generateBankTransactions(bank, 30), [bank]);

  const flaggedCount = pairs.filter(p => p.channelEdgeFlags.length > 0).length;
  const sentCount = pairs.filter(p => p.tokenized.hubStatus === 'sent').length;
  const heldCount = pairs.filter(p => p.tokenized.hubStatus === 'held').length;

  return (
    <div className={`bank-console bank-console--${bank}`}>
      {/* Header */}
      <header className="bank-console__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn--ghost" onClick={onLogout} style={{ fontSize: 11 }}>
            ← Switch Bank
          </button>
          <div style={{ height: 20, width: 1, background: 'var(--border-light)' }} />
          <div className={`bank-console__bank-badge bank-console__bank-badge--${bank}`}>
            {config.shortName}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{config.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
              TRANSACTION MONITORING CONSOLE
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="bank-console__stat-chips">
            <div className="stat-chip">
              <span className="stat-chip__label">Transactions</span>
              <span className="stat-chip__value">{pairs.length}</span>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">Edge Flags</span>
              <span className="stat-chip__value stat-chip__value--red">{flaggedCount}</span>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">Sent to Hub</span>
              <span className="stat-chip__value stat-chip__value--green">{sentCount}</span>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">Held</span>
              <span className="stat-chip__value stat-chip__value--yellow">{heldCount}</span>
            </div>
          </div>

          <Link href="/" className="btn btn--ghost" style={{ fontSize: 11, textDecoration: 'none' }}>
            Command Center ↗
          </Link>
        </div>
      </header>

      {/* Channel Edge — Layer 1 */}
      <ChannelEdgePanel pairs={pairs} />

      {/* Privacy Banner */}
      <div className="bank-console__privacy-banner">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <span>
          <strong>Left table</strong> shows real customer data — <strong>never leaves {config.name}</strong>.
          <strong> Right table</strong> shows what is shared with the False Set hub — names removed, accounts tokenized, amounts banded.
        </span>
      </div>

      {/* Side-by-side Tables */}
      <div className="bank-console__tables">
        <RawTable pairs={pairs} />
        <div className="bank-console__arrow-col">
          {pairs.map((p, i) => (
            <div key={i} className={`arrow-indicator ${p.channelEdgeFlags.length > 0 ? 'arrow-indicator--held' : ''}`}>
              →
            </div>
          ))}
        </div>
        <TokenizedTable pairs={pairs} />
      </div>
    </div>
  );
}

// ============================================
// Page Component
// ============================================

export default function BankConsolePage() {
  const [selectedBank, setSelectedBank] = useState<BankId | null>(null);

  if (!selectedBank) {
    return <BankLoginScreen onSelect={setSelectedBank} />;
  }

  return <BankDashboard bank={selectedBank} onLogout={() => setSelectedBank(null)} />;
}
