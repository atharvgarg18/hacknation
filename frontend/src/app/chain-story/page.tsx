'use client';

/**
 * Chain Story — /chain-story
 * 
 * Cinematic 3D animated walkthrough of how a cross-bank money laundering chain forms.
 * Rebuilt using the exact node, particle, and curvature styling from the Command Center dashboard.
 * 
 * Features:
 * - Exact dashboard aesthetic: luminous spheres with centered bank badges (AX, IC, HD, SB),
 *   soft outer glow shells, thin horizontal torus rings, and organic curved flight-path arcs.
 * - Glowing white photons (particles) traveling along curved links just like the main screen.
 * - Continuous 60fps timeline animation engine (scrubbable 0.0s – 26.0s).
 * - Dynamic Director's Camera tracking the money flow hop-by-hop.
 * - Continuous RGB threat color interpolation (Cyan ➔ Amber ➔ Orange ➔ Pulsing Crimson).
 * - Zero Obstruction: Sleek lower-third documentary caption bar and top telemetry HUD.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D from '@/components/graph/ForceGraph3DWrapper';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import { BANK_CONFIGS, BankId } from '@/lib/types';

let THREE: typeof import('three') | null = null;
let SpriteText: typeof import('three-spritetext').default | null = null;

// ============================================
// Visual constants (Exact match with NetworkGraph.tsx)
// ============================================

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

const BG_COLOR = '#06070b';
const TOTAL_DURATION = 26.0;

// Threat color interpolation function
function interpolateThreatColor(score: number): { hex: number; rgb: string; status: string } {
  let r = 6, g = 182, b = 212;
  let status = 'MONITORING // BENIGN';

  if (score <= 30) {
    const t = Math.max(0, score / 30);
    r = Math.round(6 + t * (6 - 6));
    g = Math.round(182 + t * (210 - 182));
    b = Math.round(212 + t * (238 - 212));
    status = 'MONITORING // BENIGN';
  } else if (score <= 60) {
    const t = (score - 30) / 30;
    r = Math.round(6 + t * (245 - 6));
    g = Math.round(182 + t * (158 - 182));
    b = Math.round(212 + t * (11 - 212));
    status = 'ELEVATED // SUSPICIOUS';
  } else if (score <= 80) {
    const t = (score - 60) / 20;
    r = Math.round(245 + t * (249 - 245));
    g = Math.round(158 + t * (115 - 158));
    b = Math.round(11 + t * (22 - 11));
    status = 'HIGH RISK // ANOMALOUS';
  } else {
    const t = Math.min(1, (score - 80) / 20);
    r = Math.round(249 + t * (244 - 249));
    g = Math.round(115 + t * (63 - 115));
    b = Math.round(22 + t * (94 - 22));
    status = 'CRITICAL // LAUNDERING DETECTED';
  }

  const hex = (r << 16) | (g << 8) | b;
  const rgb = `rgb(${r}, ${g}, ${b})`;
  return { hex, rgb, status };
}

// Ease function for smooth camera dollies
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ============================================
// Cinematic Timeline Chapters (26s Total)
// ============================================

interface Chapter {
  id: string;
  startTime: number;
  endTime: number;
  phaseLabel: string;
  threatStart: number;
  threatEnd: number;
  title: string;
  narrative: string;
  isolatedBlindspot: string;
  enclaveReality: string;
  sourceTarget: string;
  amount: string;
  activeNodes: string[];
  activeLinks: string[];
  camStart: { x: number; y: number; z: number; lx: number; ly: number; lz: number };
  camEnd: { x: number; y: number; z: number; lx: number; ly: number; lz: number };
}

const CHAPTERS: Chapter[] = [
  {
    id: 'ch-0',
    startTime: 0.0,
    endTime: 3.5,
    phaseLabel: 'BASELINE TRAFFIC',
    threatStart: 12,
    threatEnd: 16,
    title: 'Normal Cross-Bank Banking Activity',
    narrative:
      'Thousands of legitimate peer-to-peer UPI, IMPS, and RTGS payments circulate across Axis, ICICI, HDFC, and SBI. Independent bank firewalls see only benign statistical noise.',
    isolatedBlindspot: 'Each bank monitors only its own accounts; zero systemic alerts triggered.',
    enclaveReality: 'Privacy Enclave computes cross-bank token bloom filters at baseline entropy.',
    sourceTarget: 'All Banks // Continuous UPI Mesh',
    amount: '₹1.84 Cr / min nominal',
    activeNodes: [],
    activeLinks: [],
    camStart: { x: 0, y: 60, z: 480, lx: 0, ly: 0, lz: 0 },
    camEnd: { x: -40, y: 50, z: 420, lx: -30, ly: 0, lz: 0 },
  },
  {
    id: 'ch-1',
    startTime: 3.5,
    endTime: 8.0,
    phaseLabel: 'PHASE 01 // PLACEMENT INGRESS',
    threatStart: 16,
    threatEnd: 38,
    title: 'Anomalous Inflow at Axis Bank',
    narrative:
      'A dormant corporate account at Axis Bank suddenly receives a lump-sum deposit of ₹18,50,000 via high-priority RTGS from an unrated offshore source.',
    isolatedBlindspot: 'Axis sees a standard inward RTGS. Account KYC is verified; no law is broken yet.',
    enclaveReality: 'Enclave registers hash token ax-9402. High-velocity counter arms (+22 pts).',
    sourceTarget: 'Offshore Gateway ➔ Axis [Token: ax-9402]',
    amount: '₹18,50,000 (Lump Sum)',
    activeNodes: ['c-axis-ingress'],
    activeLinks: [],
    camStart: { x: -40, y: 50, z: 420, lx: -30, ly: 0, lz: 0 },
    camEnd: { x: -160, y: 35, z: 270, lx: -150, ly: 0, lz: 0 },
  },
  {
    id: 'ch-2',
    startTime: 8.0,
    endTime: 13.0,
    phaseLabel: 'PHASE 02 // FAN-OUT SMURFING',
    threatStart: 38,
    threatEnd: 62,
    title: 'Cross-Bank Structuring Split',
    narrative:
      'Within 180 seconds, the ₹18.5L is divided into 4 sub-threshold payments (~₹4.6L each) dispatched to ICICI and HDFC to evade the mandatory ₹5L single-bank reporting ceiling.',
    isolatedBlindspot: 'Axis sees 4 normal outflows. ICICI and HDFC each receive ~₹4.6L without context.',
    enclaveReality: 'Topological 1:4 fan-out detected across 2 institutional boundaries in <3 min.',
    sourceTarget: 'Axis [ax-9402] ➔ ICICI (2) & HDFC (2)',
    amount: '4 × ₹4,62,500 (<₹5L Structuring)',
    activeNodes: ['c-axis-ingress', 'c-icici-smurf-1', 'c-icici-smurf-2', 'c-hdfc-smurf-1', 'c-hdfc-smurf-2'],
    activeLinks: ['e-smurf-1', 'e-smurf-2', 'e-smurf-3', 'e-smurf-4'],
    camStart: { x: -160, y: 35, z: 270, lx: -150, ly: 0, lz: 0 },
    camEnd: { x: -85, y: 40, z: 290, lx: -80, ly: 0, lz: 0 },
  },
  {
    id: 'ch-3',
    startTime: 13.0,
    endTime: 17.5,
    phaseLabel: 'PHASE 03 // LATERAL HOPPING',
    threatStart: 62,
    threatEnd: 79,
    title: 'Rapid Inter-Bank Multi-Hop Layering',
    narrative:
      'The funds dwell in the mule accounts for less than 90 seconds before being rapidly bounced again across ICICI and SBI intermediaries to sever the forensic trail.',
    isolatedBlindspot: 'Intermediate banks see ordinary pass-through velocity within intraday tolerance.',
    enclaveReality: 'Multi-hop chain depth reaches 3 hops. Dwell time <90s confirms automated proxy hops.',
    sourceTarget: 'ICICI / HDFC Layer ➔ ICICI & SBI Intermediaries',
    amount: '₹18,10,000 net velocity',
    activeNodes: [
      'c-axis-ingress',
      'c-icici-smurf-1',
      'c-icici-smurf-2',
      'c-hdfc-smurf-1',
      'c-hdfc-smurf-2',
      'c-icici-hop-1',
      'c-sbi-hop-1',
    ],
    activeLinks: ['e-smurf-1', 'e-smurf-2', 'e-smurf-3', 'e-smurf-4', 'e-hop-1', 'e-hop-2', 'e-hop-3', 'e-hop-4'],
    camStart: { x: -85, y: 40, z: 290, lx: -80, ly: 0, lz: 0 },
    camEnd: { x: 15, y: 35, z: 270, lx: 10, ly: 0, lz: 0 },
  },
  {
    id: 'ch-4',
    startTime: 17.5,
    endTime: 21.5,
    phaseLabel: 'PHASE 04 // RECONSOLIDATION',
    threatStart: 79,
    threatEnd: 91,
    title: 'Fan-In Merge at SBI Aggregator Account',
    narrative:
      'The dispersed money streams converge into a single aggregator account at State Bank of India. ₹17,90,000 has been reunited with 96.8% conservation.',
    isolatedBlindspot: 'SBI sees multiple inward transfers from distinct accounts. Looks like merchant sales.',
    enclaveReality: 'Diamond topology closed! Volume conservation = 96.8%. Coincidence probability <0.0001%.',
    sourceTarget: 'Intermediaries ➔ SBI Aggregator [Token: sb-9901]',
    amount: '₹17,90,000 Reconverged',
    activeNodes: [
      'c-axis-ingress',
      'c-icici-smurf-1',
      'c-icici-smurf-2',
      'c-hdfc-smurf-1',
      'c-hdfc-smurf-2',
      'c-icici-hop-1',
      'c-sbi-hop-1',
      'c-sbi-aggregator',
    ],
    activeLinks: [
      'e-smurf-1',
      'e-smurf-2',
      'e-smurf-3',
      'e-smurf-4',
      'e-hop-1',
      'e-hop-2',
      'e-hop-3',
      'e-hop-4',
      'e-agg-1',
      'e-agg-2',
    ],
    camStart: { x: 15, y: 35, z: 270, lx: 10, ly: 0, lz: 0 },
    camEnd: { x: 95, y: 30, z: 260, lx: 95, ly: 0, lz: 0 },
  },
  {
    id: 'ch-5',
    startTime: 21.5,
    endTime: 24.5,
    phaseLabel: 'PHASE 05 // TERMINAL CASHOUT',
    threatStart: 91,
    threatEnd: 97,
    title: 'Imminent Liquidation via Mule Gateway',
    narrative:
      'The aggregator attempts an urgent RTGS transfer to an unverified crypto OTC gateway / high-risk merchant desk at Axis Bank to cash out before detection.',
    isolatedBlindspot: 'SBI logs a legitimate debit; Axis logs an incoming merchant payment.',
    enclaveReality: 'End-to-end chain completed across 4 banks in 11 minutes total cycle time.',
    sourceTarget: 'SBI Aggregator ➔ Axis Mule Gateway [Token: ax-mule]',
    amount: '₹17,85,000 Instant Outflow',
    activeNodes: [
      'c-axis-ingress',
      'c-icici-smurf-1',
      'c-icici-smurf-2',
      'c-hdfc-smurf-1',
      'c-hdfc-smurf-2',
      'c-icici-hop-1',
      'c-sbi-hop-1',
      'c-sbi-aggregator',
      'c-axis-cashout',
    ],
    activeLinks: [
      'e-smurf-1',
      'e-smurf-2',
      'e-smurf-3',
      'e-smurf-4',
      'e-hop-1',
      'e-hop-2',
      'e-hop-3',
      'e-hop-4',
      'e-agg-1',
      'e-agg-2',
      'e-cashout',
    ],
    camStart: { x: 95, y: 30, z: 260, lx: 95, ly: 0, lz: 0 },
    camEnd: { x: 165, y: 25, z: 260, lx: 155, ly: 0, lz: 0 },
  },
  {
    id: 'ch-6',
    startTime: 24.5,
    endTime: TOTAL_DURATION,
    phaseLabel: 'PHASE 06 // ENCLAVE LOCK',
    threatStart: 97,
    threatEnd: 99,
    title: 'Autonomous Multi-Bank Interdiction',
    narrative:
      'False Set Enclave dispatches an automated freeze order to all 4 banking cores simultaneously in 4.2 seconds. The ₹17.85L is safeguarded before withdrawal without leaking any customer PII.',
    isolatedBlindspot: 'No manual phone calls or inter-bank delays needed. Coordinated freeze executed.',
    enclaveReality: 'Zero-Knowledge Proof verified across 4 banks: 100% privacy, full forensic proof.',
    sourceTarget: 'Cryptographic Enclave ➔ All 4 Banking Cores',
    amount: '₹17,85,000 SAFELY FROZEN',
    activeNodes: [
      'c-axis-ingress',
      'c-icici-smurf-1',
      'c-icici-smurf-2',
      'c-hdfc-smurf-1',
      'c-hdfc-smurf-2',
      'c-icici-hop-1',
      'c-sbi-hop-1',
      'c-sbi-aggregator',
      'c-axis-cashout',
    ],
    activeLinks: [
      'e-smurf-1',
      'e-smurf-2',
      'e-smurf-3',
      'e-smurf-4',
      'e-hop-1',
      'e-hop-2',
      'e-hop-3',
      'e-hop-4',
      'e-agg-1',
      'e-agg-2',
      'e-cashout',
    ],
    camStart: { x: 165, y: 25, z: 260, lx: 155, ly: 0, lz: 0 },
    camEnd: { x: 20, y: 75, z: 420, lx: 15, ly: 0, lz: 0 },
  },
];

// ============================================
// Graph Data Structure
// ============================================

interface GraphNodeItem {
  id: string;
  bank: BankId;
  label: string;
  isChain: boolean;
  totalIn: number;
  totalOut: number;
  riskScore: number;
  fx?: number;
  fy?: number;
  fz?: number;
}

interface GraphLinkItem {
  id: string;
  source: string;
  target: string;
  isChain: boolean;
  sourceBank: BankId;
  targetBank: BankId;
}

export default function ChainStoryPage() {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 750 });
  const [threeLoaded, setThreeLoaded] = useState(false);

  // Playback & Timeline states
  const [currentTime, setCurrentTime] = useState(0.0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);
  const [cameraMode, setCameraMode] = useState<'director' | 'free'>('director');

  // Animation loop refs
  const lastTimeRef = useRef<number>(performance.now());
  const currentTimeRef = useRef(0.0);
  const isPlayingRef = useRef(true);
  const playbackSpeedRef = useRef(1);
  const cameraModeRef = useRef<'director' | 'free'>('director');

  currentTimeRef.current = currentTime;
  isPlayingRef.current = isPlaying;
  playbackSpeedRef.current = playbackSpeed;
  cameraModeRef.current = cameraMode;

  // Window resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Dynamic Three.js loader
  useEffect(() => {
    Promise.all([import('three'), import('three-spritetext')]).then(([t, s]) => {
      THREE = t;
      SpriteText = s.default;
      setThreeLoaded(true);
    });
  }, []);

  // Initialize scene lighting matching NetworkGraph.tsx
  useEffect(() => {
    if (!graphRef.current || !threeLoaded || !THREE) return;
    const scene = graphRef.current.scene();
    const renderer = graphRef.current.renderer();

    if (renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.4;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    if (scene) {
      scene.background = new THREE.Color(BG_COLOR);
      scene.fog = new THREE.FogExp2(BG_COLOR, 0.0005);

      // Ambient
      const amb = new THREE.AmbientLight(0x1a1a2e, 1.2);
      scene.add(amb);

      // Key light — teal from top-right
      const key = new THREE.PointLight(0x00ffcc, 2.0, 1200);
      key.position.set(300, 250, 300);
      scene.add(key);

      // Fill — warm coral from left
      const fill = new THREE.PointLight(0xff6644, 1.2, 900);
      fill.position.set(-300, -50, -200);
      scene.add(fill);

      // Rim — blue from below
      const rim = new THREE.PointLight(0x4488ff, 1.0, 800);
      rim.position.set(0, -200, 100);
      scene.add(rim);

      // Top accent
      const top = new THREE.PointLight(0xffffff, 0.6, 600);
      top.position.set(0, 400, 0);
      scene.add(top);
    }
  }, [threeLoaded]);

  // Current chapter & progress
  const currentChapter = useMemo(() => {
    for (const ch of CHAPTERS) {
      if (currentTime >= ch.startTime && currentTime <= ch.endTime) return ch;
    }
    return CHAPTERS[CHAPTERS.length - 1];
  }, [currentTime]);

  const chapterProgress = useMemo(() => {
    const duration = currentChapter.endTime - currentChapter.startTime;
    if (duration <= 0) return 0;
    return Math.min(1, Math.max(0, (currentTime - currentChapter.startTime) / duration));
  }, [currentTime, currentChapter]);

  // Smoothly interpolated threat score & color
  const interpolatedScore = useMemo(() => {
    const ease = easeInOutCubic(chapterProgress);
    const score = Math.round(
      currentChapter.threatStart + (currentChapter.threatEnd - currentChapter.threatStart) * ease
    );
    return Math.min(99, Math.max(12, score));
  }, [currentChapter, chapterProgress]);

  const threatColor = useMemo(() => {
    return interpolateThreatColor(interpolatedScore);
  }, [interpolatedScore]);

  // Master Graph nodes and links: 160+ background nodes for that classy dashboard neural matrix look
  const { masterNodes, masterLinks } = useMemo(() => {
    const banks: BankId[] = ['axis', 'icici', 'hdfc', 'sbi'];
    const nodes: GraphNodeItem[] = [];
    const links: GraphLinkItem[] = [];

    // 1. Fixed Chain Nodes in clear flowing diamond topology
    const chainNodesConfig: GraphNodeItem[] = [
      { id: 'c-axis-ingress', bank: 'axis', label: 'AX', isChain: true, totalIn: 0, totalOut: 1850000, riskScore: 85, fx: -160, fy: 0, fz: 0 },
      { id: 'c-icici-smurf-1', bank: 'icici', label: 'IC', isChain: true, totalIn: 462500, totalOut: 462500, riskScore: 72, fx: -75, fy: 48, fz: 35 },
      { id: 'c-icici-smurf-2', bank: 'icici', label: 'IC', isChain: true, totalIn: 462500, totalOut: 462500, riskScore: 72, fx: -75, fy: 16, fz: -35 },
      { id: 'c-hdfc-smurf-1', bank: 'hdfc', label: 'HD', isChain: true, totalIn: 462500, totalOut: 462500, riskScore: 70, fx: -75, fy: -16, fz: 35 },
      { id: 'c-hdfc-smurf-2', bank: 'hdfc', label: 'HD', isChain: true, totalIn: 462500, totalOut: 462500, riskScore: 70, fx: -75, fy: -48, fz: -35 },
      { id: 'c-icici-hop-1', bank: 'icici', label: 'IC', isChain: true, totalIn: 925000, totalOut: 925000, riskScore: 76, fx: 15, fy: 32, fz: -20 },
      { id: 'c-sbi-hop-1', bank: 'sbi', label: 'SB', isChain: true, totalIn: 925000, totalOut: 925000, riskScore: 75, fx: 15, fy: -32, fz: 20 },
      { id: 'c-sbi-aggregator', bank: 'sbi', label: 'SB', isChain: true, totalIn: 1790000, totalOut: 1790000, riskScore: 92, fx: 105, fy: 0, fz: 0 },
      { id: 'c-axis-cashout', bank: 'axis', label: 'AX', isChain: true, totalIn: 1785000, totalOut: 0, riskScore: 96, fx: 195, fy: 0, fz: 0 },
    ];
    nodes.push(...chainNodesConfig);

    // 2. Fixed Chain Edges
    const chainLinksConfig: GraphLinkItem[] = [
      { id: 'e-smurf-1', source: 'c-axis-ingress', target: 'c-icici-smurf-1', isChain: true, sourceBank: 'axis', targetBank: 'icici' },
      { id: 'e-smurf-2', source: 'c-axis-ingress', target: 'c-icici-smurf-2', isChain: true, sourceBank: 'axis', targetBank: 'icici' },
      { id: 'e-smurf-3', source: 'c-axis-ingress', target: 'c-hdfc-smurf-1', isChain: true, sourceBank: 'axis', targetBank: 'hdfc' },
      { id: 'e-smurf-4', source: 'c-axis-ingress', target: 'c-hdfc-smurf-2', isChain: true, sourceBank: 'axis', targetBank: 'hdfc' },
      { id: 'e-hop-1', source: 'c-icici-smurf-1', target: 'c-icici-hop-1', isChain: true, sourceBank: 'icici', targetBank: 'icici' },
      { id: 'e-hop-2', source: 'c-icici-smurf-2', target: 'c-icici-hop-1', isChain: true, sourceBank: 'icici', targetBank: 'icici' },
      { id: 'e-hop-3', source: 'c-hdfc-smurf-1', target: 'c-sbi-hop-1', isChain: true, sourceBank: 'hdfc', targetBank: 'sbi' },
      { id: 'e-hop-4', source: 'c-hdfc-smurf-2', target: 'c-sbi-hop-1', isChain: true, sourceBank: 'hdfc', targetBank: 'sbi' },
      { id: 'e-agg-1', source: 'c-icici-hop-1', target: 'c-sbi-aggregator', isChain: true, sourceBank: 'icici', targetBank: 'sbi' },
      { id: 'e-agg-2', source: 'c-sbi-hop-1', target: 'c-sbi-aggregator', isChain: true, sourceBank: 'sbi', targetBank: 'sbi' },
      { id: 'e-cashout', source: 'c-sbi-aggregator', target: 'c-axis-cashout', isChain: true, sourceBank: 'sbi', targetBank: 'axis' },
    ];
    links.push(...chainLinksConfig);

    // 3. Classy Ambient Background Nodes (160 nodes across all 4 banks)
    for (let i = 0; i < 160; i++) {
      const bank = banks[i % banks.length];
      const theta = (i / 160) * Math.PI * 2 * 3;
      const radius = 90 + ((i * 17) % 180);
      const ySpread = ((i % 19) - 9) * 18;
      const zSpread = ((i % 13) - 6) * 28;

      nodes.push({
        id: `noise-${i}`,
        bank,
        label: BANK_CONFIGS[bank].shortName,
        isChain: false,
        totalIn: Math.floor(Math.random() * 400000),
        totalOut: Math.floor(Math.random() * 400000),
        riskScore: Math.floor(Math.random() * 25),
        fx: Math.cos(theta) * radius + (Math.sin(i * 3) * 20),
        fy: ySpread,
        fz: Math.sin(theta) * radius * 0.7 + zSpread,
      });
    }

    // 4. Ambient Background Links (240 connections)
    for (let i = 0; i < 240; i++) {
      const sIdx = 9 + (i * 3) % 160;
      const tIdx = 9 + (i * 7 + 11) % 160;
      if (sIdx !== tIdx && nodes[sIdx] && nodes[tIdx]) {
        links.push({
          id: `noise-edge-${i}`,
          source: nodes[sIdx].id,
          target: nodes[tIdx].id,
          isChain: false,
          sourceBank: nodes[sIdx].bank,
          targetBank: nodes[tIdx].bank,
        });
      }
    }

    return { masterNodes: nodes, masterLinks: links };
  }, []);

  // Filter visible nodes and links based on current chapter
  const visibleGraphData = useMemo(() => {
    const activeNodes = masterNodes.filter((n) => {
      if (!n.isChain) return true; // Background noise always visible
      return currentChapter.activeNodes.includes(n.id);
    });

    const activeLinks = masterLinks.filter((l) => {
      if (!l.isChain) return true; // Ambient noise always visible
      return currentChapter.activeLinks.includes(l.id);
    });

    return {
      nodes: activeNodes.map((n) => ({ ...n })),
      links: activeLinks.map((l) => ({ ...l })),
    };
  }, [masterNodes, masterLinks, currentChapter.activeNodes, currentChapter.activeLinks]);

  // Main 60fps Animation Loop: drives timeline & Director's Camera
  useEffect(() => {
    let animId: number;

    const tick = (now: number) => {
      const deltaSec = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      if (isPlayingRef.current) {
        let nextTime = currentTimeRef.current + deltaSec * playbackSpeedRef.current;
        if (nextTime > TOTAL_DURATION) {
          nextTime = 0.0; // Loop back seamlessly
        }
        currentTimeRef.current = nextTime;
        setCurrentTime(nextTime);
      }

      // Smooth Director's Camera interpolation
      if (cameraModeRef.current === 'director' && graphRef.current) {
        let ch = CHAPTERS[0];
        for (const c of CHAPTERS) {
          if (currentTimeRef.current >= c.startTime && currentTimeRef.current <= c.endTime) {
            ch = c;
            break;
          }
        }
        const span = ch.endTime - ch.startTime;
        const progress = span > 0 ? Math.min(1, Math.max(0, (currentTimeRef.current - ch.startTime) / span)) : 0;
        const ease = easeInOutCubic(progress);

        const cx = ch.camStart.x + (ch.camEnd.x - ch.camStart.x) * ease;
        const cy = ch.camStart.y + (ch.camEnd.y - ch.camStart.y) * ease;
        const cz = ch.camStart.z + (ch.camEnd.z - ch.camStart.z) * ease;

        const lx = ch.camStart.lx + (ch.camEnd.lx - ch.camStart.lx) * ease;
        const ly = ch.camStart.ly + (ch.camEnd.ly - ch.camStart.ly) * ease;
        const lz = ch.camStart.lz + (ch.camEnd.lz - ch.camStart.lz) * ease;

        graphRef.current.cameraPosition({ x: cx, y: cy, z: cz }, { x: lx, y: ly, z: lz }, 0);
      }

      animId = requestAnimationFrame(tick);
    };

    lastTimeRef.current = performance.now();
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // ============================================
  // NODE RENDERING — Exact match with NetworkGraph.tsx
  // ============================================

  const nodeThreeObject = useCallback(
    (node: any) => {
      if (!THREE || !SpriteText) return new (THREE as any).Object3D();
      const n = node as GraphNodeItem;
      const flagged = n.isChain;
      const bankCol = BANK_NODE_COLORS[n.bank] || 0x2a2a3a;
      const bankGl = BANK_GLOW[n.bank] || 0xffffff;

      const group = new THREE.Group();
      // Exact dashboard sizing: 5 for flagged, 2.5 for normal
      const sz = flagged ? 5.2 : 2.5;

      // When flagged in chain, color is mapped to the current threat score!
      const activeColor = flagged ? threatColor.hex : bankCol;
      const activeGlow = flagged ? threatColor.hex : bankGl;

      // === Core sphere ===
      const geo = new THREE.SphereGeometry(sz, 24, 24);
      const mat = new THREE.MeshStandardMaterial({
        color: activeColor,
        emissive: new THREE.Color(activeColor),
        emissiveIntensity: flagged ? 3.0 : 0.6,
        roughness: 0.25,
        metalness: 0.8,
        transparent: false,
        opacity: 1.0,
        toneMapped: false,
      });
      group.add(new THREE.Mesh(geo, mat));

      // === Bank label (centered right inside the sphere) ===
      const lbl = new SpriteText(
        BANK_CONFIGS[n.bank]?.shortName || '?',
        sz * 0.65,
        '#ffffff'
      );
      lbl.fontWeight = '800';
      lbl.fontSize = 90;
      lbl.material.depthTest = false;
      lbl.material.transparent = true;
      lbl.material.opacity = 1.0;
      lbl.renderOrder = 10;
      group.add(lbl);

      return group;
    },
    [threatColor.hex]
  );

  // ============================================
  // EDGE STYLING — Exact match with NetworkGraph.tsx
  // ============================================

  const linkColor = useCallback(
    (link: any) => {
      const e = link as GraphLinkItem;
      if (e.isChain) {
        // High visibility dynamic threat color!
        return threatColor.rgb;
      }
      // Exact dashboard edge colors by source bank
      const colors: Record<string, string> = {
        axis: 'rgba(151,20,77,0.18)',
        icici: 'rgba(243,112,33,0.18)',
        hdfc: 'rgba(0,76,143,0.18)',
        sbi: 'rgba(57,73,171,0.18)',
      };
      return colors[e.sourceBank] || 'rgba(50,50,80,0.12)';
    },
    [threatColor.rgb]
  );

  const linkWidth = useCallback(
    (link: any) => {
      const e = link as GraphLinkItem;
      return e.isChain ? 3.0 : 0.4;
    },
    []
  );

  const linkParticles = useCallback(
    (link: any) => {
      const e = link as GraphLinkItem;
      if (e.isChain) return 5;
      return Math.random() > 0.92 ? 1 : 0;
    },
    []
  );

  const linkParticleWidth = useCallback(
    (link: any) => {
      const e = link as GraphLinkItem;
      return e.isChain ? 3.0 : 1.0;
    },
    []
  );

  const linkParticleColor = useCallback(
    (link: any) => {
      const e = link as GraphLinkItem;
      if (e.isChain) return '#ffffff'; // Classy white-hot photons
      const colors: Record<string, string> = {
        axis: '#c91e5e',
        icici: '#f37021',
        hdfc: '#2288dd',
        sbi: '#3949ab',
      };
      return colors[e.sourceBank] || '#555';
    },
    []
  );

  // Tooltip matching the dashboard
  const nodeLabel = useCallback((node: any) => {
    const n = node as GraphNodeItem;
    const bank = BANK_CONFIGS[n.bank]?.name || n.bank;
    const riskColor = n.riskScore > 70 ? '#ff3366' : n.riskScore > 40 ? '#ffaa00' : '#00ddff';
    return `<div style="
      background: rgba(10,10,20,0.92);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 10px 14px;
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      min-width: 160px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    ">
      <div style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #00ffcc; margin-bottom: 6px; font-size: 13px;">${n.id}</div>
      <div style="display:flex; justify-content:space-between; color:#888; margin:3px 0"><span>Bank</span><span style="color:#eee; font-weight:600">${bank}</span></div>
      <div style="display:flex; justify-content:space-between; color:#888; margin:3px 0"><span>In</span><span style="color:#eee; font-weight:600">₹${(n.totalIn / 100000).toFixed(1)}L</span></div>
      <div style="display:flex; justify-content:space-between; color:#888; margin:3px 0"><span>Out</span><span style="color:#eee; font-weight:600">₹${(n.totalOut / 100000).toFixed(1)}L</span></div>
      <div style="display:flex; justify-content:space-between; color:#888; margin:3px 0"><span>Risk</span><span style="color:${riskColor}; font-weight:700">${n.riskScore}</span></div>
    </div>`;
  }, []);

  // Jump to chapter
  const handleJumpToChapter = (ch: Chapter) => {
    setCurrentTime(ch.startTime + 0.05);
    currentTimeRef.current = ch.startTime + 0.05;
  };

  // Scrub bar drag
  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    currentTimeRef.current = val;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-void)', overflow: 'hidden' }}>
      {/* Top Application Header */}
      <DashboardHeader />

      {/* Full-Screen 3D Theater Canvas */}
      <div style={{ position: 'relative', flex: 1, width: '100%', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', background: BG_COLOR }}>
          <ForceGraph3D
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={visibleGraphData}
            nodeThreeObject={nodeThreeObject}
            nodeThreeObjectExtend={false}
            nodeLabel={nodeLabel}
            linkColor={linkColor}
            linkWidth={linkWidth}
            linkOpacity={1.0}
            linkCurvature={0.16}
            linkDirectionalArrowLength={3.5}
            linkDirectionalArrowRelPos={0.8}
            linkDirectionalArrowColor={linkColor}
            linkDirectionalParticles={linkParticles}
            linkDirectionalParticleWidth={linkParticleWidth}
            linkDirectionalParticleColor={linkParticleColor}
            linkDirectionalParticleSpeed={0.008}
            d3AlphaDecay={0.015}
            d3VelocityDecay={0.25}
            warmupTicks={100}
            cooldownTicks={120}
            enableNodeDrag={false}
            showNavInfo={false}
            backgroundColor={BG_COLOR}
            enableNavigationControls={cameraMode === 'free'}
          />
        </div>

        {/* Aerospace Corner Reticles from Dashboard */}
        <div className="hud-corner hud-corner--top-left" />
        <div className="hud-corner hud-corner--top-right" />
        <div className="hud-corner hud-corner--bottom-left" />
        <div className="hud-corner hud-corner--bottom-right" />

        {/* TOP FLOATING HUD: Threat Telemetry & Phase Indicator */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 20,
            right: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 30,
            pointerEvents: 'none',
          }}
        >
          {/* Top Left: Radial SVG Threat Dial */}
          <div
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '8px 18px',
              borderRadius: 'var(--r-lg)',
              background: 'rgba(10, 12, 19, 0.82)',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${threatColor.rgb}`,
              boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${threatColor.rgb}40`,
              transition: 'border 0.3s ease, box-shadow 0.3s ease',
            }}
          >
            <div style={{ position: 'relative', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="22" cy="22" r="18" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" fill="none" />
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  stroke={threatColor.rgb}
                  strokeWidth="3.5"
                  strokeDasharray={113.1}
                  strokeDashoffset={113.1 - (113.1 * interpolatedScore) / 100}
                  strokeLinecap="round"
                  fill="none"
                  style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s ease' }}
                />
              </svg>
              <span
                style={{
                  position: 'absolute',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  fontWeight: 800,
                  color: threatColor.rgb,
                }}
              >
                {interpolatedScore}
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: `${threatColor.rgb}20`,
                    color: threatColor.rgb,
                    border: `1px solid ${threatColor.rgb}50`,
                  }}
                >
                  {threatColor.status}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  SCORE {interpolatedScore}/100
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', marginTop: 2 }}>
                {currentChapter.phaseLabel}
              </div>
            </div>
          </div>

          {/* Top Center: Timeline Chapter Pills */}
          <div
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 'var(--r-lg)',
              background: 'rgba(10, 12, 19, 0.82)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--border-light)',
            }}
          >
            {CHAPTERS.map((ch, idx) => {
              const isCurrent = currentChapter.id === ch.id;
              const isPassed = currentTime >= ch.endTime;
              return (
                <button
                  key={ch.id}
                  onClick={() => handleJumpToChapter(ch)}
                  title={ch.title}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: isCurrent ? `1px solid ${threatColor.rgb}` : '1px solid transparent',
                    background: isCurrent ? `${threatColor.rgb}25` : isPassed ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: isCurrent ? threatColor.rgb : isPassed ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                    fontSize: 11,
                    fontWeight: isCurrent ? 700 : 500,
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: isCurrent ? threatColor.rgb : isPassed ? 'var(--text-secondary)' : 'var(--text-muted)',
                    }}
                  />
                  {idx === 0 ? 'Baseline' : `0${idx}`}
                </button>
              );
            })}
          </div>

          {/* Top Right: Live Telemetry & Camera Mode */}
          <div
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 16px',
              borderRadius: 'var(--r-lg)',
              background: 'rgba(10, 12, 19, 0.82)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--border-light)',
            }}
          >
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
                ACTIVE VECTOR
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#ffffff' }}>
                {currentChapter.amount}
              </div>
            </div>

            <div style={{ height: 20, width: 1, background: 'var(--border-light)' }} />

            {/* Camera Mode Toggle */}
            <button
              onClick={() => setCameraMode(cameraMode === 'director' ? 'free' : 'director')}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                border: '1px solid var(--border-light)',
                background: cameraMode === 'director' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255,255,255,0.06)',
                color: cameraMode === 'director' ? '#06b6d4' : 'var(--text-secondary)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
              title={cameraMode === 'director' ? 'Director Mode: Auto cinematic dolly' : 'Free Orbit: Click & drag in 3D'}
            >
              {cameraMode === 'director' ? '🎬 Director Cam' : '🖐 Free Orbit'}
            </button>
          </div>
        </div>

        {/* BOTTOM DOCKED CINEMATIC SUBTITLE & PLAYBACK CONTROLLER */}
        <div
          style={{
            position: 'absolute',
            bottom: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(92%, 1020px)',
            zIndex: 40,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            pointerEvents: 'auto',
          }}
        >
          {/* Lower-Third Caption Card */}
          <div
            style={{
              padding: '16px 24px',
              borderRadius: 'var(--r-xl)',
              background: 'rgba(10, 12, 19, 0.85)',
              backdropFilter: 'blur(28px)',
              border: `1px solid ${threatColor.rgb}40`,
              boxShadow: `0 16px 48px rgba(0,0,0,0.7), 0 0 24px ${threatColor.rgb}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 24,
              transition: 'border 0.3s ease, box-shadow 0.3s ease',
            }}
          >
            {/* Left Narrative Text */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
                  {currentChapter.title}
                </span>
                <span style={{ fontSize: 11, color: threatColor.rgb, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  // {currentChapter.sourceTarget}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {currentChapter.narrative}
              </p>
            </div>

            {/* Right Comparison Capsule */}
            <div
              style={{
                width: 320,
                padding: '10px 14px',
                borderRadius: 'var(--r-md)',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                fontSize: 11,
                lineHeight: 1.45,
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                <span>🔒 Single Bank Blindspot:</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>
                {currentChapter.isolatedBlindspot}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: threatColor.rgb, fontWeight: 600 }}>
                <span>⚡ Enclave Reality:</span>
              </div>
              <div style={{ color: '#ffffff' }}>
                {currentChapter.enclaveReality}
              </div>
            </div>
          </div>

          {/* Cinematic Scrubber & Transport Player Bar */}
          <div
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--r-xl)',
              background: 'rgba(10, 12, 19, 0.88)',
              backdropFilter: 'blur(24px)',
              border: '1px solid var(--border-specular)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            {/* Play/Pause Button */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: isPlaying ? 'rgba(255,255,255,0.08)' : threatColor.rgb,
                border: `1px solid ${threatColor.rgb}`,
                color: isPlaying ? threatColor.rgb : '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 2 }}>
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>

            {/* Timecode */}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', minWidth: 80 }}>
              {currentTime.toFixed(1)}s / {TOTAL_DURATION.toFixed(1)}s
            </div>

            {/* Continuous Smooth Scrub Slider */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="range"
                min="0"
                max={TOTAL_DURATION}
                step="0.05"
                value={currentTime}
                onChange={handleScrub}
                style={{
                  width: '100%',
                  accentColor: threatColor.rgb,
                  cursor: 'pointer',
                  height: 4,
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 2,
                }}
              />
            </div>

            {/* Speed Multiplier */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {([1, 1.5, 2] as const).map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: 'none',
                    background: playbackSpeed === spd ? 'rgba(255,255,255,0.18)' : 'transparent',
                    color: playbackSpeed === spd ? '#fff' : 'var(--text-tertiary)',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                  }}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Replay */}
            <button
              onClick={() => {
                setCurrentTime(0.0);
                currentTimeRef.current = 0.0;
                setIsPlaying(true);
              }}
              className="btn btn--ghost"
              style={{ padding: '6px 10px', fontSize: 11 }}
              title="Restart from Beginning"
            >
              ↺ Replay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
