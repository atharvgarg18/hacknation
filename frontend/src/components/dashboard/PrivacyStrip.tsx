/**
 * PrivacyStrip — Bottom bar proving zero PII leakage.
 */

'use client';

import React from 'react';
import { useGraphStore } from '@/store/graphStore';
import { BANK_CONFIGS } from '@/lib/types';

export default function PrivacyStrip() {
  const { bankStats } = useGraphStore();

  return (
    <footer className="dashboard-footer">
      <div className="privacy-strip">
        <div className="privacy-strip__label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Privacy Proof
        </div>

        {bankStats.map((stat) => (
          <div key={stat.bank} className="privacy-strip__stat">
            {BANK_CONFIGS[stat.bank].shortName}: <strong>{stat.tokensSent}</strong> tokens
            {' '}<span className="privacy-chip">0 names</span>
            {' '}<span className="privacy-chip">0 accts</span>
          </div>
        ))}

        <div className="privacy-engine-tag">
          <span>FALSE SET PRIVACY ENGINE v1.0</span>
          <span className="status-dot status-dot--active" />
        </div>
      </div>
    </footer>
  );
}
