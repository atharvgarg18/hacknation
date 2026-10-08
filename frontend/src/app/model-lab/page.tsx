'use client';

/**
 * Model Lab — Six-act federated learning visualization.
 * Acts 1-6. No Act 7. No emojis.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  getLocalTrainingFrames,
  getFedRounds,
  getKnowledgeTransferDemo,
  getBehaviourTrails,
  getArchetypeCards,
  BEHAVIOUR_FEATURES,
  type BankKey,
  type EmbeddingPoint,
  type RingType,
} from '@/lib/modelLabData';

// ============================================
// Constants
// ============================================

const BANK_COLOR: Record<BankKey, string> = {
  axis:  '#c91e5e',
  icici: '#f97316',
  hdfc:  '#0284c7',
  sbi:   '#3949ab',
};
const BANK_LABEL: Record<BankKey, string> = {
  axis: 'Axis', icici: 'ICICI', hdfc: 'HDFC', sbi: 'SBI',
};
const CLASS_COLOR: Record<string, string> = {
  normal: '#4b5563',
  fraud:  '#f43f5e',
  mule:   '#f59e0b',
};
const RING_COLOR: Record<RingType, string> = {
  'fan-out':   '#06b6d4',
  'cycle':     '#8b5cf6',
  'slow-drip': '#10b981',
  'chain':     '#f59e0b',
};

const ACTS = [
  { id: 1, label: 'Behaviour Pipeline' },
  { id: 2, label: 'Local Galaxies' },
  { id: 3, label: 'Federated Round' },
  { id: 4, label: 'Knowledge Transfer' },
  { id: 5, label: 'Behaviour Over Time' },
  { id: 6, label: 'Why It Decided That' },
];

const CLAIMS = [
  'The model learns from behaviour — amounts, timing and graph structure, never identity.',
  'Each bank learns locally. It sees only its own slice of the world.',
  'Banks learn together without sharing data. Only model updates travel, never records.',
  'The shared model is better than any local one, including on patterns a bank never saw itself.',
  'It keeps learning as criminals adapt.',
  'It can explain every decision.',
];

// ============================================
// SVG Icons (no emojis)
// ============================================

const IconFlask = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 3h6M9 3v7l-5 9a1 1 0 0 0 .9 1.5h12.2A1 1 0 0 0 22 19l-5-9V3"/>
  </svg>
);
const IconLock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconWarning = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconInfo = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);
const IconSend = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const IconNoEntry = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
  </svg>
);
const IconPlay = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);
const IconDiamond = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 22 12 12 22 2 12"/>
  </svg>
);
const IconMessage = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconBolt = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconOrb = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10"/>
    <ellipse cx="12" cy="12" rx="4" ry="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
  </svg>
);

// ============================================
// Galaxy Canvas
// ============================================

function GalaxyCanvas({
  points,
  width = 380,
  height = 280,
  title,
  highlightIds,
  showTrail,
}: {
  points: EmbeddingPoint[];
  width?: number;
  height?: number;
  title?: string;
  highlightIds?: string[];
  showTrail?: { x: number; y: number; cls: string }[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { minX, maxX, minY, maxY } = useMemo(() => {
    if (!points.length) return { minX: -6, maxX: 6, minY: -6, maxY: 6 };
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const pad = 1.5;
    return {
      minX: Math.min(...xs) - pad, maxX: Math.max(...xs) + pad,
      minY: Math.min(...ys) - pad, maxY: Math.max(...ys) + pad,
    };
  }, [points]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const bg = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2);
    bg.addColorStop(0, 'rgba(15,18,30,1)');
    bg.addColorStop(1, 'rgba(6,7,11,1)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let gx = -8; gx <= 8; gx += 2) {
      const px = ((gx - minX) / (maxX - minX)) * width;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, height); ctx.stroke();
    }
    for (let gy = -8; gy <= 8; gy += 2) {
      const py = ((gy - minY) / (maxY - minY)) * height;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(width, py); ctx.stroke();
    }

    if (showTrail && showTrail.length > 1) {
      for (let i = 1; i < showTrail.length; i++) {
        const prev = showTrail[i - 1], curr = showTrail[i];
        const px = ((prev.x - minX) / (maxX - minX)) * width;
        const py = height - ((prev.y - minY) / (maxY - minY)) * height;
        const cx2 = ((curr.x - minX) / (maxX - minX)) * width;
        const cy2 = height - ((curr.y - minY) / (maxY - minY)) * height;
        ctx.strokeStyle = `rgba(245,158,11,${(i / showTrail.length) * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(cx2, cy2); ctx.stroke();
      }
    }

    const toScreen = (p: EmbeddingPoint) => ({
      sx: ((p.x - minX) / (maxX - minX)) * width,
      sy: height - ((p.y - minY) / (maxY - minY)) * height,
    });

    const highlighted = new Set(highlightIds ?? []);
    const sorted = [...points].sort((a, b) =>
      a.cls === 'normal' && b.cls !== 'normal' ? -1 : a.cls !== 'normal' && b.cls === 'normal' ? 1 : 0
    );

    for (const pt of sorted) {
      const { sx, sy } = toScreen(pt);
      const isHighlighted = highlighted.has(pt.id);
      const isFraud = pt.cls === 'fraud';
      const isMule = pt.cls === 'mule';
      const radius = isHighlighted ? 5 : isFraud ? 3 : isMule ? 2.5 : 1.8;
      const baseColor = isFraud ? (pt.ringType ? RING_COLOR[pt.ringType] : CLASS_COLOR.fraud) : CLASS_COLOR[pt.cls];

      if (isHighlighted) {
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius * 3);
        glow.addColorStop(0, baseColor + '88'); glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(sx, sy, radius * 3, 0, Math.PI * 2); ctx.fill();
      }

      ctx.globalAlpha = isFraud ? 0.9 : isMule ? 0.8 : 0.45;
      ctx.fillStyle = baseColor;
      ctx.beginPath(); ctx.arc(sx, sy, radius, 0, Math.PI * 2); ctx.fill();
    }

    ctx.globalAlpha = 1;

    if (showTrail && showTrail.length > 0) {
      const last = showTrail[showTrail.length - 1];
      const tx = ((last.x - minX) / (maxX - minX)) * width;
      const ty = height - ((last.y - minY) / (maxY - minY)) * height;
      const glow2 = ctx.createRadialGradient(tx, ty, 0, tx, ty, 8);
      glow2.addColorStop(0, '#f59e0bcc'); glow2.addColorStop(1, 'transparent');
      ctx.fillStyle = glow2;
      ctx.beginPath(); ctx.arc(tx, ty, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(tx, ty, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }, [points, width, height, minX, maxX, minY, maxY, highlightIds, showTrail]);

  return (
    <div className="ml-galaxy-wrap" style={{ width, height }}>
      {title && <div className="ml-galaxy-title">{title}</div>}
      <canvas ref={canvasRef} style={{ width, height, borderRadius: 8 }} />
    </div>
  );
}

// ============================================
// Act 1 — Behaviour Pipeline Strip
// ============================================

const PIPELINE_STEPS = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/><line x1="15" y1="9" x2="15" y2="21"/>
      </svg>
    ),
    label: 'Raw Transactions', desc: 'Volume, timing, channel',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07"/>
      </svg>
    ),
    label: 'Behaviour Features', desc: 'Velocity · Pass-through · Burst · Degree',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor"/>
        <circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/>
      </svg>
    ),
    label: 'Embedding', desc: 'GNN → 128-dim vector',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    label: 'Risk Score', desc: '0–1 anomaly signal',
  },
];

function Act1() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % PIPELINE_STEPS.length), 1600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="ml-act">
      <div className="ml-act-header">
        <span className="ml-act-badge">Act 1</span>
        <h2 className="ml-act-title">Behaviour Pipeline</h2>
        <p className="ml-act-desc">The model learns from behaviour — amounts, timing, graph structure — never identity.</p>
      </div>

      <div className="ml-pipeline-strip">
        {PIPELINE_STEPS.map((s, i) => (
          <React.Fragment key={i}>
            <div className={`ml-pipeline-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
              <div className="ml-pipeline-icon">{s.icon}</div>
              <div className="ml-pipeline-label">{s.label}</div>
              <div className="ml-pipeline-desc">{s.desc}</div>
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <div className={`ml-pipeline-arrow ${i < step ? 'active' : ''}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="ml-feature-grid">
        <div className="ml-feature-header">
          <span className="ml-badge-privacy">
            <IconCheck /> No names · No accounts · No KYC fields
          </span>
          <span className="ml-feature-note">Features entering the model:</span>
        </div>
        <div className="ml-feature-list">
          {BEHAVIOUR_FEATURES.map((f) => (
            <div key={f.name} className="ml-feature-chip">
              <span className="ml-feature-name">{f.label}</span>
              <span className="ml-feature-unit">{f.unit}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ml-pipeline-proof">
        <div className="ml-proof-row">
          <span className="ml-proof-icon"><IconLock /></span>
          <span>"Learned from behaviour, not identity" — no account numbers, names, or KYC fields enter the model at any stage.</span>
        </div>
        <div className="ml-proof-row" style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginTop: 4 }}>
          <span className="ml-proof-icon"><IconInfo /></span>
          <span>Note: behaviour features can still correlate with other attributes. Features used are listed above.</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Act 2 — Four Local Galaxies
// ============================================

const BANKS: BankKey[] = ['axis', 'icici', 'hdfc', 'sbi'];
const BANK_SPECIALTY: Record<BankKey, string> = {
  axis:  'Fan-out rings',
  icici: 'Chain + slow-drip',
  hdfc:  'Slow-drip + fan-out',
  sbi:   'Cycle rings',
};

function Act2() {
  const [epochIdx, setEpochIdx] = useState(5);
  const [playing, setPlaying] = useState(false);
  const frames = useMemo(() => getLocalTrainingFrames(), []);
  const EPOCHS = [0, 2, 4, 6, 8, 10];

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setEpochIdx((e) => {
        if (e >= 5) { setPlaying(false); return 5; }
        return e + 1;
      });
    }, 900);
    return () => clearInterval(t);
  }, [playing]);

  const bankFrames = BANKS.map((bank) => ({
    bank, frame: frames.filter((f) => f.bank === bank)[epochIdx],
  }));

  const aucData = EPOCHS.map((ep, ei) => {
    const row: Record<string, number | string> = { epoch: `Ep${ep}` };
    for (const bank of BANKS) {
      const f = frames.filter((fr) => fr.bank === bank)[ei];
      if (f) row[bank] = parseFloat(f.auc.toFixed(3));
    }
    return row;
  });

  return (
    <div className="ml-act">
      <div className="ml-act-header">
        <span className="ml-act-badge">Act 2</span>
        <h2 className="ml-act-title">Each Bank Learns Alone</h2>
        <p className="ml-act-desc">Each bank trains on its own slice. Banks see different ring types — so their galaxies diverge.</p>
      </div>

      <div className="ml-scrubber-bar">
        <button className="ml-play-btn" onClick={() => { setEpochIdx(0); setPlaying(true); }}>
          <IconPlay /> Play
        </button>
        <input type="range" min={0} max={5} value={epochIdx}
          onChange={(e) => { setPlaying(false); setEpochIdx(+e.target.value); }}
          className="ml-scrubber" />
        <span className="ml-scrubber-label">Epoch {EPOCHS[epochIdx]}</span>
      </div>

      <div className="ml-four-galaxies">
        {bankFrames.map(({ bank, frame }) => (
          <div key={bank} className="ml-local-galaxy-wrap" style={{ borderColor: BANK_COLOR[bank] + '44' }}>
            <div className="ml-local-galaxy-header" style={{ color: BANK_COLOR[bank] }}>
              <span className="ml-local-bank-dot" style={{ background: BANK_COLOR[bank] }} />
              {BANK_LABEL[bank]}
              <span className="ml-local-specialty">{BANK_SPECIALTY[bank]}</span>
            </div>
            {frame && (
              <>
                <GalaxyCanvas points={frame.embeddings} width={260} height={200} />
                <div className="ml-local-metrics">
                  <div className="ml-metric-pill">
                    <span>Loss</span>
                    <strong style={{ color: '#f59e0b' }}>{frame.loss.toFixed(3)}</strong>
                  </div>
                  <div className="ml-metric-pill">
                    <span>AUC</span>
                    <strong style={{ color: '#10b981' }}>{frame.auc.toFixed(3)}</strong>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="ml-auc-chart-wrap">
        <div className="ml-chart-label">Local AUC per bank — training convergence</div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={aucData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <XAxis dataKey="epoch" tick={{ fill: '#5d637a', fontSize: 11 }} />
            <YAxis domain={[0.48, 0.88]} tick={{ fill: '#5d637a', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#0f121d', border: '1px solid #1a1f32', borderRadius: 6, fontSize: 12 }} labelStyle={{ color: '#9499ad' }} />
            {BANKS.map((b) => <Line key={b} dataKey={b} stroke={BANK_COLOR[b]} strokeWidth={2} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
        <div className="ml-chart-legend">
          {BANKS.map((b) => (
            <span key={b} className="ml-legend-chip" style={{ borderColor: BANK_COLOR[b] + '66', color: BANK_COLOR[b] }}>
              <span className="ml-legend-dot" style={{ background: BANK_COLOR[b] }} />{BANK_LABEL[b]}
            </span>
          ))}
        </div>
      </div>

      <div className="ml-insight-box">
        <span className="ml-proof-icon"><IconInfo /></span>
        SBI's local model is weak on fan-out rings (never saw them). HDFC misses cycle rings.
        Each bank's galaxy reflects only its own slice — which sets up the next act.
      </div>
    </div>
  );
}

// ============================================
// Act 3 — Federated Round
// ============================================

function PacketOrb({ bank, norm, similarity, poisoned, active }: {
  bank: BankKey; norm: number; similarity: number; poisoned: boolean; active: boolean;
}) {
  const orbColor = poisoned ? '#f43f5e' : BANK_COLOR[bank];
  return (
    <div className={`ml-fed-orb ${active ? 'active' : ''} ${poisoned ? 'poisoned' : ''}`}
      style={{ '--orb-color': orbColor } as React.CSSProperties}>
      <div className="ml-orb-inner" style={{ background: orbColor + '22', borderColor: orbColor + '66' }}>
        <span className="ml-orb-label" style={{ color: orbColor }}>{BANK_LABEL[bank]}</span>
        {poisoned && (
          <span className="ml-orb-poison">
            <IconWarning /> Poisoned update
          </span>
        )}
      </div>
      <div className="ml-orb-stats">
        <span>Norm: <strong style={{ color: poisoned ? '#f43f5e' : '#f59e0b' }}>{norm.toFixed(2)}</strong></span>
        <span>Sim: <strong style={{ color: similarity < 0.3 ? '#f43f5e' : '#10b981' }}>{similarity.toFixed(2)}</strong></span>
      </div>
    </div>
  );
}

function Act3() {
  const rounds = useMemo(() => getFedRounds(), []);
  const [roundIdx, setRoundIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [aggregating, setAggregating] = useState(false);
  const round = rounds[roundIdx];

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setAggregating(true);
      setTimeout(() => {
        setAggregating(false);
        setRoundIdx((r) => {
          if (r >= 4) { setPlaying(false); return 4; }
          return r + 1;
        });
      }, 800);
    }, 1800);
    return () => clearInterval(t);
  }, [playing]);

  const aucData = rounds.map((r) => ({
    round: `R${r.round}`,
    'Fed AUC': parseFloat(r.federatedAuc.toFixed(3)),
    ...Object.fromEntries(BANKS.map((b) => [`${BANK_LABEL[b]} local`, parseFloat(r.localAucs[b].toFixed(3))])),
  }));

  return (
    <div className="ml-act">
      <div className="ml-act-header">
        <span className="ml-act-badge act3">Act 3</span>
        <h2 className="ml-act-title">Federated Round — The Centerpiece</h2>
        <p className="ml-act-desc">Banks train locally, share only model updates — never records. A coordinator aggregates.</p>
        <div className="ml-privacy-note">
          <IconWarning /> Demo view: In a real deployment, each bank would only see its own data and embedding space. Only encrypted model updates travel between banks.
        </div>
      </div>

      <div className="ml-scrubber-bar">
        <button className="ml-play-btn" onClick={() => { setRoundIdx(0); setPlaying(true); }}>
          <IconPlay /> Play
        </button>
        <input type="range" min={0} max={4} value={roundIdx}
          onChange={(e) => { setPlaying(false); setRoundIdx(+e.target.value); }}
          className="ml-scrubber" />
        <span className="ml-scrubber-label">Round {round?.round ?? 1}</span>
        {round?.bankUpdates.find((u) => u.poisoned) && (
          <span className="ml-poison-badge"><IconWarning /> Poisoning attempt this round</span>
        )}
      </div>

      <div className="ml-fed-layout">
        <div className="ml-fed-topology">
          <div className="ml-fed-orbs">
            {round?.bankUpdates.map((upd) => (
              <PacketOrb key={upd.bank} {...upd} active={aggregating} />
            ))}
          </div>

          <div className={`ml-fed-coordinator ${aggregating ? 'pulsing' : ''}`}>
            <div className="ml-coord-inner">
              <span className="ml-coord-icon" style={{ color: '#8b5cf6' }}><IconOrb /></span>
              <span className="ml-coord-label">Coordinator</span>
              <span className="ml-coord-sub">Secure Aggregation</span>
              {aggregating && <span className="ml-coord-merging">Merging…</span>}
            </div>
          </div>

          <div className="ml-fed-arrows">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`ml-fed-arrow ${aggregating ? 'active' : ''}`}
                style={{ animationDelay: `${i * 0.1}s` }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                </svg>
              </span>
            ))}
          </div>

          <div className="ml-norm-bars">
            <div className="ml-norm-title">Update norms (packet size)</div>
            {round?.bankUpdates.map((upd) => (
              <div key={upd.bank} className="ml-norm-row">
                <span className="ml-norm-bank" style={{ color: BANK_COLOR[upd.bank] }}>{BANK_LABEL[upd.bank]}</span>
                <div className="ml-norm-bar-track">
                  <div className="ml-norm-bar-fill"
                    style={{ width: `${Math.min((upd.norm / 5) * 100, 100)}%`, background: upd.poisoned ? '#f43f5e' : BANK_COLOR[upd.bank] }} />
                </div>
                <span className="ml-norm-val" style={{ color: upd.poisoned ? '#f43f5e' : undefined }}>
                  {upd.norm.toFixed(2)}{upd.poisoned ? ' !' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="ml-fed-right">
          <div className="ml-fed-galaxy-label">Shared embedding space after aggregation</div>
          {round && (
            <GalaxyCanvas points={round.embeddings.slice(0, 400)} width={380} height={280}
              title={`Round ${round.round} global model`} />
          )}
          <div className="ml-fed-metrics">
            <div className="ml-metric-card">
              <span className="ml-metric-label">Global AUC</span>
              <span className="ml-metric-val" style={{ color: '#10b981' }}>{round?.globalAuc.toFixed(3)}</span>
            </div>
            <div className="ml-metric-card">
              <span className="ml-metric-label">Fraud/Normal Sep.</span>
              <span className="ml-metric-val" style={{ color: '#06b6d4' }}>{round?.fraudNormalSeparation.toFixed(2)}</span>
            </div>
          </div>

          <div className="ml-ring-recall-table">
            <div className="ml-table-header">
              <span>Ring type</span><span>Local avg</span><span>Federated</span>
            </div>
            {round?.ringRecall.map((rr) => (
              <div key={rr.type} className="ml-table-row">
                <span className="ml-ring-type-chip" style={{ color: RING_COLOR[rr.type] }}>{rr.type}</span>
                <span style={{ color: '#9499ad' }}>{(rr.localRecall * 100).toFixed(1)}%</span>
                <span style={{ color: '#10b981' }}>
                  {(rr.fedRecall * 100).toFixed(1)}%
                  <span className="ml-delta-up"> +{((rr.fedRecall - rr.localRecall) * 100).toFixed(1)}pp</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ml-auc-chart-wrap">
        <div className="ml-chart-label">Global AUC vs local AUC across rounds</div>
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={aucData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <XAxis dataKey="round" tick={{ fill: '#5d637a', fontSize: 11 }} />
            <YAxis domain={[0.75, 0.97]} tick={{ fill: '#5d637a', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#0f121d', border: '1px solid #1a1f32', borderRadius: 6, fontSize: 11 }} />
            <Line dataKey="Fed AUC" stroke="#10b981" strokeWidth={2.5} dot={false} />
            {BANKS.map((b) => (
              <Line key={b} dataKey={`${BANK_LABEL[b]} local`} stroke={BANK_COLOR[b] + '88'} strokeWidth={1} dot={false} strokeDasharray="3 3" />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================
// Act 4 — Knowledge Transfer
// ============================================

function Act4() {
  const demo = useMemo(() => getKnowledgeTransferDemo(), []);
  const rounds = useMemo(() => getFedRounds(), []);

  const normalPoints = rounds[0].embeddings.filter((p) => p.bank === 'axis' && p.cls === 'normal').slice(0, 80);
  const beforePoints: EmbeddingPoint[] = [...normalPoints, ...demo.before];
  const afterPoints: EmbeddingPoint[] = [
    ...rounds[2].embeddings.filter((p) => p.bank === 'axis' && p.cls === 'normal').slice(0, 80),
    ...demo.after,
  ];

  return (
    <div className="ml-act">
      <div className="ml-act-header">
        <span className="ml-act-badge act4">Act 4</span>
        <h2 className="ml-act-title">Knowledge Transfer</h2>
        <p className="ml-act-desc">
          Bank A (Axis) never trained on cycle rings. After federation, the global model catches them anyway.
        </p>
      </div>

      <div className="ml-kt-layout">
        <div className="ml-kt-galaxy-pair">
          <div className="ml-kt-galaxy-slot">
            <div className="ml-kt-label">Before federation — Axis local model</div>
            <div className="ml-kt-sublabel">Cycle-ring accounts sit inside the normal cloud — missed</div>
            <GalaxyCanvas points={beforePoints} width={340} height={260} highlightIds={demo.accountIds} />
            <div className="ml-kt-recall-pill recall-bad">
              Cycle recall: <strong>{(demo.localRecall * 100).toFixed(0)}%</strong>
            </div>
          </div>
          <div className="ml-kt-arrow">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </div>
          <div className="ml-kt-galaxy-slot">
            <div className="ml-kt-label">After 3 federated rounds — global model</div>
            <div className="ml-kt-sublabel">Same accounts move into fraud cluster — without Axis sharing any data</div>
            <GalaxyCanvas points={afterPoints} width={340} height={260} highlightIds={demo.accountIds} />
            <div className="ml-kt-recall-pill recall-good">
              Cycle recall: <strong>{(demo.fedRecall * 100).toFixed(0)}%</strong>
            </div>
          </div>
        </div>

        <div className="ml-kt-proof-box">
          <div className="ml-kt-proof-title">The proof — no data left Axis Bank</div>
          <div className="ml-kt-proof-row">
            <div className="ml-kt-proof-cell">
              <span className="ml-kt-proof-icon"><IconSend /></span>
              <span>What Axis shared: <strong>model weights only</strong></span>
            </div>
            <div className="ml-kt-proof-cell">
              <span className="ml-kt-proof-icon"><IconNoEntry /></span>
              <span>What Axis kept: <strong>all transaction records</strong></span>
            </div>
          </div>
          <div className="ml-kt-proof-row">
            <div className="ml-kt-proof-cell big">
              <span style={{ color: '#9499ad' }}>Axis local recall on cycle rings</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#f43f5e' }}>22%</span>
            </div>
            <div className="ml-kt-arrow-small">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
            <div className="ml-kt-proof-cell big">
              <span style={{ color: '#9499ad' }}>Global model recall on same held-out rings</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}>90%</span>
            </div>
          </div>
          <div className="ml-kt-note">
            SBI's cycle-ring knowledge transferred to Axis without SBI sharing a single transaction record.
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Act 5 — Behaviour Over Time
// ============================================

function Act5() {
  const trails = useMemo(() => getBehaviourTrails(), []);
  const rounds = useMemo(() => getFedRounds(), []);
  const [muleHour, setMuleHour] = useState(0);
  const [attackerHour, setAttackerHour] = useState(0);
  const [playingMule, setPlayingMule] = useState(false);
  const [playingAttacker, setPlayingAttacker] = useState(false);

  const muleTrail = trails[0];
  const attackerTrail = trails[1];

  useEffect(() => {
    if (!playing_mule_ref.current) return;
    const t = setInterval(() => setMuleHour((h) => {
      if (h >= 24) { setPlayingMule(false); return 24; }
      return h + 1;
    }), 300);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingMule]);

  useEffect(() => {
    if (!playing_att_ref.current) return;
    const t = setInterval(() => setAttackerHour((h) => {
      if (h >= 10) { setPlayingAttacker(false); return 10; }
      return h + 1;
    }), 400);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingAttacker]);

  // ref trick to avoid stale closure in interval
  const playing_mule_ref = useRef(playingMule);
  playing_mule_ref.current = playingMule;
  const playing_att_ref = useRef(playingAttacker);
  playing_att_ref.current = playingAttacker;

  const muleFramesSoFar = muleTrail.frames.slice(0, muleHour + 1);
  const attackerFramesSoFar = attackerTrail.frames.slice(0, attackerHour + 1);
  const currentMule = muleTrail.frames[muleHour];
  const currentAttacker = attackerTrail.frames[attackerHour];
  const bgPoints = rounds[2].embeddings.filter((p) => p.cls === 'normal').slice(0, 100);

  return (
    <div className="ml-act">
      <div className="ml-act-header">
        <span className="ml-act-badge act5">Act 5</span>
        <h2 className="ml-act-title">Behaviour Over Time</h2>
        <p className="ml-act-desc">
          Mule accounts drift from the normal cloud into the fraud cluster as behaviour changes.
          Attackers that initially evade detection are caught after a federated update.
        </p>
      </div>

      <div className="ml-act5-layout">
        <div className="ml-act5-panel">
          <div className="ml-act5-panel-title">Mule drift — Axis Bank account</div>
          <div className="ml-scrubber-bar" style={{ marginBottom: 8 }}>
            <button className="ml-play-btn" onClick={() => { setMuleHour(0); setPlayingMule(true); }}>
              <IconPlay /> Play
            </button>
            <input type="range" min={0} max={24} value={muleHour}
              onChange={(e) => { setPlayingMule(false); setMuleHour(+e.target.value); }}
              className="ml-scrubber" />
            <span className="ml-scrubber-label">Hour {muleHour}</span>
          </div>
          <GalaxyCanvas points={bgPoints} width={340} height={240}
            showTrail={muleFramesSoFar.map((f) => ({ x: f.x, y: f.y, cls: 'mule' }))} />
          {currentMule && (
            <div className="ml-trail-metrics">
              {[
                { label: 'Velocity', val: currentMule.velocity.toFixed(1) + ' tx/hr', pct: currentMule.velocity / 20, color: '#f59e0b' },
                { label: 'Pass-through', val: (currentMule.passThroughRatio * 100).toFixed(0) + '%', pct: currentMule.passThroughRatio, color: '#f43f5e' },
                { label: 'Risk score', val: (currentMule.riskScore * 100).toFixed(0), pct: currentMule.riskScore, color: currentMule.riskScore > 0.6 ? '#f43f5e' : '#f59e0b' },
              ].map((m) => (
                <div key={m.label} className="ml-trail-metric">
                  <span>{m.label}</span>
                  <div className="ml-trail-bar">
                    <div style={{ width: `${m.pct * 100}%`, background: m.color, height: '100%', borderRadius: 2 }} />
                  </div>
                  <strong style={{ color: m.color }}>{m.val}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ml-act5-panel">
          <div className="ml-act5-panel-title">Attacker arena — evasive strategy</div>
          <div className="ml-scrubber-bar" style={{ marginBottom: 8 }}>
            <button className="ml-play-btn" onClick={() => { setAttackerHour(0); setPlayingAttacker(true); }}>
              <IconPlay /> Play
            </button>
            <input type="range" min={0} max={10} value={attackerHour}
              onChange={(e) => { setPlayingAttacker(false); setAttackerHour(+e.target.value); }}
              className="ml-scrubber" />
            <span className="ml-scrubber-label">Hour {attackerHour}</span>
          </div>
          <GalaxyCanvas points={bgPoints} width={340} height={240}
            showTrail={attackerFramesSoFar.map((f) => ({ x: f.x, y: f.y, cls: f.riskScore > 0.5 ? 'fraud' : 'normal' }))} />
          {currentAttacker && (
            <div className="ml-attacker-status">
              {attackerHour < 6 ? (
                <div className="ml-status-chip status-miss">
                  <IconWarning /> Strategy evades detection (risk: {(currentAttacker.riskScore * 100).toFixed(0)})
                </div>
              ) : (
                <div className="ml-status-chip status-caught">
                  <IconCheck /> Federated update closed the gap (risk: {(currentAttacker.riskScore * 100).toFixed(0)})
                </div>
              )}
              {attackerHour === 6 && (
                <div className="ml-update-flash">
                  <IconBolt /> Federated round applied — model updated
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Act 6 — Why It Decided That
// ============================================

function RadarViz({ data }: { data: Record<string, number> }) {
  const radarData = Object.entries(data).map(([key, value]) => ({
    feature: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
    value: parseFloat((value * 100).toFixed(0)),
  }));
  return (
    <ResponsiveContainer width="100%" height={160}>
      <RadarChart data={radarData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
        <PolarGrid stroke="rgba(255,255,255,0.06)" />
        <PolarAngleAxis dataKey="feature" tick={{ fill: '#9499ad', fontSize: 9 }} />
        <Radar dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.25} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function SubgraphViz({ edges }: { edges: { from: string; to: string; weight: number }[] }) {
  const nodes = [...new Set(edges.flatMap((e) => [e.from, e.to]))];
  const positions: Record<string, { x: number; y: number }> = {};
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
    positions[n] = { x: 50 + 36 * Math.cos(angle), y: 50 + 36 * Math.sin(angle) };
  });
  return (
    <svg viewBox="0 0 100 100" width="120" height="120" style={{ overflow: 'visible' }}>
      <defs>
        <marker id="arrow-sub" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="rgba(255,255,255,0.3)" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const s = positions[e.from], t = positions[e.to];
        if (!s || !t) return null;
        return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
          stroke={`rgba(255,255,255,${e.weight * 0.5})`} strokeWidth={e.weight * 1.5} markerEnd="url(#arrow-sub)" />;
      })}
      {nodes.map((n) => {
        const pos = positions[n];
        return (
          <g key={n}>
            <circle cx={pos.x} cy={pos.y} r={5} fill="#1a1f32" stroke="#06b6d4" strokeWidth={1.5} />
            <text x={pos.x} y={pos.y + 3.5} textAnchor="middle" fontSize={6} fill="#9499ad">{n}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Act6() {
  const archetypes = useMemo(() => getArchetypeCards(), []);
  const rounds = useMemo(() => getFedRounds(), []);
  const [selectedArc, setSelectedArc] = useState<string | null>(null);

  const highlighted = selectedArc
    ? archetypes.find((a) => a.id === selectedArc)?.memberIds ?? []
    : [];

  return (
    <div className="ml-act">
      <div className="ml-act-header">
        <span className="ml-act-badge act6">Act 6</span>
        <h2 className="ml-act-title">Why It Decided That</h2>
        <p className="ml-act-desc">
          Cluster-based archetype cards explain each decision. Click a card to highlight its members in the galaxy.
          Explanations show estimated feature influence — not ground truth.
        </p>
      </div>

      <div className="ml-act6-layout">
        <div className="ml-archetype-grid">
          {archetypes.map((arc) => (
            <div
              key={arc.id}
              className={`ml-archetype-card ${selectedArc === arc.id ? 'selected' : ''}`}
              style={{ borderColor: selectedArc === arc.id ? RING_COLOR[arc.ringType] : undefined }}
              onClick={() => setSelectedArc(selectedArc === arc.id ? null : arc.id)}
            >
              <div className="ml-arc-header">
                <span className="ml-arc-dot" style={{ background: RING_COLOR[arc.ringType] }} />
                <span className="ml-arc-label" style={{ color: RING_COLOR[arc.ringType] }}>{arc.label}</span>
                <span className="ml-arc-count">{arc.memberIds.length} accounts</span>
              </div>
              <div className="ml-arc-body">
                <div className="ml-arc-radar"><RadarViz data={arc.radar} /></div>
                <div className="ml-arc-subgraph"><SubgraphViz edges={arc.exampleSubgraph} /></div>
              </div>
              <div className="ml-arc-reason">
                <span className="ml-arc-reason-icon"><IconMessage /></span>
                {arc.plainReason}
              </div>
            </div>
          ))}
        </div>

        <div className="ml-act6-galaxy">
          <div className="ml-galaxy-label">
            {selectedArc
              ? `Highlighting ${archetypes.find((a) => a.id === selectedArc)?.label} members`
              : 'Click a card to highlight members'}
          </div>
          <GalaxyCanvas points={rounds[4].embeddings.slice(0, 400)} width={380} height={310} highlightIds={highlighted} />

          <div className="ml-matrix-wall">
            <div className="ml-matrix-header">
              <span>Account</span><span>Velocity</span><span>Pass-through</span>
              <span>Bursts</span><span>Risk</span><span>Reason</span>
            </div>
            {rounds[4].embeddings
              .filter((p) => p.cls === 'fraud')
              .sort((a, b) => b.riskScore - a.riskScore)
              .slice(0, 12)
              .map((p) => {
                const arc = archetypes.find((a) => a.memberIds.includes(p.id));
                return (
                  <div key={p.id}
                    className={`ml-matrix-row ${highlighted.includes(p.id) ? 'highlighted' : ''}`}
                    style={{ background: highlighted.includes(p.id) ? RING_COLOR[p.ringType ?? 'chain'] + '15' : undefined }}>
                    <span className="ml-matrix-id" style={{ color: BANK_COLOR[p.bank] }}>{p.id.slice(-6)}</span>
                    <span style={{ color: p.velocity > 12 ? '#f43f5e' : '#9499ad' }}>{p.velocity.toFixed(1)}</span>
                    <span style={{ color: p.passThroughRatio > 0.8 ? '#f43f5e' : '#9499ad' }}>{(p.passThroughRatio * 100).toFixed(0)}%</span>
                    <span style={{ color: p.burstCount > 5 ? '#f59e0b' : '#9499ad' }}>{p.burstCount}</span>
                    <span style={{ color: '#f43f5e', fontWeight: 600 }}>{(p.riskScore * 100).toFixed(0)}</span>
                    <span style={{ color: RING_COLOR[p.ringType ?? 'chain'], fontSize: 11 }}>{arc?.label ?? p.ringType}</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Numbers panel
// ============================================

function NumbersPanel({ fedRoundIdx }: { fedRoundIdx: number }) {
  const rounds = useMemo(() => getFedRounds(), []);
  const round = rounds[Math.min(fedRoundIdx, rounds.length - 1)];

  return (
    <div className="ml-numbers-panel">
      <div className="ml-numbers-title">Numbers Panel</div>

      <div className="ml-numbers-section">
        <div className="ml-numbers-section-title">AUC (Round {round.round})</div>
        {BANKS.map((b) => (
          <div key={b} className="ml-numbers-row">
            <span style={{ color: BANK_COLOR[b] }}>{BANK_LABEL[b]} local</span>
            <span>{round.localAucs[b].toFixed(3)}</span>
          </div>
        ))}
        <div className="ml-numbers-row highlight">
          <span style={{ color: '#10b981' }}>Federated</span>
          <strong style={{ color: '#10b981' }}>{round.globalAuc.toFixed(3)}</strong>
        </div>
      </div>

      <div className="ml-numbers-section">
        <div className="ml-numbers-section-title">Cross-bank ring recall</div>
        {round.ringRecall.map((rr) => (
          <div key={rr.type} className="ml-numbers-row">
            <span style={{ color: RING_COLOR[rr.type], fontSize: 11 }}>{rr.type}</span>
            <span style={{ color: '#9499ad' }}>{(rr.localRecall * 100).toFixed(0)}%</span>
            <span style={{ color: '#10b981' }}>{(rr.fedRecall * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>

      <div className="ml-numbers-section">
        <div className="ml-numbers-section-title">Separation score</div>
        <div className="ml-numbers-row highlight">
          <span>Fraud vs. normal</span>
          <strong style={{ color: '#06b6d4' }}>{round.fraudNormalSeparation.toFixed(2)}</strong>
        </div>
      </div>

      <div className="ml-numbers-section">
        <div className="ml-numbers-section-title">Update norms</div>
        {round.bankUpdates.map((upd) => (
          <div key={upd.bank} className="ml-numbers-row">
            <span style={{ color: BANK_COLOR[upd.bank] }}>{BANK_LABEL[upd.bank]}</span>
            <span style={{ color: upd.poisoned ? '#f43f5e' : '#9499ad' }}>
              {upd.norm.toFixed(2)}{upd.poisoned ? ' !' : ''}
            </span>
            <span style={{ color: upd.similarity < 0.3 ? '#f43f5e' : '#9499ad', fontSize: 10 }}>
              sim {upd.similarity.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      <div className="ml-numbers-note">Synthetic data · Simulated attacker</div>
    </div>
  );
}

// ============================================
// Main page
// ============================================

const ACT_COMPONENTS = [Act1, Act2, Act3, Act4, Act5, Act6];

export default function ModelLabPage() {
  const [act, setAct] = useState(1);
  const [fedRoundIdx, setFedRoundIdx] = useState(0);
  const ActComponent = ACT_COMPONENTS[act - 1];

  return (
    <div className="ml-root">
      <div className="ml-topbar">
        <a href="/" className="ml-back-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          Command Center
        </a>
        <div className="ml-topbar-title">
          <span style={{ color: 'var(--cyan)', display: 'flex' }}><IconFlask /></span>
          Model Lab — Federated Learning Visualization
        </div>

      </div>

      <div className="ml-act-nav">
        {ACTS.map((a) => (
          <button
            key={a.id}
            className={`ml-act-nav-btn ${act === a.id ? 'active' : ''}`}
            onClick={() => setAct(a.id)}
          >
            <span className="ml-act-nav-num">{a.id}</span>
            <span className="ml-act-nav-label">{a.label}</span>
          </button>
        ))}
      </div>

      <div className="ml-body">
        <aside className="ml-sidebar-left">
          <div className="ml-claim-card">
            <div className="ml-claim-num">Claim {act}</div>
            <div className="ml-claim-text">{CLAIMS[act - 1]}</div>
          </div>
          <div className="ml-feature-sidebar">
            <div className="ml-sidebar-section-title">Behaviour features</div>
            {BEHAVIOUR_FEATURES.map((f) => (
              <div key={f.name} className="ml-sidebar-feature">
                <span>{f.label}</span>
                <span className="ml-sidebar-unit">{f.unit}</span>
              </div>
            ))}
            <div className="ml-sidebar-privacy">No names · No accounts · No KYC</div>
          </div>
        </aside>

        <main className="ml-main-content">
          <ActComponent />
        </main>

        <aside className="ml-sidebar-right">
          <NumbersPanel fedRoundIdx={fedRoundIdx} />
          <div className="ml-round-sync">
            <div className="ml-sidebar-section-title">Federated round</div>
            <input type="range" min={0} max={4} value={fedRoundIdx}
              onChange={(e) => setFedRoundIdx(+e.target.value)}
              className="ml-scrubber" style={{ width: '100%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#5d637a', fontSize: 11 }}>
              <span>R1</span><span>R2</span><span>R3</span><span>R4</span><span>R5</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
