/**
 * DashboardHeader — Top bar with logo, status, actions.
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { useGraphStore } from '@/store/graphStore';

export default function DashboardHeader() {
  const { triggerAttack, isSimulating, startSimulation, stopSimulation, clearDetection, focusedChain } =
    useGraphStore();

  return (
    <header className="dashboard-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div className="logo">
          <div className="logo__icon">S</div>
          <div>
            <div className="logo__text">FALSE SET</div>
            <div className="logo__subtitle">Cross-Bank AML Intelligence</div>
          </div>
        </div>

        <div style={{ height: 24, width: 1, background: 'var(--border-light)' }} />

        <div className="header-status">
          <span className="status-dot status-dot--active" />
          OPERATIONAL
        </div>
      </div>

      <div className="header-actions">
        <Link href="/bank" className="btn btn--ghost" style={{ textDecoration: 'none', fontSize: 11 }}>
          Bank Console ↗
        </Link>
        {focusedChain && (
          <button className="btn btn--ghost animate-slide-down" onClick={clearDetection}>
            ✕ Clear Focus
          </button>
        )}

        <button
          className="btn btn--ghost"
          onClick={isSimulating ? stopSimulation : startSimulation}
        >
          {isSimulating ? '⏸ Pause' : '▶ Traffic'}
        </button>

        <button className="btn btn--simulate" onClick={triggerAttack}>
          ⚡ SIMULATE ATTACK
        </button>
      </div>
    </header>
  );
}
