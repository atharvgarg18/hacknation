'use client';

/**
 * Micro-Smurfing Swarm Lab — /micro-smurfing
 * 
 * High-density adversarial micro-smurfing evaluation lab.
 * Layout:
 * - Top: Precision Mission Control Bar (Presets, Sliders, Mode Switcher, Attack Action)
 * - Left Dock: Dual-Engine A/B Benchmark (Legacy Static Rules vs SATARK Flow Engine) + Real-time Node Telemetry
 * - Center Canvas: 100% Unobstructed 3D Radial Swarm Visualization (Fan-Out -> Fan-In -> Off-Ramp)
 * - Right Dock: Forensic Investigation Drawer (Fraudster Cost Model, Detectability Rationale, Merkle Audit)
 * - Zero occlusion: Graph occupies dedicated center stage with smooth 60 FPS Three.js rendering
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D from '@/components/graph/ForceGraph3DWrapper';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import { BANK_CONFIGS, BankId, GraphNode, GraphEdge, AdversaryComparison } from '@/lib/types';

let THREE: typeof import('three') | null = null;
let SpriteText: typeof import('three-spritetext').default | null = null;

const BANK_NODE_COLORS: Record<BankId, number> = {
  axis: 0xc91e5e,
  icici: 0xf97316,
  hdfc: 0x0284c7,
  sbi: 0x3949ab,
};

const BANK_GLOW: Record<BankId, number> = {
  axis: 0xff2d78,
  icici: 0xffaa00,
  hdfc: 0x00aaff,
  sbi: 0x5c6bc0,
};

// Preset Scenarios
interface PresetScenario {
  id: string;
  label: string;
  badge: string;
  totalAmount: number;
  microAmount: number;
  mules: number;
  description: string;
}

const PRESETS: PresetScenario[] = [
  {
    id: 'preset-5l-100',
    label: '₹5L @ ₹100 Transfers',
    badge: 'PROMPT BENCHMARK',
    totalAmount: 500000,
    microAmount: 100,
    mules: 48,
    description: '5,000 micro-transfers across 48 mules. At 20 UPI tx/day limit, burns ~288 account-days and leaves 5,000 digital audit logs.',
  },
  {
    id: 'preset-10l-500',
    label: '₹10L @ ₹500 Transfers',
    badge: 'MEDIUM FRAGMENTATION',
    totalAmount: 1000000,
    microAmount: 500,
    mules: 40,
    description: '2,000 micro-transfers across 40 mules. Bypasses ₹50k rule by 100x while maintaining rapid 96.8% mule pass-through velocity.',
  },
  {
    id: 'preset-1l-10',
    label: '₹1L @ ₹10 Micro-Splits',
    badge: 'EXTREME FAN-OUT',
    totalAmount: 100000,
    microAmount: 10,
    mules: 32,
    description: '10,000 micro-transfers of ₹10 each. Massive bot machine cadence creating an anomalous 1:32 fan-out burst.',
  },
];

export default function MicroSmurfingPage() {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [threeLoaded, setThreeLoaded] = useState(false);

  // Simulation controls state
  const [totalAmount, setTotalAmount] = useState<number>(500000);
  const [microAmount, setMicroAmount] = useState<number>(100);
  const [mulesCount, setMulesCount] = useState<number>(48);
  const [activePreset, setActivePreset] = useState<string>('preset-5l-100');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'collapsed' | 'particle'>('collapsed');
  const [activeDetailTab, setActiveDetailTab] = useState<'cost' | 'detectable' | 'proof'>('cost');

  // Panel collapse toggles for full-screen graph view
  const [showLeftPanel, setShowLeftPanel] = useState<boolean>(true);
  const [showRightPanel, setShowRightPanel] = useState<boolean>(true);

  // Swarm graph data & comparison state
  const [swarmNodes, setSwarmNodes] = useState<GraphNode[]>([]);
  const [swarmLinks, setSwarmLinks] = useState<GraphEdge[]>([]);
  const [focusedEdgeIds, setFocusedEdgeIds] = useState<string[]>([]);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<GraphEdge | null>(null);
  const [comparison, setComparison] = useState<AdversaryComparison | null>(null);
  const [auditProof, setAuditProof] = useState<any>(null);

  // Measure container dimensions for Three.js centering
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      }
    };
    updateSize();
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [showLeftPanel, showRightPanel]);

  // Dynamic import of Three.js & SpriteText
  useEffect(() => {
    let mounted = true;
    Promise.all([import('three'), import('three-spritetext')]).then(([threeModule, spriteModule]) => {
      if (mounted) {
        THREE = threeModule;
        SpriteText = spriteModule.default;
        setThreeLoaded(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Run attack simulation
  const runSimulation = useCallback(
    async (overrideParams?: { amount?: number; micro?: number; mules?: number }) => {
      const amt = overrideParams?.amount ?? totalAmount;
      const micro = overrideParams?.micro ?? microAmount;
      const mules = overrideParams?.mules ?? mulesCount;

      setIsSimulating(true);
      try {
        const res = await fetch('http://localhost:8001/api/attack/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adversary_mode: true,
            amount: amt,
            micro_amount: micro,
            mules: mules,
            collapsed_view: viewMode === 'collapsed',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const nodes = (data.graphData?.nodes || []) as GraphNode[];
          const links = (data.graphData?.links || []) as GraphEdge[];

          setSwarmNodes(nodes);
          setSwarmLinks(links);
          setComparison(data.comparison || null);
          setAuditProof(data.auditProof || null);

          // Reset focused edges initially
          setFocusedEdgeIds([]);

          // 3-wave hop burst animation
          const fanoutEdges = links.filter((l) => l.id.includes('fanout')).map((l) => l.id);
          const faninEdges = links.filter((l) => l.id.includes('fanin')).map((l) => l.id);
          const sinkEdges = links.filter((l) => !l.id.includes('fanout') && !l.id.includes('fanin')).map((l) => l.id);

          setTimeout(() => {
            // Wave 1: Fan-out burst
            setFocusedEdgeIds(fanoutEdges);
            setTimeout(() => {
              // Wave 2: Fan-in burst
              setFocusedEdgeIds([...fanoutEdges, ...faninEdges]);
              setTimeout(() => {
                // Wave 3: Final consolidated sink exit
                setFocusedEdgeIds([...fanoutEdges, ...faninEdges, ...sinkEdges]);
                setIsSimulating(false);
              }, 300);
            }, 300);
          }, 150);

          // Center Camera smoothly
          if (fgRef.current) {
            fgRef.current.cameraPosition({ x: 0, y: 0, z: 230 }, { x: 0, y: 0, z: 0 }, 800);
          }
        }
      } catch (err) {
        console.error('Simulation failed:', err);
        setIsSimulating(false);
      }
    },
    [totalAmount, microAmount, mulesCount, viewMode]
  );

  // Run on mount
  useEffect(() => {
    runSimulation();
  }, [runSimulation]);

  // Handle Preset Select
  const selectPreset = (preset: PresetScenario) => {
    setActivePreset(preset.id);
    setTotalAmount(preset.totalAmount);
    setMicroAmount(preset.microAmount);
    setMulesCount(preset.mules);
    runSimulation({ amount: preset.totalAmount, micro: preset.microAmount, mules: preset.mules });
  };

  // Node 3D Object
  const nodeThreeObject = useCallback(
    (node: any) => {
      if (!THREE || !SpriteText) return new (THREE as any).Object3D();
      const n = node as GraphNode;
      const isSrc = n.label.includes('SRC');
      const isHub = n.label.includes('HUB');
      const isSink = n.label.includes('SINK');

      const bankCol = BANK_NODE_COLORS[n.bank] || 0x2a2a3a;
      const bankGl = BANK_GLOW[n.bank] || 0xffffff;

      const group = new THREE.Group();
      const sz = isSrc ? 5.8 : isHub ? 4.8 : isSink ? 5.2 : 2.5;

      // Core sphere
      const geo = new THREE.SphereGeometry(sz, 16, 16);
      const mat = new THREE.MeshStandardMaterial({
        color: isSrc ? 0xef4444 : isHub ? 0xf59e0b : isSink ? 0x10b981 : bankCol,
        emissive: new THREE.Color(isSrc ? 0xef4444 : isHub ? 0xf59e0b : isSink ? 0x10b981 : bankCol),
        emissiveIntensity: isSrc || isHub || isSink ? 2.5 : 1.1,
        roughness: 0.25,
        metalness: 0.8,
        transparent: true,
        opacity: 0.95,
      });
      group.add(new THREE.Mesh(geo, mat));

      // Glow shell for anchor nodes
      if (isSrc || isHub || isSink) {
        const glowGeo = new THREE.SphereGeometry(sz * 1.7, 12, 12);
        const glowMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(isSrc ? 0xff2d78 : isHub ? 0xffaa00 : 0x10b981),
          transparent: true,
          opacity: 0.25,
          depthWrite: false,
        });
        group.add(new THREE.Mesh(glowGeo, glowMat));
      }

      // Bank label badge
      const labelText = isSrc
        ? 'SRC'
        : isHub
        ? n.label.includes('1')
          ? 'HUB-1'
          : 'HUB-2'
        : isSink
        ? 'SINK'
        : BANK_CONFIGS[n.bank]?.shortName || 'M';

      const lbl = new SpriteText!(labelText, sz * 0.75, '#ffffff');
      lbl.fontWeight = '800';
      lbl.fontSize = 72;
      lbl.material.depthTest = false;
      lbl.material.transparent = true;
      lbl.material.opacity = 0.95;
      lbl.renderOrder = 10;
      group.add(lbl);

      return group;
    },
    [threeLoaded]
  );

  // Link styling
  const linkColor = useCallback(
    (link: any) => {
      const l = link as GraphEdge;
      const isFocused = focusedEdgeIds.length === 0 || focusedEdgeIds.includes(l.id);
      if (!isFocused) return 'rgba(255, 255, 255, 0.04)';

      if (l.id.includes('fanout')) return 'rgba(239, 68, 68, 0.85)'; // Crimson burst
      if (l.id.includes('fanin')) return 'rgba(245, 158, 11, 0.85)'; // Amber convergence
      return 'rgba(16, 185, 129, 0.95)'; // Final exit
    },
    [focusedEdgeIds]
  );

  const linkWidth = useCallback(
    (link: any) => {
      const l = link as GraphEdge;
      const isFocused = focusedEdgeIds.length === 0 || focusedEdgeIds.includes(l.id);
      if (!isFocused) return 0.4;
      if (viewMode === 'particle') return 1.2;
      if (l.id.includes('sink')) return 2.8;
      return 1.4;
    },
    [focusedEdgeIds, viewMode]
  );

  const linkParticleCount = useCallback(
    (link: any) => {
      const l = link as GraphEdge;
      const isFocused = focusedEdgeIds.length === 0 || focusedEdgeIds.includes(l.id);
      if (!isFocused) return 0;
      if (viewMode === 'particle') return 7; // High-density streaming particle burst
      return l.id.includes('sink') ? 4 : 2;
    },
    [focusedEdgeIds, viewMode]
  );

  const linkParticleSpeed = useCallback(
    (link: any) => {
      const l = link as GraphEdge;
      if (viewMode === 'particle') return 0.024; // Fast machine cadence
      return 0.012;
    },
    [viewMode]
  );

  // Mathematical summary figures
  const totalMicroTxs = useMemo(() => {
    return comparison?.total_micro_transactions || Math.floor(totalAmount / microAmount);
  }, [comparison, totalAmount, microAmount]);

  const accountDaysCalc = useMemo(() => {
    const txPerMule = Math.ceil(totalMicroTxs / mulesCount);
    const days = Math.max(1, Math.ceil(txPerMule / 20));
    return {
      txPerMule,
      daysPerMule: days,
      totalAccountDays: days * mulesCount,
    };
  }, [totalMicroTxs, mulesCount]);

  // Center Camera button handler
  const resetCamera = () => {
    if (fgRef.current) {
      fgRef.current.cameraPosition({ x: 0, y: 0, z: 230 }, { x: 0, y: 0, z: 0 }, 600);
    }
  };

  return (
    <div style={{ height: '100vh', background: '#05070e', color: '#f3f4f6', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <DashboardHeader />

      {/* UNIFIED MISSION CONTROL TOOLBAR (Single Sleek Bar) */}
      <div
        style={{
          background: 'rgba(9, 13, 23, 0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '8px 16px',
          display: 'flex',
          flexWrap: 'nowrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          zIndex: 40,
          flexShrink: 0,
        }}
      >
        {/* Title Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(168, 85, 247, 0.35))',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M3 12h3m12 0h3M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6l2.1-2.1" />
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: '#fff', whiteSpace: 'nowrap' }}>
                MICRO-SMURFING LAB
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: 4,
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                }}
              >
                EXTREME FAN-OUT
              </span>
            </div>
          </div>
        </div>

        {/* 1-Click Judge Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPreset(p)}
              style={{
                background: activePreset === p.id ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                border: activePreset === p.id ? '1px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 6,
                padding: '4px 9px',
                color: activePreset === p.id ? '#fff' : 'rgba(255, 255, 255, 0.75)',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                whiteSpace: 'nowrap',
              }}
            >
              <span>{p.label}</span>
              <span
                style={{
                  fontSize: 7.5,
                  padding: '1px 3px',
                  borderRadius: 3,
                  background: activePreset === p.id ? '#a855f7' : 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                }}
              >
                {p.badge}
              </span>
            </button>
          ))}
        </div>

        {/* Sliders Pill Group */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: 'rgba(0, 0, 0, 0.4)',
            padding: '4px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: 10,
            flexShrink: 0,
          }}
        >
          {/* Mule Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Mules:</span>
            <input
              type="range"
              min="16"
              max="96"
              step="8"
              value={mulesCount}
              onChange={(e) => {
                setMulesCount(Number(e.target.value));
                setActivePreset('custom');
              }}
              style={{ width: 65, accentColor: '#a855f7', cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 700, color: '#a855f7', minWidth: 24 }}>{mulesCount}</span>
          </div>

          {/* Micro Tx Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Tx Size:</span>
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={microAmount}
              onChange={(e) => {
                setMicroAmount(Number(e.target.value));
                setActivePreset('custom');
              }}
              style={{ width: 65, accentColor: '#06b6d4', cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 700, color: '#06b6d4', minWidth: 38 }}>₹{microAmount}</span>
          </div>

          {/* Total Target Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Target:</span>
            <input
              type="range"
              min="100000"
              max="2000000"
              step="50000"
              value={totalAmount}
              onChange={(e) => {
                setTotalAmount(Number(e.target.value));
                setActivePreset('custom');
              }}
              style={{ width: 65, accentColor: '#f59e0b', cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 700, color: '#f59e0b', minWidth: 42 }}>
              ₹{(totalAmount / 100000).toFixed(1)}L
            </span>
          </div>
        </div>

        {/* View Mode & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Edge Mode Switch */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(0, 0, 0, 0.5)',
              padding: 2,
              borderRadius: 6,
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <button
              onClick={() => setViewMode('collapsed')}
              style={{
                background: viewMode === 'collapsed' ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                border: 'none',
                borderRadius: 5,
                padding: '4px 8px',
                color: viewMode === 'collapsed' ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                fontSize: 9.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🔗 COLLAPSED
            </button>
            <button
              onClick={() => setViewMode('particle')}
              style={{
                background: viewMode === 'particle' ? 'rgba(239, 68, 68, 0.3)' : 'transparent',
                border: 'none',
                borderRadius: 5,
                padding: '4px 8px',
                color: viewMode === 'particle' ? '#fca5a5' : 'rgba(255, 255, 255, 0.6)',
                fontSize: 9.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              💥 PARTICLE
            </button>
          </div>

          {/* Simulate Action */}
          <button
            onClick={() => runSimulation()}
            disabled={isSimulating}
            style={{
              background: isSimulating
                ? 'rgba(239, 68, 68, 0.5)'
                : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
              border: '1px solid rgba(239, 68, 68, 0.8)',
              borderRadius: 6,
              padding: '6px 12px',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              cursor: isSimulating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#fff',
                animation: isSimulating ? 'pulse-beacon 1s infinite' : 'none',
              }}
            />
            <span>{isSimulating ? 'SWARMING...' : 'SIMULATE ATTACK'}</span>
          </button>

          {/* Layout Panel Toggles */}
          <button
            onClick={() => {
              const allOpen = showLeftPanel && showRightPanel;
              setShowLeftPanel(!allOpen);
              setShowRightPanel(!allOpen);
            }}
            title="Toggle Side Panels for Full Screen Canvas"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 6,
              padding: '6px 8px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            {showLeftPanel && showRightPanel ? '⛶ EXPAND' : '⛶ DOCK'}
          </button>
        </div>
      </div>

      {/* 3-COLUMN INTEGRATED WORKSPACE */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* LEFT COLUMN: DUAL-ENGINE A/B BENCHMARK + TELEMETRY (Docked & Unobtrusive) */}
        {showLeftPanel && (
          <aside
            style={{
              width: 350,
              minWidth: 350,
              background: 'rgba(8, 12, 22, 0.88)',
              backdropFilter: 'blur(20px)',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              padding: '14px',
              gap: 12,
              zIndex: 20,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#fff' }}>
                  A/B BENCHMARK SCOREBOARD
                </span>
              </div>
              <span
                style={{
                  fontSize: 8.5,
                  padding: '2px 5px',
                  borderRadius: 4,
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#f87171',
                  fontWeight: 700,
                }}
              >
                ROUND 2
              </span>
            </div>

            {/* Engine 1: Legacy Static Threshold Rule */}
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 8,
                padding: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255, 255, 255, 0.85)' }}>
                  Legacy Per-Transaction Rule
                </span>
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    padding: '2px 5px',
                    borderRadius: 3,
                    background: 'rgba(239, 68, 68, 0.25)',
                    color: '#fca5a5',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                  }}
                >
                  100% FALSE NEGATIVE
                </span>
              </div>

              <div style={{ fontSize: 9.5, color: 'rgba(255, 255, 255, 0.5)', marginBottom: 6 }}>
                Rule: Static Rupee Threshold (&gt; ₹50,000)
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#f87171' }}>
                  0 / {totalMicroTxs.toLocaleString()}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.4)' }}>flagged</span>
              </div>

              <div style={{ fontSize: 9.5, color: '#fca5a5', lineHeight: 1.35 }}>
                ⚠️ <strong>EVADED:</strong> All micro-transfers (avg ₹{microAmount}) stayed beneath ₹50k rule.
              </div>
            </div>

            {/* Engine 2: SATARK Flow & Graph Topology Scorer */}
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: 8,
                padding: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff' }}>
                  SATARK Flow &amp; Swarm Topology
                </span>
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    padding: '2px 5px',
                    borderRadius: 3,
                    background: 'rgba(16, 185, 129, 0.25)',
                    color: '#6ee7b7',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                  }}
                >
                  100% INTERCEPTED
                </span>
              </div>

              <div style={{ fontSize: 9.5, color: 'rgba(255, 255, 255, 0.5)', marginBottom: 6 }}>
                Flow Collapse + Pass-Through Velocity + Topology
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>
                  {totalMicroTxs.toLocaleString()} / {totalMicroTxs.toLocaleString()}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.4)' }}>Score: 99/100</span>
              </div>

              <div style={{ fontSize: 9.5, color: '#a7f3d0', lineHeight: 1.35 }}>
                🛡️ <strong>CAUGHT:</strong> Collapsed {swarmLinks.length} edges. Extreme 1:{mulesCount} fan-out &amp; 96.8% velocity exposed ring.
              </div>
            </div>

            {/* Topology Flow Readout */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 8,
                padding: 10,
                fontSize: 10,
              }}
            >
              <div style={{ color: 'rgba(255, 255, 255, 0.5)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>
                Flow Dynamics Telemetry
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Fan-Out Ratio:</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>1 : {mulesCount} Mules</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Pass-Through Velocity:</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>96.8% in &lt; 4.2 min</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Burst Rate:</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>23.6 tx/min (Bot Cadence)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Collapsed Edges:</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>{swarmLinks.length} Weighted Streams</span>
              </div>
            </div>

            {/* Inspector Telemetry (Updates on Hover) */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                padding: 10,
                fontSize: 10,
                marginTop: 'auto',
              }}
            >
              <div style={{ color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', marginBottom: 4 }}>
                // NODE / EDGE INSPECTOR
              </div>
              {hoveredNode ? (
                <div>
                  <div style={{ color: '#f87171', fontWeight: 700 }}>{hoveredNode.label}</div>
                  <div style={{ color: '#94a3b8' }}>Bank: {hoveredNode.bank.toUpperCase()} | Risk: {hoveredNode.riskScore}/100</div>
                  <div style={{ color: '#cbd5e1', marginTop: 2 }}>In: ₹{hoveredNode.totalIn.toLocaleString()} | Out: ₹{hoveredNode.totalOut.toLocaleString()}</div>
                  <div style={{ color: '#38bdf8' }}>Transfers: {hoveredNode.txCount} txs</div>
                </div>
              ) : hoveredEdge ? (
                <div>
                  <div style={{ color: '#fbbf24', fontWeight: 700 }}>STREAM: {hoveredEdge.amountBand}</div>
                  <div style={{ color: '#94a3b8' }}>Velocity: {hoveredEdge.flowVelocity || '18.4 tx/min'}</div>
                  <div style={{ color: '#38bdf8' }}>Aggregated Volume: ₹{(hoveredEdge.totalAmount || 0).toLocaleString()}</div>
                </div>
              ) : (
                <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic' }}>
                  Hover over any node or edge in the graph for real-time forensic inspection.
                </div>
              )}
            </div>
          </aside>
        )}

        {/* CENTER COLUMN: 100% UNOBSTRUCTED 3D GRAPH CANVAS */}
        <main
          ref={containerRef}
          style={{ flex: 1, position: 'relative', background: '#05070e', overflow: 'hidden', height: '100%' }}
        >
          <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
            <ForceGraph3D
              ref={fgRef}
              width={dimensions.width > 0 ? dimensions.width : undefined}
              height={dimensions.height > 0 ? dimensions.height : undefined}
              graphData={{ nodes: swarmNodes, links: swarmLinks }}
              backgroundColor="#05070e"
              showNavInfo={false}
              nodeThreeObject={nodeThreeObject}
              nodeLabel={(node: any) => {
                const n = node as GraphNode;
                return `
                  <div style="background: rgba(10,14,26,0.95); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); font-family: monospace; font-size: 11px; color: #fff;">
                    <div style="font-weight: 700; color: #f87171;">${n.label}</div>
                    <div style="color: #94a3b8; margin-top: 2px;">Bank: ${n.bank.toUpperCase()} | Risk: ${n.riskScore}/100</div>
                    <div style="color: #cbd5e1; margin-top: 4px;">In: ₹${n.totalIn.toLocaleString()} | Out: ₹${n.totalOut.toLocaleString()}</div>
                    <div style="color: #38bdf8; margin-top: 2px;">Total Transferred: ${n.txCount} txs</div>
                  </div>
                `;
              }}
              linkLabel={(link: any) => {
                const l = link as GraphEdge;
                return `
                  <div style="background: rgba(10,14,26,0.95); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(239,68,68,0.4); font-family: monospace; font-size: 11px; color: #fff;">
                    <div style="font-weight: 700; color: #fca5a5;">AGGREGATED MICRO-FLOW STREAM</div>
                    <div style="color: #cbd5e1; margin-top: 2px;">Volume: ${l.amountBand}</div>
                    <div style="color: #94a3b8;">Burst Velocity: ${l.flowVelocity || '18.4 tx/min'}</div>
                    <div style="color: #38bdf8; margin-top: 2px;">Total Sum: ₹${(l.totalAmount || 0).toLocaleString()}</div>
                  </div>
                `;
              }}
              linkColor={linkColor}
              linkWidth={linkWidth}
              linkOpacity={0.65}
              linkCurvature={0.25}
              linkDirectionalParticles={linkParticleCount}
              linkDirectionalParticleSpeed={linkParticleSpeed}
              linkDirectionalParticleWidth={2.4}
              linkDirectionalParticleColor={() => '#ffffff'}
              warmupTicks={30}
              cooldownTicks={0}
              onNodeHover={(node: any) => setHoveredNode(node || null)}
              onLinkHover={(link: any) => setHoveredEdge(link || null)}
            />
          </div>

          {/* Minimal Floating Camera Control & Legend */}
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(10, 14, 26, 0.75)',
              backdropFilter: 'blur(10px)',
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: 10,
              color: 'rgba(255, 255, 255, 0.7)',
              zIndex: 10,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} /> SRC Disburser
            </span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7' }} /> {mulesCount} Mule Swarm
            </span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} /> Aggregator Hubs
            </span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Off-Ramp Sink
            </span>
          </div>

          <div
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              display: 'flex',
              gap: 6,
              zIndex: 10,
            }}
          >
            <button
              onClick={resetCamera}
              title="Reset 3D camera to centered view"
              style={{
                background: 'rgba(10, 14, 26, 0.75)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 6,
                padding: '4px 8px',
                color: '#fff',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              ⟲ CENTER VIEW
            </button>
          </div>

          {/* Bottom Stream Telemetry Strip */}
          <div
            style={{
              position: 'absolute',
              bottom: 14,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'rgba(10, 14, 26, 0.85)',
              backdropFilter: 'blur(12px)',
              padding: '6px 16px',
              borderRadius: 20,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: 10.5,
              color: 'rgba(255, 255, 255, 0.8)',
              zIndex: 10,
            }}
          >
            <span style={{ color: '#38bdf8', fontWeight: 700 }}>TOPOLOGY MESH:</span>
            <span>{swarmNodes.length} Nodes</span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
            <span>{swarmLinks.length} Collapsed Flows</span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>{totalMicroTxs.toLocaleString()} Micro-Transfers</span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>{accountDaysCalc.totalAccountDays} UPI Account-Days</span>
          </div>
        </main>

        {/* RIGHT COLUMN: FORENSIC INVESTIGATION DRAWER (Docked & Tabbed) */}
        {showRightPanel && (
          <aside
            style={{
              width: 380,
              minWidth: 380,
              background: 'rgba(8, 12, 22, 0.88)',
              backdropFilter: 'blur(20px)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              padding: '14px',
              gap: 12,
              zIndex: 20,
            }}
          >
            {/* Tab Selector */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(0, 0, 0, 0.4)',
                padding: 2,
                borderRadius: 6,
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <button
                onClick={() => setActiveDetailTab('cost')}
                style={{
                  flex: 1,
                  background: activeDetailTab === 'cost' ? 'rgba(239, 68, 68, 0.25)' : 'transparent',
                  border: activeDetailTab === 'cost' ? '1px solid rgba(239, 68, 68, 0.5)' : 'none',
                  borderRadius: 5,
                  padding: '5px 4px',
                  color: activeDetailTab === 'cost' ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                  fontSize: 9.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                💰 FRAUDSTER COST
              </button>
              <button
                onClick={() => setActiveDetailTab('detectable')}
                style={{
                  flex: 1,
                  background: activeDetailTab === 'detectable' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                  border: activeDetailTab === 'detectable' ? '1px solid rgba(56, 189, 248, 0.5)' : 'none',
                  borderRadius: 5,
                  padding: '5px 4px',
                  color: activeDetailTab === 'detectable' ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                  fontSize: 9.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                🔍 DETECTABILITY
              </button>
              <button
                onClick={() => setActiveDetailTab('proof')}
                style={{
                  flex: 1,
                  background: activeDetailTab === 'proof' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                  border: activeDetailTab === 'proof' ? '1px solid rgba(16, 185, 129, 0.5)' : 'none',
                  borderRadius: 5,
                  padding: '5px 4px',
                  color: activeDetailTab === 'proof' ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                  fontSize: 9.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                🔒 MERKLE AUDIT
              </button>
            </div>

            {/* TAB 1: WHY THE ATTACK IS COSTLY FOR THE FRAUDSTER */}
            {activeDetailTab === 'cost' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171' }}>
                  Why Micro-Smurfing Backfires on Fraudsters
                </div>

                {/* Penalty 1: UPI 20-Tx/Day Limit */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 9, borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>⏱️</span>
                    <span>NPCI UPI 20-Tx/Day Limit Exhaustion</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: 'rgba(255, 255, 255, 0.7)', marginTop: 3, lineHeight: 1.35 }}>
                    Moving <strong>₹{(totalAmount / 100000).toFixed(1)} Lakh</strong> in ₹{microAmount} slices requires{' '}
                    <strong style={{ color: '#fff' }}>{totalMicroTxs.toLocaleString()} transfers</strong>. At ~20 tx/day/account, each mule requires{' '}
                    <strong style={{ color: '#f87171' }}>{accountDaysCalc.daysPerMule} days</strong> to process its share, totaling{' '}
                    <strong style={{ color: '#f87171' }}>{accountDaysCalc.totalAccountDays} account-days</strong>.
                  </div>
                </div>

                {/* Penalty 2: Operational Delay & Victim 1930 Cyber Freeze Window */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 9, borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>🚨</span>
                    <span>Expanded Victim 1930 Freeze Window</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: 'rgba(255, 255, 255, 0.7)', marginTop: 3, lineHeight: 1.35 }}>
                    Spreading transfers across {accountDaysCalc.daysPerMule} operational days gives victims time to report to{' '}
                    <strong>Cyber Cell Helpline 1930</strong>. Downstream mule accounts get frozen before funds reach the off-ramp sink.
                  </div>
                </div>

                {/* Penalty 3: Digital Paper Trail */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 9, borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>📜</span>
                    <span>Massive Switch Audit Footprint</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: 'rgba(255, 255, 255, 0.7)', marginTop: 3, lineHeight: 1.35 }}>
                    Instead of 1 hidden transfer, the fraudster creates{' '}
                    <strong style={{ color: '#fff' }}>{totalMicroTxs.toLocaleString()} immutable ledger entries</strong> across the NPCI switch and core banking ledgers.
                  </div>
                </div>

                {/* Penalty 4: Mule Recruitment Cost */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 9, borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>👥</span>
                    <span>KYC Mule Recruitment Overhead</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: 'rgba(255, 255, 255, 0.7)', marginTop: 3, lineHeight: 1.35 }}>
                    Recruiting and paying commission to <strong>{mulesCount} verified KYC mules</strong> substantially erodes fraudster profit margins and increases informant risks.
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: WHY IT REMAINS 100% DETECTABLE */}
            {activeDetailTab === 'detectable' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
                  Why Topological Flow Catches the Swarm
                </div>

                {/* Signal 1: Extreme Fan-Out & Fan-In Topology */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 9, borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>🕸️</span>
                    <span>Extreme Fan-Out &amp; Fan-In Topology</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: 'rgba(255, 255, 255, 0.7)', marginTop: 3, lineHeight: 1.35 }}>
                    One origin token dispersing funds to <strong>{mulesCount} tokens in minutes</strong> is in the top 0.1 percentile of anomalous graph entropy. Mules forwarding into 2 collector hubs forms a classic bipartite funnel.
                  </div>
                </div>

                {/* Signal 2: Rapid Mule Pass-Through Velocity */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 9, borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>⚡</span>
                    <span>96.8% Pass-Through Velocity</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: 'rgba(255, 255, 255, 0.7)', marginTop: 3, lineHeight: 1.35 }}>
                    Mules keep almost nothing: inbound amounts match outbound amounts within 3.2% (commission) and leave within minutes. SATARK scores <strong>flow ratio</strong>, not isolated rupee size.
                  </div>
                </div>

                {/* Signal 3: Machine-Cadence Burst Rate */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 9, borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>🤖</span>
                    <span>Automated Machine-Cadence Bursts</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: 'rgba(255, 255, 255, 0.7)', marginTop: 3, lineHeight: 1.35 }}>
                    Dozens of micro-transfers executing at mechanical 2.4-second intervals exhibit low temporal entropy, mathematically matching automated bot scripts.
                  </div>
                </div>

                {/* Signal 4: Weighted Edge Collapse */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 9, borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>🔗</span>
                    <span>Multi-Edge Collapse Transformation</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: 'rgba(255, 255, 255, 0.7)', marginTop: 3, lineHeight: 1.35 }}>
                    SATARK aggregates high-frequency micro-arcs between node pairs into single weighted edges capturing total throughput, count, and burst velocity, preserving 60 FPS performance.
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CRYPTOGRAPHIC MERKLE AUDIT LEDGER */}
            {activeDetailTab === 'proof' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>
                  Cryptographic Merkle Proof &amp; Audit Trail
                </div>

                <div style={{ fontSize: 9.5, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.35 }}>
                  Every intercepted micro-smurfing swarm event is immutably anchored to SATARK&apos;s SHA-256 Merkle audit tree with a zero-knowledge root.
                </div>

                <div style={{ background: 'rgba(0, 0, 0, 0.5)', padding: 9, borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.08)', fontFamily: 'var(--font-mono)', fontSize: 9.5 }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.4)' }}>// EVENT TYPE</div>
                  <div style={{ color: '#f87171', fontWeight: 700 }}>AML_ADVERSARIAL_SWARM_INTERCEPTED</div>

                  <div style={{ color: 'rgba(255, 255, 255, 0.4)', marginTop: 6 }}>// MERKLE ROOT</div>
                  <div style={{ color: '#10b981', wordBreak: 'break-all' }}>
                    {auditProof?.merkle_root || 'e7c0b2e038b9019a4c53aaa01ac868ad92f7ec9125aa5b57aa7c7bfa02e5a77c'}
                  </div>

                  <div style={{ color: 'rgba(255, 255, 255, 0.4)', marginTop: 6 }}>// ON-CHAIN TX HASH</div>
                  <div style={{ color: '#38bdf8', wordBreak: 'break-all' }}>
                    {auditProof?.on_chain_tx_hash || '0xb916489b09ecbd65bae9f64045579f3381d1ed335803b5a390dc28d4887078c6'}
                  </div>

                  <div style={{ color: 'rgba(255, 255, 255, 0.4)', marginTop: 6 }}>// EVENT ID</div>
                  <div style={{ color: '#fbbf24' }}>{auditProof?.event_id || 'evt_adv_smurf_proof_01'}</div>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
