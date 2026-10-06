/**
 * Bank Console — Screen 2
 * 
 * Two-layer architecture inside each bank:
 * 1. Channel Edge (Layer 1) — Fast rule-based risk checks (structuring, velocity spike, account drain)
 * 2. Privacy Tokenization Gateway — Side-by-side comparison of Raw (On-Prem PII) vs Tokenized (Hub-Shared)
 */

'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BANK_CONFIGS } from '@/lib/types';
import type { BankId } from '@/lib/types';
import { generateBankTransactions, type TransactionPair, type ChannelEdgeFlag } from '@/lib/bankData';
import Link from 'next/link';

// ============================================
// Bank Login Screen (Apple Frosted Institution Cards)
// ============================================

function BankLoginScreen({ onSelect }: { onSelect: (bank: BankId) => void }) {
  return (
    <div className="bank-login">
      <div className="bank-login__container animate-fade-in">
        <div className="bank-login__header">
          <div className="logo" style={{ justifyContent: 'center', marginBottom: 12 }}>
            <div className="logo__icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="6" cy="12" r="3" fill="#06b6d4" />
                <circle cx="18" cy="6" r="3" fill="#8b5cf6" />
                <circle cx="18" cy="18" r="3" fill="#f43f5e" />
                <path d="M9 12L15 7M9 12L15 17" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeDasharray="2 2" />
              </svg>
            </div>
            <div className="logo__text-group" style={{ textAlign: 'left' }}>
              <div className="logo__text">
                FALSE SET
                <span className="logo__badge">ENCLAVE</span>
              </div>
              <div className="logo__subtitle">Bank Console Node Access</div>
            </div>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
            Select Financial Institution
          </h2>
          <p className="bank-login__desc">
            Access your institution&apos;s isolated on-premises monitoring node. Real names and raw account numbers remain inside your internal security perimeter.
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
                <div className="bank-login__card-action">
                  <span>Enter Enclave</span>
                  <span>→</span>
                </div>
              </button>
            );
          })}
        </div>

        <Link href="/" className="btn btn--ghost" style={{ textDecoration: 'none', display: 'inline-flex' }}>
          ← Back to Command Center
        </Link>
      </div>
    </div>
  );
}

// ============================================
// Channel Edge Panel — Layer 1 (Fast In-Bank Rule Engine)
// ============================================

function ChannelEdgePanel({ pairs }: { pairs: TransactionPair[] }) {
  const flaggedPairs = pairs.filter((p) => p.channelEdgeFlags.length > 0);
  const allFlags = flaggedPairs.flatMap((p) =>
    p.channelEdgeFlags.map((f) => ({
      ...f,
      txnId: p.raw.id,
      sender: p.raw.senderName,
      time: p.raw.timeFormatted,
      amount: p.raw.amountFormatted,
    }))
  );
  const criticalCount = allFlags.filter((f) => f.severity === 'critical').length;
  const highCount = allFlags.filter((f) => f.severity === 'high').length;
  const medCount = allFlags.filter((f) => f.severity === 'medium' || f.severity === 'low').length;

  return (
    <div className="channel-edge">
      <div className="channel-edge__header">
        <div className="channel-edge__title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span>Channel Edge // Fast Risk Check</span>
          <span className="channel-edge__layer-tag">LAYER 1 (LOCAL)</span>
        </div>
        <div className="channel-edge__counts">
          {criticalCount > 0 && <span className="ce-count ce-count--critical">{criticalCount} Critical</span>}
          {highCount > 0 && <span className="ce-count ce-count--high">{highCount} High</span>}
          {medCount > 0 && <span className="ce-count ce-count--med">{medCount} Watch</span>}
          <span className="ce-count ce-count--clear">{pairs.length - flaggedPairs.length} Clear</span>
        </div>
      </div>

      <div className="channel-edge__alerts">
        {allFlags.map((flag, i) => (
          <div key={i} className={`ce-alert ce-alert--${flag.severity}`}>
            <div className="ce-alert__top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span className={`ce-alert__severity ce-alert__severity--${flag.severity}`}>
                {flag.severity.toUpperCase()}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{flag.ruleName}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>
                {flag.time}
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {flag.description}
            </div>
          </div>
        ))}

        {allFlags.length === 0 && (
          <div className="ce-alert" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--emerald)' }}>
            <span>✓</span> All {pairs.length} transactions cleared local channel edge checks.
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Raw Table (Private — Inside Bank Core)
// ============================================

function RawTable({ pairs }: { pairs: TransactionPair[] }) {
  return (
    <div className="txn-table-wrap">
      <div className="txn-table__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--crimson)',
              boxShadow: '0 0 6px var(--crimson)',
            }}
          />
          <span>Raw Transaction Feed</span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 'var(--r-xs)',
            background: 'rgba(244, 63, 94, 0.12)',
            color: 'var(--crimson)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
          }}
        >
          PRIVATE // ON-PREMISES ONLY
        </span>
      </div>

      <div className="txn-table__scroll">
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
              <th>L1</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p) => {
              const hasFlag = p.channelEdgeFlags.length > 0;
              return (
                <tr
                  key={p.raw.id}
                  style={hasFlag ? { background: 'rgba(244, 63, 94, 0.05)' } : undefined}
                >
                  <td style={{ color: 'var(--text-tertiary)' }}>{p.raw.timeFormatted}</td>
                  <td style={{ fontWeight: 600, color: '#fff' }}>{p.raw.senderName}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.raw.senderAccount}</td>
                  <td style={{ fontWeight: 600, color: '#fff' }}>{p.raw.receiverName}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.raw.receiverAccount}</td>
                  <td style={{ fontWeight: 700, color: '#fff' }}>{p.raw.amountFormatted}</td>
                  <td>{p.raw.channel}</td>
                  <td>
                    {hasFlag ? (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '1px 5px',
                          borderRadius: 3,
                          fontSize: 9,
                          fontWeight: 800,
                          background: 'rgba(244, 63, 94, 0.2)',
                          color: 'var(--crimson)',
                        }}
                      >
                        {p.channelEdgeFlags.length}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--emerald)' }}>✓</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// Tokenized Table (Shared with Central Hub)
// ============================================

function TokenizedTable({ pairs }: { pairs: TransactionPair[] }) {
  return (
    <div className="txn-table-wrap">
      <div className="txn-table__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--cyan)',
              boxShadow: '0 0 6px var(--cyan)',
            }}
          />
          <span>Tokenized Hub Stream</span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 'var(--r-xs)',
            background: 'rgba(6, 182, 212, 0.12)',
            color: 'var(--cyan)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
          }}
        >
          SHARED // ZERO PII EXPOSURE
        </span>
      </div>

      <div className="txn-table__scroll">
        <table className="txn-table">
          <thead>
            <tr>
              <th>Window</th>
              <th>Sender Hash</th>
              <th>Receiver Hash</th>
              <th>Amount Band</th>
              <th>Channel</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p) => {
              const isHeld = p.tokenized.hubStatus === 'held';
              return (
                <tr
                  key={p.tokenized.id}
                  style={isHeld ? { background: 'rgba(245, 158, 11, 0.05)' } : undefined}
                >
                  <td style={{ color: 'var(--text-tertiary)' }}>{p.tokenized.timeWindow}</td>
                  <td>
                    <span className="token-badge">{p.tokenized.senderToken}</span>
                  </td>
                  <td>
                    <span className="token-badge">{p.tokenized.receiverToken}</span>
                  </td>
                  <td style={{ color: '#fff', fontWeight: 600 }}>{p.tokenized.amountBand}</td>
                  <td>{p.tokenized.channel}</td>
                  <td>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 3,
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background:
                          p.tokenized.hubStatus === 'sent'
                            ? 'rgba(16, 185, 129, 0.12)'
                            : 'rgba(245, 158, 11, 0.12)',
                        color:
                          p.tokenized.hubStatus === 'sent' ? 'var(--emerald)' : 'var(--amber)',
                        border: `1px solid ${
                          p.tokenized.hubStatus === 'sent'
                            ? 'rgba(16, 185, 129, 0.25)'
                            : 'rgba(245, 158, 11, 0.25)'
                        }`,
                      }}
                    >
                      {p.tokenized.hubStatus}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// Bank Console Main Dashboard
// ============================================

function BankDashboard({ bank, onLogout }: { bank: BankId; onLogout: () => void }) {
  const config = BANK_CONFIGS[bank];
  const pairs = useMemo(() => generateBankTransactions(bank, 30), [bank]);

  const flaggedCount = pairs.filter((p) => p.channelEdgeFlags.length > 0).length;
  const sentCount = pairs.filter((p) => p.tokenized.hubStatus === 'sent').length;
  const heldCount = pairs.filter((p) => p.tokenized.hubStatus === 'held').length;

  return (
    <div className={`bank-console bank-console--${bank}`}>
      {/* Top Header */}
      <header className="bank-console__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn btn--ghost" onClick={onLogout} style={{ fontSize: 11 }}>
            ← Switch Institution
          </button>
          <div style={{ height: 20, width: 1, background: 'var(--border-light)' }} />
          <div className="bank-console__badge-group">
            <div className={`bank-console__bank-badge bank-console__bank-badge--${bank}`}>
              {config.shortName}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>{config.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
                LOCAL SECURITY ENCLAVE // NODE #{bank.toUpperCase()}-01
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="bank-console__stat-chips">
            <div className="stat-chip">
              <span className="stat-chip__label">Ingested</span>
              <span className="stat-chip__value">{pairs.length}</span>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">L1 Edge Flags</span>
              <span className="stat-chip__value stat-chip__value--red">{flaggedCount}</span>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">Hub Synced</span>
              <span className="stat-chip__value stat-chip__value--green">{sentCount}</span>
            </div>
            <div className="stat-chip">
              <span className="stat-chip__label">Quarantined</span>
              <span className="stat-chip__value stat-chip__value--yellow">{heldCount}</span>
            </div>
          </div>

          <Link href="/" className="btn btn--ghost" style={{ fontSize: 11, textDecoration: 'none' }}>
            Command Center ↗
          </Link>
        </div>
      </header>

      {/* Layer 1 Channel Edge Engine */}
      <ChannelEdgePanel pairs={pairs} />

      {/* Privacy Guarantee Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 20px',
          background: 'rgba(6, 182, 212, 0.04)',
          borderBottom: '1px solid var(--border-light)',
          fontSize: 11,
          color: 'var(--text-secondary)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" color="var(--cyan)">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span>
          <strong>Left Side:</strong> On-Premises Core Data — strictly stays inside {config.name}&apos;s security boundary.&nbsp;
          <strong>Right Side:</strong> Anonymized SHA-256 tokens and value bands transmitted to the False Set coordinator graph.
        </span>
      </div>

      {/* Side-by-Side Verification Stream */}
      <div className="bank-console__tables">
        <RawTable pairs={pairs} />

        {/* Cryptographic Gateway Divider */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '0 6px',
          }}
        >
          <div style={{ height: '40%', width: 1, background: 'var(--border-light)' }} />
          <div
            style={{
              padding: '8px 6px',
              borderRadius: 'var(--r-md)',
              background: 'rgba(13, 16, 26, 0.8)',
              border: '1px solid var(--border-light)',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--cyan)',
              textAlign: 'center',
              letterSpacing: '0.08em',
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
            }}
          >
            ⇄ SHA-256 TOKENIZER GATEWAY
          </div>
          <div style={{ height: '40%', width: 1, background: 'var(--border-light)' }} />
        </div>

        <TokenizedTable pairs={pairs} />
      </div>
    </div>
  );
}

// ============================================
// Page Wrapper with URL Params
// ============================================

function BankConsoleContent() {
  const searchParams = useSearchParams();
  const bankParam = searchParams.get('bank') as BankId | null;
  const [selectedBank, setSelectedBank] = useState<BankId | null>(bankParam || null);

  useEffect(() => {
    if (bankParam && ['axis', 'icici', 'hdfc'].includes(bankParam)) {
      setSelectedBank(bankParam);
    }
  }, [bankParam]);

  if (!selectedBank) {
    return <BankLoginScreen onSelect={setSelectedBank} />;
  }

  return <BankDashboard bank={selectedBank} onLogout={() => setSelectedBank(null)} />;
}

export default function BankConsolePage() {
  return (
    <Suspense fallback={<div className="bank-login"><div className="loader-ring" /></div>}>
      <BankConsoleContent />
    </Suspense>
  );
}
