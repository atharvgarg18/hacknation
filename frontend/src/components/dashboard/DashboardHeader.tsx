/**
 * DashboardHeader — Apple Precision × Deep-Tech Mission Telemetry
 * Provides live operational clock, dual-edge pipeline status, segmented navigation, and tactical controls.
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useGraphStore } from '@/store/graphStore';

export default function DashboardHeader() {
  const pathname = usePathname();
  const {
    triggerAttack,
    isSimulating,
    startSimulation,
    stopSimulation,
    clearDetection,
    focusedChain,
    adversaryMode,
    setAdversaryMode,
  } = useGraphStore();

  const [timeStr, setTimeStr] = useState({ utc: '', ist: '' });

  // Real-time mission telemetry clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const utc = now.toISOString().slice(11, 19) + ' UTC';
      const ist = now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) + ' IST';
      setTimeStr({ utc, ist });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="dashboard-header">
      {/* Brand & Mission Identifier */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/" className="logo">
          <div className="logo__icon-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              {/* Dual-edge node telemetry symbol */}
              <circle cx="6" cy="12" r="3" fill="#06b6d4" />
              <circle cx="18" cy="6" r="3" fill="#8b5cf6" />
              <circle cx="18" cy="18" r="3" fill="#f43f5e" />
              <path d="M9 12L15 7M9 12L15 17" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeDasharray="2 2" />
            </svg>
          </div>
          <div className="logo__text-group">
            <div className="logo__text">
              FALSE SET
              <span className="logo__badge">ENCLAVE</span>
            </div>
            <div className="logo__subtitle">Cross-Bank AML Intelligence</div>
          </div>
        </Link>

        <div style={{ height: 20, width: 1, background: 'var(--border-light)' }} />

        {/* Live Mission Telemetry Readout */}
        <div className="header-telemetry">
          <div className="header-telemetry__item header-telemetry__item--active">
            <span className="header-telemetry__dot" />
            <span>OPERATIONAL // 4/4 NODES</span>
          </div>

          <div className="header-telemetry__item" style={{ display: 'none' /* on mobile */ }}>
            <span style={{ color: 'var(--text-tertiary)' }}>MET:</span>
            <span>{timeStr.ist || '02:50:00 IST'}</span>
          </div>
        </div>
      </div>

      {/* Apple-Style Segmented Navigation */}
      <nav className="header-nav-segmented">
        <Link
          href="/"
          className={`nav-segment ${pathname === '/' ? 'nav-segment--active' : ''}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          Command Center
        </Link>

        <Link
          href="/bank"
          className={`nav-segment ${pathname.startsWith('/bank') ? 'nav-segment--active' : ''}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          Bank Edge Console
        </Link>

        <Link
          href="/investigate"
          className={`nav-segment ${pathname.startsWith('/investigate') ? 'nav-segment--active' : ''}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Alert Investigation
        </Link>

        <Link
          href="/network-effect"
          className={`nav-segment ${pathname.startsWith('/network-effect') ? 'nav-segment--active' : ''}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Network Effect
        </Link>

        <Link
          href="/chain-story"
          className={`nav-segment ${pathname.startsWith('/chain-story') ? 'nav-segment--active' : ''}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Chain Slideshow
        </Link>

        <Link
          href="/micro-smurfing"
          className={`nav-segment ${pathname.startsWith('/micro-smurfing') ? 'nav-segment--active' : ''}`}
          style={{
            position: 'relative',
            ...(pathname.startsWith('/micro-smurfing')
              ? {
                  boxShadow: '0 0 14px rgba(168, 85, 247, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                  borderColor: 'rgba(168, 85, 247, 0.6)',
                }
              : {}),
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M3 12h3m12 0h3M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6l2.1-2.1" />
          </svg>
          <span>Micro-Smurfing</span>
          <span
            style={{
              fontSize: '8px',
              padding: '1px 5px',
              borderRadius: '4px',
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#f87171',
              fontWeight: 700,
              letterSpacing: '0.04em',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              lineHeight: '1.2',
            }}
          >
            ROUND 2
          </span>
        </Link>

        <Link
          href="/security"
          className={`nav-segment ${pathname.startsWith('/security') ? 'nav-segment--active' : ''}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Security & Audit
        </Link>
      </nav>

      {/* Tactical Command Actions */}
      <div className="header-actions">
        {focusedChain && (
          <button className="btn btn--ghost animate-fade-in" onClick={clearDetection}>
            ✕ Clear Focus
          </button>
        )}

        <button
          className="btn btn--ghost"
          onClick={isSimulating ? stopSimulation : startSimulation}
          title="Toggle live background traffic generator"
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: isSimulating ? 'var(--emerald)' : 'var(--text-tertiary)',
            }}
          />
          {isSimulating ? 'Live Traffic' : 'Resume Traffic'}
        </button>

        {!pathname.startsWith('/micro-smurfing') && (
          <>
            <button
              className={`btn ${adversaryMode ? 'btn--adversary-active' : 'btn--ghost'}`}
              onClick={() => setAdversaryMode(!adversaryMode)}
              title="Toggle Adversarial Micro-Smurfing Mode"
              style={{
                borderColor: adversaryMode ? '#f43f5e' : undefined,
                color: adversaryMode ? '#fff' : undefined,
                background: adversaryMode ? 'rgba(244, 63, 94, 0.2)' : undefined,
                boxShadow: adversaryMode ? '0 0 12px rgba(244, 63, 94, 0.35)' : undefined,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: adversaryMode ? '#f43f5e' : 'var(--text-tertiary)',
                  boxShadow: adversaryMode ? '0 0 8px #f43f5e' : 'none',
                }}
              />
              {adversaryMode ? 'ADVERSARY [ON]' : 'Adversary Mode'}
            </button>

            <button className="btn btn--simulate" onClick={() => triggerAttack()}>
              <span style={{ fontSize: 13 }}>⚡</span>
              SIMULATE ATTACK
            </button>
          </>
        )}
      </div>
    </header>
  );
}
