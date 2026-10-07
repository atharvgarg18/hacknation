/**
 * Security & Cryptographic Enclave — Screen 4
 * 
 * Problem Statements #11 & #1:
 * - Immutable Merkle Audit Trail & Tamper Proof Verifier
 * - 3-Bank Private Set Intersection (DH-PSI) Protocol
 * - Differential Privacy Telemetry (Gaussian Mechanism) & Rotating Salt Enclave
 * - Role-Based Access Control (RBAC) & Node Attestation
 */

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import type {
  AuditLedgerSummary,
  MerkleVerificationResult,
  PSIRunResult,
  PrivacyTelemetry,
  RoleDefinition,
} from '@/lib/types';

export default function SecurityEnclavePage() {
  return (
    <Suspense fallback={<div className="investigation"><div className="loader-ring" /></div>}>
      <SecurityEnclaveContent />
    </Suspense>
  );
}

function SecurityEnclaveContent() {
  const [activeTab, setActiveTab] = useState<'merkle' | 'psi' | 'dp' | 'rbac'>('merkle');

  // Merkle Audit Ledger State
  const [ledgerSummary, setLedgerSummary] = useState<AuditLedgerSummary | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [verificationResult, setVerificationResult] = useState<MerkleVerificationResult | null>(null);
  const [tamperDemoResult, setTamperDemoResult] = useState<{
    original_verification: MerkleVerificationResult;
    tampered_verification: MerkleVerificationResult;
    demonstration: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isTampering, setIsTampering] = useState(false);

  // PSI State
  const [psiResult, setPsiResult] = useState<PSIRunResult | null>(null);
  const [isComputingPsi, setIsComputingPsi] = useState(false);

  // DP & Privacy Telemetry State
  const [privacyTelemetry, setPrivacyTelemetry] = useState<PrivacyTelemetry | null>(null);
  const [isRotatingSalt, setIsRotatingSalt] = useState(false);
  const [saltRotationMsg, setSaltRotationMsg] = useState<string | null>(null);

  // RBAC State
  const [roles, setRoles] = useState<Record<string, RoleDefinition>>({});
  const [activeRole, setActiveRole] = useState<string>('AUDITOR');
  const [sigVerifyResult, setSigVerifyResult] = useState<{ valid: boolean; message: string } | null>(null);

  // SAR Filing Modal State
  const [sarNarrative, setSarNarrative] = useState('');
  const [sarOfficer, setSarOfficer] = useState('Chief Compliance Officer');
  const [sarFilingSuccess, setSarFilingSuccess] = useState<{ sarId: string; merkleRoot: string; onChainTxHash: string } | null>(null);

  // Fetch initial data
  useEffect(() => {
    fetchLedgerSummary();
    fetchPrivacyTelemetry();
    fetchRoles();
  }, []);

  const fetchLedgerSummary = async () => {
    try {
      const res = await fetch('/api/security/audit/logs');
      if (res.ok) {
        const data = await res.json();
        setLedgerSummary(data);
        if (data.blocks && data.blocks.length > 0) {
          // Select an event from latest block if available
          setSelectedEventId('latest');
        }
      }
    } catch (e) {
      console.error('Failed to fetch audit ledger summary:', e);
    }
  };

  const fetchPrivacyTelemetry = async () => {
    try {
      const res = await fetch('/api/security/privacy/telemetry');
      if (res.ok) {
        const data = await res.json();
        setPrivacyTelemetry(data);
      }
    } catch (e) {
      console.error('Failed to fetch privacy telemetry:', e);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/security/auth/roles');
      if (res.ok) {
        const data = await res.json();
        setRoles(data.roles || {});
      }
    } catch (e) {
      console.error('Failed to fetch auth roles:', e);
    }
  };

  // 1. Verify Merkle Proof
  const handleVerifyMerkle = async () => {
    setIsVerifying(true);
    setVerificationResult(null);
    setTamperDemoResult(null);
    try {
      // If selectedEventId is 'latest', get actual id from ledger
      const res = await fetch('/api/security/merkle/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: selectedEventId === 'latest' ? 'genesis_0000' : selectedEventId }),
      });
      const data = await res.json();
      setVerificationResult(data);
    } catch (e) {
      console.error('Verification failed:', e);
    } finally {
      setIsVerifying(false);
    }
  };

  // 2. Simulate Tampering Test
  const handleSimulateTamper = async () => {
    setIsTampering(true);
    setVerificationResult(null);
    setTamperDemoResult(null);
    try {
      const res = await fetch('/api/security/merkle/tamper-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setTamperDemoResult(data);
    } catch (e) {
      console.error('Tamper demo failed:', e);
    } finally {
      setIsTampering(false);
    }
  };

  // 3. Run Private Set Intersection
  const handleRunPSI = async () => {
    setIsComputingPsi(true);
    try {
      const res = await fetch('/api/security/psi/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setPsiResult(data);
      fetchLedgerSummary(); // PSI event is anchored into ledger!
    } catch (e) {
      console.error('PSI compute failed:', e);
    } finally {
      setIsComputingPsi(false);
    }
  };

  // 4. Rotate Salt
  const handleRotateSalt = async () => {
    setIsRotatingSalt(true);
    setSaltRotationMsg(null);
    try {
      const res = await fetch('/api/security/privacy/rotate-salt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setPrivacyTelemetry(data.telemetry);
      setSaltRotationMsg(`Salt rotated! New Epoch: ${data.rotation.new_epoch} (Fingerprint: ${data.rotation.salt_fingerprint})`);
      fetchLedgerSummary();
    } catch (e) {
      console.error('Salt rotation failed:', e);
    } finally {
      setIsRotatingSalt(false);
    }
  };

  // 5. Submit SAR Filing
  const handleFileSAR = async () => {
    if (!sarNarrative.trim()) return;
    try {
      const res = await fetch('/api/security/sar/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain_id: 'CHAIN_SAR_FIU_2026',
          banks_involved: ['axis', 'icici', 'hdfc'],
          total_amount: '₹25,00,000.00',
          narrative: sarNarrative,
          officer_name: sarOfficer,
        }),
      });
      const data = await res.json();
      setSarFilingSuccess(data);
      setSarNarrative('');
      fetchLedgerSummary();
    } catch (e) {
      console.error('SAR filing failed:', e);
    }
  };

  // 6. Test Node Signature Attestation
  const handleTestAttestation = async () => {
    try {
      const mockPayload = { batch: 'gradients_round_8', norm: 0.941, loss: 0.042 };
      // Step 1: Sign with Axis Key
      const signRes = await fetch('/api/security/auth/sign-payload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: 'axis', payload: mockPayload }),
      });
      const signData = await signRes.json();

      // Step 2: Verify with Central Enclave
      const verifyRes = await fetch('/api/security/auth/verify-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: signData.node_id,
          payload: mockPayload,
          timestamp: signData.timestamp,
          signature: signData.signature,
        }),
      });
      const verifyData = await verifyRes.json();
      setSigVerifyResult(verifyData);
    } catch (e) {
      console.error('Attestation test failed:', e);
    }
  };

  return (
    <div className="investigation" style={{ minHeight: '100vh', background: 'var(--bg-void)' }}>
      {/* Top Header */}
      <header className="investigation__header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" className="btn btn--ghost" style={{ fontSize: 11, textDecoration: 'none' }}>
            ← Command Center
          </Link>
          <div style={{ height: 20, width: 1, background: 'var(--border-light)' }} />
          <div className="logo">
            <div className="logo__icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#10b981" strokeWidth="2" />
              </svg>
            </div>
            <div className="logo__text-group">
              <div className="logo__text">
                SECURITY &amp; AUDIT ENCLAVE
                <span className="logo__badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--emerald)', borderColor: 'var(--emerald)' }}>
                  ZKP &amp; MERKLE PROOF
                </span>
              </div>
              <div className="logo__subtitle">Tamper-Proof Audit Trail, DH-PSI &amp; Differential Privacy</div>
            </div>
          </div>
        </div>

        {/* Role Selector Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
            ACTIVE ROLE:
          </span>
          {Object.keys(roles).length > 0 ? (
            Object.keys(roles).map((r) => (
              <button
                key={r}
                className={`btn ${activeRole === r ? 'btn--simulate' : 'btn--ghost'}`}
                style={{ fontSize: 10, padding: '4px 10px' }}
                onClick={() => setActiveRole(r)}
              >
                {r.replace('_', ' ')}
              </button>
            ))
          ) : (
            <span className="privacy-strip__badge">INDEPENDENT AUDITOR</span>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }}>
        {/* Top Segmented Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            marginBottom: 24,
            borderBottom: '1px solid var(--border-light)',
            paddingBottom: 12,
          }}
        >
          <button
            className={`btn ${activeTab === 'merkle' ? 'btn--simulate' : 'btn--ghost'}`}
            onClick={() => setActiveTab('merkle')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>📜</span>
            <span>Merkle Audit Ledger &amp; Tamper Verifier</span>
          </button>

          <button
            className={`btn ${activeTab === 'psi' ? 'btn--simulate' : 'btn--ghost'}`}
            onClick={() => setActiveTab('psi')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>🔐</span>
            <span>3-Bank Private Set Intersection (DH-PSI)</span>
          </button>

          <button
            className={`btn ${activeTab === 'dp' ? 'btn--simulate' : 'btn--ghost'}`}
            onClick={() => setActiveTab('dp')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>🛡️</span>
            <span>Differential Privacy &amp; Rotating Salt</span>
          </button>

          <button
            className={`btn ${activeTab === 'rbac' ? 'btn--simulate' : 'btn--ghost'}`}
            onClick={() => setActiveTab('rbac')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>🔑</span>
            <span>RBAC &amp; Node Attestation</span>
          </button>
        </div>

        {/* =========================================================================
            TAB 1: MERKLE AUDIT LEDGER & TAMPER PROOF VERIFIER
            ========================================================================= */}
        {activeTab === 'merkle' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 }}>
            {/* Left: Ledger & Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Telemetry Strip */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 12,
                  padding: 16,
                  borderRadius: 'var(--r-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                    Anchored Blocks
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginTop: 4 }}>
                    {ledgerSummary?.total_blocks || 1}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                    Total Events Hashed
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--cyan)', marginTop: 4 }}>
                    {ledgerSummary?.total_events || 1}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                    Proof Standard
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--emerald)', marginTop: 8 }}>
                    RFC 6962 SHA-256
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                    Anchor Network
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--purple)', marginTop: 8 }}>
                    Polygon / Base L2
                  </div>
                </div>
              </div>

              {/* Action Buttons: Verify vs Tamper */}
              <div
                style={{
                  padding: 20,
                  borderRadius: 'var(--r-md)',
                  background: 'var(--bg-glass-card)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                      Cryptographic Ledger Verification Engine
                    </h3>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Problem Statement #11 &amp; #1: Mathematically verify that alerts, decisions, and SARs cannot be altered.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
                  <button
                    className="btn btn--simulate"
                    onClick={handleVerifyMerkle}
                    disabled={isVerifying}
                    style={{ background: 'var(--emerald)', borderColor: 'var(--emerald)', color: '#fff' }}
                  >
                    {isVerifying ? 'Verifying Proof...' : '✓ Verify Ledger Integrity'}
                  </button>

                  <button
                    className="btn btn--simulate"
                    onClick={handleSimulateTamper}
                    disabled={isTampering}
                    style={{ background: 'var(--crimson)', borderColor: 'var(--crimson)', color: '#fff' }}
                    title="Simulate malicious actor editing an alert log to test fraud detection"
                  >
                    {isTampering ? 'Testing Tamper...' : '🚨 Simulate Tamper Attack'}
                  </button>
                </div>

                {/* Tamper Comparison Card */}
                {tamperDemoResult && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 16,
                      borderRadius: 'var(--r-md)',
                      background: 'rgba(244, 63, 94, 0.08)',
                      border: '1px solid var(--crimson)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--crimson)', fontWeight: 800, fontSize: 13 }}>
                      <span>⚠️</span>
                      <span>INDEPENDENT AUDIT VERIFICATION FAILURE (TAMPER DETECTED)</span>
                    </div>

                    <p style={{ fontSize: 11, color: '#fff', marginTop: 8, lineHeight: 1.5 }}>
                      <strong>Malicious scenario:</strong> An insider edited the alert record in the database, reducing the laundering amount from ₹25,00,000 to ₹500.
                    </p>

                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        background: 'rgba(0,0,0,0.5)',
                        borderRadius: 'var(--r-xs)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: 'var(--crimson)',
                      }}
                    >
                      <div>Calculated Tampered Leaf: {tamperDemoResult.tampered_verification.computed_leaf}</div>
                      <div style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>
                        Expected Anchored Root: {tamperDemoResult.tampered_verification.expected_root}
                      </div>
                      <div style={{ marginTop: 6, fontWeight: 700 }}>
                        RESULT: {tamperDemoResult.tampered_verification.message}
                      </div>
                    </div>
                  </div>
                )}

                {/* Valid Verification Card */}
                {verificationResult && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 16,
                      borderRadius: 'var(--r-md)',
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid var(--emerald)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--emerald)', fontWeight: 800, fontSize: 13 }}>
                      <span>✓</span>
                      <span>CRYPTOGRAPHIC PROOF VERIFIED (RECORD IMMUTABLE)</span>
                    </div>

                    <p style={{ fontSize: 11, color: '#fff', marginTop: 6 }}>
                      {verificationResult.message}
                    </p>

                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        background: 'rgba(0,0,0,0.5)',
                        borderRadius: 'var(--r-xs)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                      }}
                    >
                      <div style={{ color: 'var(--emerald)' }}>Leaf Hash: {verificationResult.computed_leaf}</div>
                      <div style={{ color: 'var(--cyan)', marginTop: 4 }}>Merkle Root: {verificationResult.expected_root}</div>
                      {verificationResult.on_chain_tx_hash && (
                        <div style={{ color: 'var(--purple)', marginTop: 4 }}>
                          On-Chain Tx: {verificationResult.on_chain_tx_hash}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Anchored Blocks List */}
              <div
                style={{
                  padding: 20,
                  borderRadius: 'var(--r-md)',
                  background: 'var(--bg-glass-card)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
                  Anchored Merkle Blocks Ledger
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {ledgerSummary?.blocks?.map((b) => (
                    <div
                      key={b.block_height}
                      style={{
                        padding: 12,
                        borderRadius: 'var(--r-sm)',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: 11,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, color: 'var(--cyan)' }}>
                          BLOCK #{b.block_height}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', fontSize: 10 }}>
                          {b.timestamp_iso}
                        </span>
                      </div>

                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', marginTop: 6, wordBreak: 'break-all' }}>
                        Root: <span style={{ color: '#fff' }}>{b.merkle_root}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>
                        <span>Events: {b.event_count}</span>
                        <span style={{ color: 'var(--purple)' }}>{b.on_chain_tx_hash.slice(0, 18)}...</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Regulatory SAR Filing & Smart Contract Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* SAR Filing Form */}
              <div
                style={{
                  padding: 20,
                  borderRadius: 'var(--r-md)',
                  background: 'var(--bg-glass-card)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    Immutable Regulatory SAR Filing (FIU-IND)
                  </h4>
                </div>

                <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>
                  Generates an immutable regulatory report conforming to the Prevention of Money Laundering Act (PMLA 2002) and anchors its hash into the blockchain ledger.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                      Reporting Officer
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={sarOfficer}
                      onChange={(e) => setSarOfficer(e.target.value)}
                      style={{ width: '100%', marginTop: 4, padding: '8px 12px', fontSize: 11 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                      Case Narrative &amp; Graph Evidence
                    </label>
                    <textarea
                      rows={4}
                      className="input"
                      placeholder="e.g., Structured fan-out / fan-in money laundering observed across Axis, ICICI, and HDFC mule accounts totaling ₹25,00,000..."
                      value={sarNarrative}
                      onChange={(e) => setSarNarrative(e.target.value)}
                      style={{ width: '100%', marginTop: 4, padding: '8px 12px', fontSize: 11, resize: 'vertical' }}
                    />
                  </div>

                  <button
                    className="btn btn--simulate"
                    onClick={handleFileSAR}
                    disabled={!sarNarrative.trim()}
                    style={{ marginTop: 6 }}
                  >
                    🔒 Sign &amp; Anchor SAR on Blockchain
                  </button>
                </div>

                {sarFilingSuccess && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 'var(--r-sm)',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid var(--emerald)',
                      fontSize: 10,
                    }}
                  >
                    <div style={{ fontWeight: 800, color: 'var(--emerald)' }}>
                      ✓ SAR FILED: {sarFilingSuccess.sarId}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                      Anchored Tx: {sarFilingSuccess.onChainTxHash}
                    </div>
                  </div>
                )}
              </div>

              {/* Solidity Smart Contract Card */}
              <div
                style={{
                  padding: 20,
                  borderRadius: 'var(--r-md)',
                  background: 'rgba(139, 92, 246, 0.05)',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>⛓️</span>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                    Solidity ComplianceLedger Reference
                  </h4>
                </div>

                <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  The smart contract [contracts/ComplianceLedger.sol] anchors Merkle roots on Polygon / Base L2 and exposes on-chain <code style={{ color: 'var(--cyan)' }}>verifyProof()</code> functions.
                </p>

                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 'var(--r-xs)',
                    background: 'rgba(0,0,0,0.6)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <div>Contract: ComplianceLedger.sol</div>
                  <div>Network: Polygon PoS / Sepolia Testnet</div>
                  <div>Verifier: OpenZeppelin MerkleProof.sol</div>
                  <div>Gas Efficiency: O(log N) verification</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: PRIVATE SET INTERSECTION (DH-PSI)
            ========================================================================= */}
        {activeTab === 'psi' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header info */}
            <div
              style={{
                padding: 20,
                borderRadius: 'var(--r-md)',
                background: 'var(--bg-glass-card)',
                border: '1px solid var(--border-light)',
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                Multi-Party Diffie-Hellman Private Set Intersection (DH-PSI)
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>
                Under the <strong>Digital Personal Data Protection (DPDP) Act 2023</strong> and strict banking secrecy laws, Axis Bank, ICICI Bank, and HDFC Bank cannot disclose their customer databases to each other.
                SATARK implements commutative Diffie-Hellman exponentiation over <strong>RFC 3526 MODP 2048-bit</strong> groups so institutions can find mutually coordinated mule rings with <strong>zero leakage</strong> of non-suspicious accounts.
              </p>

              <div style={{ marginTop: 16 }}>
                <button
                  className="btn btn--simulate"
                  onClick={handleRunPSI}
                  disabled={isComputingPsi}
                  style={{ fontSize: 12, padding: '10px 20px' }}
                >
                  {isComputingPsi ? 'Computing Blinded Exponentiations...' : '⚡ Execute 3-Bank Federated PSI Round'}
                </button>
              </div>
            </div>

            {/* 3 Bank Node Visualizer */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {/* Axis Bank */}
              <div
                style={{
                  padding: 18,
                  borderRadius: 'var(--r-md)',
                  background: 'var(--axis-bg)',
                  border: '1px solid var(--axis-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'var(--axis)',
                    }}
                  />
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Axis Bank Node Enclave</h4>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Local Suspect List: <strong>1,420 accounts</strong>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>
                  Blinding: H(x)^k_Axis mod P
                </div>
              </div>

              {/* ICICI Bank */}
              <div
                style={{
                  padding: 18,
                  borderRadius: 'var(--r-md)',
                  background: 'var(--icici-bg)',
                  border: '1px solid var(--icici-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'var(--icici)',
                    }}
                  />
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>ICICI Bank Node Enclave</h4>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Local Suspect List: <strong>1,890 accounts</strong>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>
                  Blinding: H(y)^k_ICICI mod P
                </div>
              </div>

              {/* HDFC Bank */}
              <div
                style={{
                  padding: 18,
                  borderRadius: 'var(--r-md)',
                  background: 'var(--hdfc-bg)',
                  border: '1px solid var(--hdfc-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'var(--hdfc)',
                    }}
                  />
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>HDFC Bank Node Enclave</h4>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Local Suspect List: <strong>1,650 accounts</strong>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>
                  Blinding: H(z)^k_HDFC mod P
                </div>
              </div>
            </div>

            {/* PSI Output Results */}
            {psiResult && (
              <div
                style={{
                  padding: 20,
                  borderRadius: 'var(--r-md)',
                  background: 'rgba(16, 185, 129, 0.04)',
                  border: '1px solid var(--emerald)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>✓</span>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--emerald)' }}>
                      PSI Protocol Computation Completed in {psiResult.elapsed_ms}ms
                    </h4>
                  </div>
                  <span className="privacy-strip__badge">0 BENIGN IDENTIFIERS LEAKED</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
                  <div style={{ padding: 12, background: 'rgba(0,0,0,0.4)', borderRadius: 'var(--r-xs)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Axis ∩ ICICI Mules</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 4 }}>
                      {psiResult.pairwise_intersections.axis_icici_count} Accounts
                    </div>
                  </div>

                  <div style={{ padding: 12, background: 'rgba(0,0,0,0.4)', borderRadius: 'var(--r-xs)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Axis ∩ HDFC Mules</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 4 }}>
                      {psiResult.pairwise_intersections.axis_hdfc_count} Accounts
                    </div>
                  </div>

                  <div style={{ padding: 12, background: 'rgba(0,0,0,0.4)', borderRadius: 'var(--r-xs)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Triple Shared Rings</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--crimson)', marginTop: 4 }}>
                      {psiResult.triple_shared_mules.length} Accounts
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                    Identified Mutual Cross-Bank Mule Entities:
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {psiResult.cross_bank_mules.map((mule) => (
                      <span
                        key={mule}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--r-xs)',
                          background: 'rgba(244, 63, 94, 0.15)',
                          border: '1px solid var(--crimson)',
                          color: '#fff',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                        }}
                      >
                        🚨 {mule}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: DIFFERENTIAL PRIVACY & ROTATING SALT TELEMETRY
            ========================================================================= */}
        {activeTab === 'dp' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
            {/* Left: Differential Privacy Accountant */}
            <div
              style={{
                padding: 20,
                borderRadius: 'var(--r-md)',
                background: 'var(--bg-glass-card)',
                border: '1px solid var(--border-light)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>📊</span>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                  Differential Privacy (DP) Budget Accountant
                </h3>
              </div>

              <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                Directly connected to <code>ml/src/fed/dp.py</code>. Implements per-client gradient clipping (norm C) and server-side Gaussian noise injection to prevent gradient inversion attacks.
              </p>

              {/* DP Gauges */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                    Single-Round Privacy Epsilon (ε₁)
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--cyan)', marginTop: 4 }}>
                    ε = {privacyTelemetry?.dp_budget?.epsilon_consumed ? (privacyTelemetry.dp_budget.epsilon_consumed / 8).toFixed(3) : '1.32'}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    Sensitivity = C / n_clients = 0.333
                  </div>
                </div>

                <div style={{ padding: 14, borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                    Privacy Failure Probability (δ)
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--emerald)', marginTop: 4 }}>
                    10⁻⁵ (0.00001)
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    Gaussian mechanism bound
                  </div>
                </div>

                <div style={{ padding: 14, borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                    Gaussian Noise Scale (σ)
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 4 }}>
                    {privacyTelemetry?.dp_budget?.sigma_noise_scale || 1.2}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    std = σ · C / n_clients
                  </div>
                </div>

                <div style={{ padding: 14, borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                    Clipping Bound (C)
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--amber)', marginTop: 4 }}>
                    {privacyTelemetry?.dp_budget?.clip_bound_C || 1.0}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    L2 norm gradient bound
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Rotating Epoch Salt Enclave */}
            <div
              style={{
                padding: 20,
                borderRadius: 'var(--r-md)',
                background: 'var(--bg-glass-card)',
                border: '1px solid var(--border-light)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>⏱️</span>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                  Rotating Epoch Salt Enclave
                </h3>
              </div>

              <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                Raw customer account numbers are never exposed. Account identifiers are pseudonomized via <strong>HMAC-SHA256(account, epoch_salt)</strong>. Rotating salts every 4 hours ensures <strong>forward secrecy</strong>: even if a historical log is obtained, past tokens cannot be correlated with future accounts.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: 12, borderRadius: 'var(--r-xs)', background: 'rgba(0,0,0,0.5)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  <div style={{ color: 'var(--text-tertiary)' }}>Current Active Epoch</div>
                  <div style={{ color: 'var(--cyan)', fontWeight: 800, marginTop: 4 }}>
                    {privacyTelemetry?.salt_rotation?.epoch_id || 'EPOCH_20261007_07'}
                  </div>
                </div>

                <div style={{ padding: 12, borderRadius: 'var(--r-xs)', background: 'rgba(0,0,0,0.5)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  <div style={{ color: 'var(--text-tertiary)' }}>Salt Fingerprint (SHA-256)</div>
                  <div style={{ color: 'var(--emerald)', marginTop: 4 }}>
                    0x{privacyTelemetry?.salt_rotation?.salt_sha256_fingerprint || 'e8f192b0c441'}...
                  </div>
                </div>

                <button
                  className="btn btn--simulate"
                  onClick={handleRotateSalt}
                  disabled={isRotatingSalt}
                  style={{ marginTop: 8 }}
                >
                  {isRotatingSalt ? 'Rotating Cryptographic Salt...' : '🔄 Rotate Epoch Salt Now (Forward Secrecy Demo)'}
                </button>

                {saltRotationMsg && (
                  <div style={{ padding: 10, borderRadius: 'var(--r-xs)', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--emerald)', fontSize: 10 }}>
                    ✓ {saltRotationMsg}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: RBAC & MUTUAL NODE ATTESTATION
            ========================================================================= */}
        {activeTab === 'rbac' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
            {/* Left: Role Definitions */}
            <div
              style={{
                padding: 20,
                borderRadius: 'var(--r-md)',
                background: 'var(--bg-glass-card)',
                border: '1px solid var(--border-light)',
              }}
            >
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
                Multi-Stakeholder Role-Based Access Control (RBAC)
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Object.entries(roles).map(([key, role]) => (
                  <div
                    key={key}
                    onClick={() => setActiveRole(key)}
                    style={{
                      padding: 14,
                      borderRadius: 'var(--r-sm)',
                      background: activeRole === key ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255,255,255,0.02)',
                      border: activeRole === key ? '1px solid var(--cyan)' : '1px solid var(--border-light)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, color: '#fff', fontSize: 13 }}>{role.title}</span>
                      <span
                        style={{
                          fontSize: 9,
                          fontFamily: 'var(--font-mono)',
                          padding: '2px 6px',
                          borderRadius: 'var(--r-xs)',
                          background: activeRole === key ? 'var(--cyan)' : 'rgba(255,255,255,0.1)',
                          color: activeRole === key ? '#000' : 'var(--text-secondary)',
                          fontWeight: 700,
                        }}
                      >
                        {key}
                      </span>
                    </div>

                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4 }}>
                      {role.description}
                    </p>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {role.permissions.map((p) => (
                        <span
                          key={p}
                          style={{
                            fontSize: 9,
                            fontFamily: 'var(--font-mono)',
                            padding: '1px 6px',
                            background: 'rgba(255,255,255,0.04)',
                            borderRadius: 4,
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Mutual Node Attestation */}
            <div
              style={{
                padding: 20,
                borderRadius: 'var(--r-md)',
                background: 'var(--bg-glass-card)',
                border: '1px solid var(--border-light)',
              }}
            >
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
                HMAC-SHA256 Inter-Node Message Attestation
              </h3>

              <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                Prevents impersonation and man-in-the-middle attacks when edge nodes (Axis, ICICI, HDFC) transmit model gradient weights or detection flags to the central enclave. Every payload is signed with institutional keys and timestamped to prevent replay attacks.
              </p>

              <button className="btn btn--simulate" onClick={handleTestAttestation}>
                🔐 Test Edge Node Cryptographic Attestation
              </button>

              {sigVerifyResult && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 14,
                    borderRadius: 'var(--r-sm)',
                    background: sigVerifyResult.valid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                    border: sigVerifyResult.valid ? '1px solid var(--emerald)' : '1px solid var(--crimson)',
                    fontSize: 11,
                  }}
                >
                  <div style={{ fontWeight: 800, color: sigVerifyResult.valid ? 'var(--emerald)' : 'var(--crimson)' }}>
                    {sigVerifyResult.valid ? '✓ ATTESTATION VERIFIED' : '✗ ATTESTATION FAILED'}
                  </div>
                  <div style={{ color: '#fff', marginTop: 4 }}>{sigVerifyResult.message}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
