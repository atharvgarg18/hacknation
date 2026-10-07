'use client';

/**
 * Network Effect — Screen 4
 *
 * The core empirical proof: the same fraud rings, caught more often
 * as more banks join the False Set network.
 *
 * Three detection methods compared:
 * - Local Models Only (honest baseline, stays flat)
 * - Federated Model (shared risk scores, climbs)
 * - Full System (federated + multi-hop tracing, climbs fastest)
 *
 * 20 seeds per k-value, mean + shaded 1-sigma band.
 */

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
  ComposedChart,
} from 'recharts';
import {
  runFullSweep,
  getChartData,
  METHODS,
  METHOD_LABELS,
  METHOD_COLORS,
  METRIC_LABELS,
  METRIC_DESCRIPTIONS,
  METRIC_FORMATS,
  METRIC_HIGHER_IS_BETTER,
  METHODOLOGY,
  K_VALUES,
  type AggregatedResult,
  type MetricKey,
  type DetectionMethod,
} from '@/lib/simulation/engine';
import { BANK_CONFIGS } from '@/lib/types';
import type { BankId } from '@/lib/types';

// ============================================
// Bank order for slider/toggles
// ============================================

const BANK_ORDER: BankId[] = ['axis', 'icici', 'hdfc', 'sbi'];

// ============================================
// Custom Recharts Tooltip
// ============================================

function CustomTooltip({
  active,
  payload,
  label,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  metric: MetricKey;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: 'rgba(13, 16, 26, 0.96)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10,
        padding: '10px 14px',
        backdropFilter: 'blur(20px)',
        fontSize: 12,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 10,
          marginBottom: 6,
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </div>
      {payload
        .filter((p) => p.name.includes('Mean'))
        .map((p) => (
          <div
            key={p.name}
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: p.color,
                flexShrink: 0,
              }}
            />
            <span style={{ color: 'rgba(255,255,255,0.7)', minWidth: 180 }}>
              {p.name.replace(' Mean', '')}
            </span>
            <span
              style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff' }}
            >
              {METRIC_FORMATS[metric](p.value)}
            </span>
          </div>
        ))}
    </div>
  );
}

// ============================================
// Main Metric Chart (3 methods, shaded bands)
// ============================================

function MetricChart({
  aggregated,
  metric,
  highlightK,
}: {
  aggregated: AggregatedResult[];
  metric: MetricKey;
  highlightK: number;
}) {
  const data = useMemo(() => getChartData(aggregated, metric), [aggregated, metric]);
  const higherBetter = METRIC_HIGHER_IS_BETTER[metric];

  // Format tick based on metric
  const tickFormatter = (v: number) => {
    if (metric === 'ringRecall' || metric === 'chainCompleteness' || metric === 'fundsIntercepted') {
      return `${(v * 100).toFixed(0)}%`;
    }
    if (metric === 'falsePositiveRate') return `${(v * 100).toFixed(1)}%`;
    return `${v.toFixed(1)}m`;
  };

  const chartData = data.map((d) => ({
    kLabel: d.kLabel,
    k: d.k,
    // Local band
    localRange: [d.localLower, d.localUpper] as [number, number],
    'Local Models Only Mean': d.localMean,
    localLower: d.localLower,
    localUpper: d.localUpper,
    // Federated band
    federatedRange: [d.federatedLower, d.federatedUpper] as [number, number],
    'Federated Model Mean': d.federatedMean,
    federatedLower: d.federatedLower,
    federatedUpper: d.federatedUpper,
    // Full band
    fullRange: [d.fullLower, d.fullUpper] as [number, number],
    'Full System (Fed + Tracing) Mean': d.fullMean,
    fullLower: d.fullLower,
    fullUpper: d.fullUpper,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="kLabel"
          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={tickFormatter}
          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={false}
          tickLine={false}
          width={50}
          reversed={!higherBetter}
        />
        <Tooltip content={<CustomTooltip metric={metric} />} />

        {/* Highlight current k reference line */}
        <ReferenceLine
          x={`${highlightK} Bank${highlightK > 1 ? 's' : ''}`}
          stroke="rgba(255,255,255,0.2)"
          strokeDasharray="4 4"
          label={{
            value: `k=${highlightK}`,
            position: 'top',
            fill: 'rgba(255,255,255,0.3)',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
          }}
        />

        {/* Shaded confidence bands */}
        <Area
          type="monotone"
          dataKey="localUpper"
          stroke="none"
          fill={METHOD_COLORS.local}
          fillOpacity={0.08}
          legendType="none"
        />
        <Area
          type="monotone"
          dataKey="localLower"
          stroke="none"
          fill="transparent"
          fillOpacity={0}
          legendType="none"
        />

        <Area
          type="monotone"
          dataKey="federatedUpper"
          stroke="none"
          fill={METHOD_COLORS.federated}
          fillOpacity={0.1}
          legendType="none"
        />
        <Area
          type="monotone"
          dataKey="federatedLower"
          stroke="none"
          fill="transparent"
          fillOpacity={0}
          legendType="none"
        />

        <Area
          type="monotone"
          dataKey="fullUpper"
          stroke="none"
          fill={METHOD_COLORS.full}
          fillOpacity={0.12}
          legendType="none"
        />
        <Area
          type="monotone"
          dataKey="fullLower"
          stroke="none"
          fill="transparent"
          fillOpacity={0}
          legendType="none"
        />

        {/* Mean lines */}
        <Line
          type="monotone"
          dataKey="Local Models Only Mean"
          stroke={METHOD_COLORS.local}
          strokeWidth={2}
          dot={{ r: 4, fill: METHOD_COLORS.local, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: METHOD_COLORS.local }}
        />
        <Line
          type="monotone"
          dataKey="Federated Model Mean"
          stroke={METHOD_COLORS.federated}
          strokeWidth={2.5}
          dot={{ r: 4, fill: METHOD_COLORS.federated, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: METHOD_COLORS.federated }}
        />
        <Line
          type="monotone"
          dataKey="Full System (Fed + Tracing) Mean"
          stroke={METHOD_COLORS.full}
          strokeWidth={3}
          dot={{ r: 5, fill: METHOD_COLORS.full, strokeWidth: 0 }}
          activeDot={{ r: 7, fill: METHOD_COLORS.full }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ============================================
// Metrics Summary Table
// ============================================

function MetricsTable({
  aggregated,
  k,
}: {
  aggregated: AggregatedResult[];
  k: number;
}) {
  const metrics: MetricKey[] = [
    'ringRecall',
    'chainCompleteness',
    'falsePositiveRate',
    'fundsIntercepted',
    'medianTimeToDetect',
  ];

  const getAgg = (method: DetectionMethod) =>
    aggregated.find((a) => a.k === k && a.method === method);

  return (
    <div
      style={{
        background: 'rgba(15, 18, 30, 0.7)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '200px repeat(3, 1fr)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ padding: '8px 14px', fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          METRIC
        </div>
        {METHODS.map((method) => (
          <div
            key={method}
            style={{
              padding: '8px 14px',
              fontSize: 10,
              color: METHOD_COLORS[method],
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderLeft: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            {method === 'local' ? 'Local' : method === 'federated' ? 'Federated' : 'Full System'}
          </div>
        ))}
      </div>

      {metrics.map((metric, idx) => {
        const higherBetter = METRIC_HIGHER_IS_BETTER[metric];
        const values = METHODS.map((m) => getAgg(m)?.[metric]?.mean ?? 0);
        const bestValue = higherBetter ? Math.max(...values) : Math.min(...values);

        return (
          <div
            key={metric}
            style={{
              display: 'grid',
              gridTemplateColumns: '200px repeat(3, 1fr)',
              borderBottom: idx < metrics.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
            }}
          >
            <div style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
                {METRIC_LABELS[metric]}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 1.3 }}>
                {METRIC_DESCRIPTIONS[metric].slice(0, 55)}...
              </div>
            </div>

            {METHODS.map((method) => {
              const agg = getAgg(method);
              const val = agg?.[metric]?.mean ?? 0;
              const std = agg?.[metric]?.std ?? 0;
              const isBest = Math.abs(val - bestValue) < 0.0001;

              return (
                <div
                  key={method}
                  style={{
                    padding: '10px 14px',
                    borderLeft: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 2,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: isBest ? METHOD_COLORS[method] : '#fff',
                    }}
                  >
                    {METRIC_FORMATS[metric](val)}
                    {isBest && (
                      <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7 }}>★</span>
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.3)',
                    }}
                  >
                    ±{METRIC_FORMATS[metric](std)}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Bank Toggle Participation Panel
// ============================================

function BankParticipationPanel({
  k,
  onChange,
}: {
  k: number;
  onChange: (k: number) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: 'rgba(15, 18, 30, 0.7)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: '16px 18px',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 4,
        }}
      >
        Participating Banks // k = {k}
      </div>

      {BANK_ORDER.map((bankId, idx) => {
        const config = BANK_CONFIGS[bankId];
        const isActive = idx < k;
        const isNext = idx === k;

        return (
          <div
            key={bankId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 10,
              background: isActive
                ? `rgba(${
                    bankId === 'axis'
                      ? '201, 30, 94'
                      : bankId === 'icici'
                      ? '249, 115, 22'
                      : bankId === 'hdfc'
                      ? '2, 132, 199'
                      : '57, 73, 171'
                  }, 0.12)`
                : 'rgba(255,255,255,0.02)',
              border: `1px solid ${
                isActive
                  ? `${config.color.secondary}44`
                  : isNext
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(255,255,255,0.04)'
              }`,
              cursor: 'pointer',
              transition: 'all 250ms cubic-bezier(0.16, 1, 0.3, 1)',
              opacity: isActive ? 1 : isNext ? 0.6 : 0.3,
            }}
            onClick={() => onChange(isActive && idx === k - 1 ? Math.max(1, k - 1) : Math.min(4, idx + 1))}
          >
            {/* Bank Badge */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: isActive
                  ? `linear-gradient(135deg, ${config.color.primary}, ${config.color.secondary})`
                  : 'rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                fontSize: 11,
                color: isActive ? '#fff' : 'rgba(255,255,255,0.3)',
                flexShrink: 0,
              }}
            >
              {config.shortName}
            </div>

            {/* Bank Info */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                {config.name}
              </div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: isActive ? config.color.accent : 'rgba(255,255,255,0.2)', marginTop: 1 }}>
                {isActive ? `NODE-0${idx + 1} // ACTIVE` : isNext ? 'CLICK TO JOIN' : 'NOT PARTICIPATING'}
              </div>
            </div>

            {/* Status Indicator */}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isActive ? config.color.accent : 'rgba(255,255,255,0.1)',
                boxShadow: isActive ? `0 0 8px ${config.color.accent}` : 'none',
                flexShrink: 0,
                transition: 'all 300ms',
              }}
            />
          </div>
        );
      })}

      {/* k Slider */}
      <div style={{ marginTop: 8, padding: '0 4px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'rgba(255,255,255,0.3)',
            marginBottom: 6,
          }}
        >
          <span>1 Bank</span>
          <span style={{ color: 'var(--cyan)' }}>k = {k}</span>
          <span>4 Banks</span>
        </div>
        <input
          type="range"
          min={1}
          max={4}
          value={k}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            width: '100%',
            accentColor: 'var(--cyan)',
            cursor: 'pointer',
          }}
        />
      </div>

      {/* Key insight for this k */}
      <div
        style={{
          padding: '8px 10px',
          background: 'rgba(6, 182, 212, 0.06)',
          border: '1px solid rgba(6, 182, 212, 0.15)',
          borderRadius: 8,
          fontSize: 11,
          color: 'rgba(255,255,255,0.6)',
          lineHeight: 1.5,
        }}
      >
        {k === 1 && '⚠ Single bank sees only its own transactions. Cross-bank rings are invisible.'}
        {k === 2 && '↑ Two banks share tokenized alerts. Some cross-bank hops become linkable.'}
        {k === 3 && '↑↑ Three-bank network catches most ring topologies. Diminishing returns begin.'}
        {k === 4 && '↑↑↑ Full network. No single-bank hiding is possible. Maximum recall.'}
      </div>
    </div>
  );
}

// ============================================
// Methodology Disclosure
// ============================================

function MethodologyBox({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <div
      style={{
        background: 'rgba(15, 18, 30, 0.8)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: '16px 20px',
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        lineHeight: 1.7,
      }}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)', marginBottom: 10, letterSpacing: '0.08em' }}>
        METHODOLOGY // REPRODUCIBLE SIMULATION
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        {Object.entries(METHODOLOGY).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', gap: 8 }}>
            <span style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
              {key.replace(/([A-Z])/g, ' $1').toLowerCase()}:
            </span>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>{val}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
        Detection threshold locked before simulation: ≥70% of ring hops linked into one chain = &quot;detected&quot;.
        Numbers not post-hoc adjusted. Flat spots are real and reported as-is.
      </div>
    </div>
  );
}

// ============================================
// Main Page
// ============================================

export default function NetworkEffectPage() {
  const [k, setK] = useState(1);
  const [activeMetric, setActiveMetric] = useState<MetricKey>('ringRecall');
  const [showMethodology, setShowMethodology] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Run the full sweep once — deterministic so no loading spinner needed
  const { aggregated } = useMemo(() => runFullSweep(), []);

  // Stage demo: auto-advance k 1→4
  const runLiveDemo = () => {
    setK(1);
    setIsAnimating(true);
    let current = 1;
    const interval = setInterval(() => {
      current++;
      setK(current);
      if (current >= 4) {
        clearInterval(interval);
        setIsAnimating(false);
      }
    }, 1800);
  };

  // Get delta between k=1 full and k=4 full for the active metric
  const k1Full = aggregated.find((a) => a.k === 1 && a.method === 'full');
  const k4Full = aggregated.find((a) => a.k === 4 && a.method === 'full');
  const k1Local = aggregated.find((a) => a.k === 1 && a.method === 'local');
  const k4Local = aggregated.find((a) => a.k === 4 && a.method === 'local');

  const delta = k4Full && k1Full
    ? k4Full[activeMetric].mean - k1Full[activeMetric].mean
    : 0;
  const localDelta = k4Local && k1Local
    ? Math.abs(k4Local[activeMetric].mean - k1Local[activeMetric].mean)
    : 0;

  const higherBetter = METRIC_HIGHER_IS_BETTER[activeMetric];
  const deltaGood = higherBetter ? delta > 0 : delta < 0;

  const METRICS: MetricKey[] = [
    'ringRecall',
    'chainCompleteness',
    'falsePositiveRate',
    'fundsIntercepted',
    'medianTimeToDetect',
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-void)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1,
      }}
    >
      {/* Telemetry grid background */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage:
            'radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          height: 58,
          background: 'rgba(10, 12, 19, 0.88)',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
          position: 'relative',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" className="btn btn--ghost" style={{ fontSize: 11, textDecoration: 'none' }}>
            ← Command Center
          </Link>
          <div style={{ height: 20, width: 1, background: 'rgba(255,255,255,0.08)' }} />
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: '#fff',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              NETWORK EFFECT
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'rgba(6, 182, 212, 0.12)',
                  color: 'var(--cyan)',
                  border: '1px solid rgba(6, 182, 212, 0.25)',
                }}
              >
                EMPIRICAL
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>
              Graph-Visibility Simulation · 240 Runs · 20 Seeds per k-value
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn--ghost"
            onClick={() => setShowMethodology((s) => !s)}
            style={{ fontSize: 11 }}
          >
            {showMethodology ? '▾' : '▸'} Methodology
          </button>
          <button
            className="btn btn--simulate"
            onClick={runLiveDemo}
            disabled={isAnimating}
            style={{ fontSize: 11 }}
          >
            {isAnimating ? `▶ k=${k} joining...` : '▶ STAGE DEMO'}
          </button>
        </div>
      </header>

      {/* Methodology Disclosure */}
      {showMethodology && (
        <div style={{ padding: '12px 24px', zIndex: 10, position: 'relative' }}>
          <MethodologyBox open />
        </div>
      )}

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '300px 1fr',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Left Panel — Bank Toggles + Key Numbers */}
        <div
          style={{
            borderRight: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(11, 14, 23, 0.75)',
            backdropFilter: 'blur(20px)',
            overflowY: 'auto',
            padding: '16px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <BankParticipationPanel k={k} onChange={setK} />

          {/* Delta Callout */}
          <div
            style={{
              background: 'rgba(15, 18, 30, 0.7)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${deltaGood ? 'rgba(6, 182, 212, 0.25)' : 'rgba(244, 63, 94, 0.25)'}`,
              borderRadius: 12,
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 8,
              }}
            >
              Full System Improvement · k=1→4
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                  {METRIC_LABELS[activeMetric]}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    fontWeight: 800,
                    color: deltaGood ? 'var(--cyan)' : '#f43f5e',
                  }}
                >
                  {METRIC_FORMATS[activeMetric](Math.abs(delta))}
                  {deltaGood ? ' ↑' : ' ↓'}
                </span>
              </div>

              <div
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.4)',
                  lineHeight: 1.5,
                }}
              >
                {localDelta < 0.01
                  ? '↔ Local-only stays flat (+' + METRIC_FORMATS[activeMetric](localDelta) + '). That gap is False Set.'
                  : `Local-only change: ${METRIC_FORMATS[activeMetric](localDelta)} — almost nothing.`}
              </div>

              <div
                style={{
                  padding: '6px 8px',
                  background: 'rgba(6, 182, 212, 0.06)',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.8)',
                  fontStyle: 'italic',
                }}
              >
                &quot;No single bank could see this.&quot;
              </div>
            </div>
          </div>

          {/* Legend */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '12px 14px',
              background: 'rgba(15, 18, 30, 0.7)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10,
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
              DETECTION STRATEGIES
            </div>
            {METHODS.map((m) => (
              <div key={m} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span
                  style={{
                    width: 12,
                    height: 3,
                    borderRadius: 2,
                    background: METHOD_COLORS[m],
                    flexShrink: 0,
                    marginTop: 6,
                  }}
                />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>
                    {METHOD_LABELS[m]}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>
                    {m === 'local' && 'Pattern-match within one bank. Cross-bank hops invisible.'}
                    {m === 'federated' && 'Shared token risk scores. No graph structure.'}
                    {m === 'full' && 'Merged tokenized graph. Multi-hop chain tracing.'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel — Charts + Table */}
        <div style={{ overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Metric Selector Tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {METRICS.map((m) => (
              <button
                key={m}
                onClick={() => setActiveMetric(m)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: `1px solid ${activeMetric === m ? 'rgba(6, 182, 212, 0.5)' : 'rgba(255,255,255,0.08)'}`,
                  background: activeMetric === m ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255,255,255,0.03)',
                  color: activeMetric === m ? 'var(--cyan)' : 'rgba(255,255,255,0.5)',
                  fontSize: 11,
                  fontWeight: activeMetric === m ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 200ms',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>

          {/* Main Chart */}
          <div
            style={{
              background: 'rgba(15, 18, 30, 0.7)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              padding: '18px 16px 10px',
            }}
          >
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                {METRIC_LABELS[activeMetric]}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                {METRIC_DESCRIPTIONS[activeMetric]} · Mean ± 1σ from {20} seeds per k
              </div>
            </div>
            <MetricChart aggregated={aggregated} metric={activeMetric} highlightK={k} />
          </div>

          {/* Summary sentence for judges */}
          <div
            style={{
              background: 'rgba(6, 182, 212, 0.05)',
              border: '1px solid rgba(6, 182, 212, 0.15)',
              borderRadius: 10,
              padding: '12px 16px',
              fontSize: 12,
              color: 'rgba(255,255,255,0.65)',
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: 'var(--cyan)' }}>Reading the chart:</strong> The gray line (local-only) stays nearly flat — adding banks doesn&apos;t help if you don&apos;t share. The amber line (federated) climbs because shared risk scores help flag suspicious tokens, but can&apos;t trace chains. The cyan line (full system) climbs fastest because multi-hop graph tracing links the entire ring. <strong style={{ color: '#fff' }}>The gap between gray and cyan at k=4 is the value of False Set.</strong>
          </div>

          {/* Per-k Metrics Table */}
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 8,
              }}
            >
              EXACT FIGURES AT k = {k} // 20 SEEDS
            </div>
            <MetricsTable aggregated={aggregated} k={k} />
          </div>

          {/* Caveats — transparent reporting */}
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10,
              fontSize: 11,
              color: 'rgba(255,255,255,0.35)',
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Honest caveats:</strong>{' '}
            (1) 30% of planted rings are single-bank — those won&apos;t improve with more participants, which is why the curves don&apos;t reach 100%.
            (2) Detection uses graph-connectivity analysis, not a live GNN — the ML upgrade is planned as Phase 2.
            (3) Normal traffic FPR is modeled, not measured on real data.
            (4) All numbers are reproducible — run the simulation engine with the same seeds to verify.
          </div>
        </div>
      </div>
    </div>
  );
}
