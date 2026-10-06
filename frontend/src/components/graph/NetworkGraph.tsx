/**
 * NetworkGraph — The centerpiece 3D graph visualization.
 * 
 * Rebuilt for maximum visual impact:
 * - Large, glowing nodes with bank brand colors
 * - Visible edges with animated directional particles
 * - Selective bloom post-processing
 * - Cinematic lighting and fog
 * - Smooth chain focus with isolation
 * - Detection shockwave animation
 */

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ForceGraph3D from './ForceGraph3DWrapper';
import { useGraphStore } from '@/store/graphStore';
import { BANK_CONFIGS } from '@/lib/types';
import type { GraphNode, GraphEdge } from '@/lib/types';

let THREE: typeof import('three') | null = null;
let SpriteText: typeof import('three-spritetext').default | null = null;

// ============================================
// Visual constants
// ============================================

const BANK_NODE_COLORS: Record<string, number> = {
  axis: 0xc91e5e,
  icici: 0xf97316,
  hdfc: 0x0284c7,
};

const BANK_GLOW: Record<string, number> = {
  axis: 0xff2d78,
  icici: 0xffaa00,
  hdfc: 0x00aaff,
};

const FLAGGED_COLOR = 0xf43f5e;
const FLAGGED_GLOW = 0xff0044;
const BG_COLOR = '#06070b';

export default function NetworkGraph() {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [threeLoaded, setThreeLoaded] = useState(false);
  const [isOrbiting, setIsOrbiting] = useState(true);
  const animFrameRef = useRef<number>(0);
  const rotAngle = useRef(0);
  const bloomComposerRef = useRef<any>(null);

  const {
    graphData,
    focusedChain,
    hoveredNodeId,
    setHoveredNode,
    setSelectedNode,
    showDetectionAnimation,
    detectionTimeMs,
    clearDetection,
  } = useGraphStore();

  const resetCamera = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.cameraPosition({ x: 0, y: 50, z: 550 }, { x: 0, y: 0, z: 0 }, 1000);
    }
  }, []);

  // Dynamic import Three.js + addons
  useEffect(() => {
    Promise.all([
      import('three'),
      import('three-spritetext'),
    ]).then(([t, s]) => {
      THREE = t;
      SpriteText = s.default;
      setThreeLoaded(true);
    });
  }, []);

  // Resize
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

  // === Auto-rotation (stops on focus or when paused) ===
  useEffect(() => {
    if (!graphRef.current || focusedChain || !isOrbiting) return;
    let stop = false;
    const tick = () => {
      if (stop || !graphRef.current) return;
      rotAngle.current += 0.05;
      const d = 550;
      const a = (rotAngle.current * Math.PI) / 180;
      graphRef.current.cameraPosition(
        { x: d * Math.sin(a), y: 50, z: d * Math.cos(a) },
        { x: 0, y: 0, z: 0 },
        0
      );
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => { stop = true; cancelAnimationFrame(animFrameRef.current); };
  }, [focusedChain, isOrbiting]);

  // === Camera fly-to on chain focus ===
  useEffect(() => {
    if (!graphRef.current || !focusedChain) return;
    
    // Small delay to let visibility filter apply first
    const timer = setTimeout(() => {
      if (!graphRef.current) return;
      const cNodes = graphData.nodes.filter(n => focusedChain.nodeIds.includes(n.id));
      if (!cNodes.length) return;
      let cx = 0, cy = 0, cz = 0, cnt = 0;
      cNodes.forEach(n => {
        if (n.x != null && n.y != null && n.z != null) {
          cx += n.x; cy += n.y; cz += n.z; cnt++;
        }
      });
      if (cnt > 0) {
        cx /= cnt; cy /= cnt; cz /= cnt;
        // Zoom in tight — 100 unit offset
        graphRef.current.cameraPosition(
          { x: cx + 100, y: cy + 50, z: cz + 100 },
          { x: cx, y: cy, z: cz },
          2000
        );
      }
    }, 200);
    
    return () => clearTimeout(timer);
  }, [focusedChain, graphData.nodes]);

  // === Scene setup: lighting, fog, renderer ===
  useEffect(() => {
    if (!graphRef.current || !threeLoaded || !THREE) return;
    const renderer = graphRef.current.renderer();
    if (renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.4;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    const scene = graphRef.current.scene();
    if (scene) {
      scene.background = new THREE.Color(BG_COLOR);
      scene.fog = new THREE.FogExp2(BG_COLOR, 0.0005);

      // Ambient
      scene.add(new THREE.AmbientLight(0x1a1a2e, 1.2));

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

  // ============================================
  // NODE RENDERING — the visual star
  // ============================================

  const nodeThreeObject = useCallback((node: any) => {
    if (!THREE || !SpriteText) return new (THREE as any).Object3D();
    const n = node as GraphNode;
    const flagged = n.isFlagged;
    const bankCol = BANK_NODE_COLORS[n.bank] || 0x2a2a3a;
    const bankGl = BANK_GLOW[n.bank] || 0xffffff;

    const group = new THREE.Group();
    const sz = flagged ? 5 : 2.5;

    // === Core sphere ===
    const geo = new THREE.SphereGeometry(sz, 24, 24);
    const mat = new THREE.MeshStandardMaterial({
      color: flagged ? FLAGGED_COLOR : bankCol,
      emissive: new THREE.Color(flagged ? FLAGGED_COLOR : bankCol),
      emissiveIntensity: flagged ? 3.0 : 0.5,
      roughness: 0.25,
      metalness: 0.8,
      transparent: true,
      opacity: flagged ? 1.0 : 0.85,
      toneMapped: false,
    });
    group.add(new THREE.Mesh(geo, mat));

    // === Outer glow shell for ALL nodes ===
    const glowGeo = new THREE.SphereGeometry(sz * (flagged ? 2.0 : 1.5), 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(flagged ? FLAGGED_GLOW : bankGl),
      transparent: true,
      opacity: flagged ? 0.18 : 0.06,
      toneMapped: false,
      depthWrite: false,
    });
    group.add(new THREE.Mesh(glowGeo, glowMat));

    // === Bank label ===
    const lbl = new SpriteText!(
      BANK_CONFIGS[n.bank]?.shortName || '?',
      sz * 0.65,
      '#ffffff'
    );
    lbl.fontWeight = '800';
    lbl.fontSize = 90;
    lbl.material.depthTest = false;
    lbl.material.transparent = true;
    lbl.material.opacity = flagged ? 1.0 : 0.8;
    lbl.renderOrder = 10;
    group.add(lbl);

    // === Pulsing ring for flagged ===
    if (flagged) {
      const ringGeo = new THREE.TorusGeometry(sz * 1.8, 0.3, 8, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff3366,
        transparent: true,
        opacity: 0.5,
        toneMapped: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }

    return group;
  }, []);

  // ============================================
  // EDGE STYLING
  // ============================================

  const linkColor = useCallback((link: any) => {
    const e = link as GraphEdge;
    const inChain = focusedChain?.edgeIds.includes(e.id);
    const dimmed = focusedChain && !inChain;
    if (dimmed) return 'rgba(20,20,35,0.03)';
    if (e.isFlagged && inChain) return '#ff4477';
    if (e.isFlagged) return 'rgba(255,51,102,0.7)';
    // Color edges by source bank
    const colors: Record<string, string> = {
      axis: 'rgba(151,20,77,0.18)',
      icici: 'rgba(243,112,33,0.18)',
      hdfc: 'rgba(0,76,143,0.18)',
    };
    return colors[e.sourceBank] || 'rgba(50,50,80,0.12)';
  }, [focusedChain]);

  const linkWidth = useCallback((link: any) => {
    const e = link as GraphEdge;
    const inChain = focusedChain?.edgeIds.includes(e.id);
    if (focusedChain && !inChain) return 0.1;
    if (e.isFlagged && inChain) return 3.0;
    if (e.isFlagged) return 2.0;
    return 0.4;
  }, [focusedChain]);

  const linkParticles = useCallback((link: any) => {
    const e = link as GraphEdge;
    if (e.isFlagged) return 5;
    // Normal edges get occasional particles
    return Math.random() > 0.92 ? 1 : 0;
  }, []);

  const linkParticleWidth = useCallback((link: any) => {
    const e = link as GraphEdge;
    if (e.isFlagged) return 3.0;
    return 1.0;
  }, []);

  const linkParticleColor = useCallback((link: any) => {
    const e = link as GraphEdge;
    if (e.isFlagged) return '#ffffff';
    const colors: Record<string, string> = {
      axis: '#c91e5e', icici: '#f37021', hdfc: '#2288dd'
    };
    return colors[e.sourceBank] || '#555';
  }, []);

  // ============================================
  // VISIBILITY — focus isolation
  // ============================================

  const nodeVis = useCallback((node: any) => {
    if (!focusedChain) return true;
    const n = node as GraphNode;
    return focusedChain.nodeIds.includes(n.id);
  }, [focusedChain]);

  const linkVis = useCallback((link: any) => {
    if (!focusedChain) return true;
    const e = link as GraphEdge;
    return focusedChain.edgeIds.includes(e.id);
  }, [focusedChain]);

  // ============================================
  // INTERACTIONS
  // ============================================

  const onHover = useCallback((node: any) => {
    setHoveredNode(node ? (node as GraphNode).id : null);
    if (containerRef.current) containerRef.current.style.cursor = node ? 'pointer' : 'default';
  }, [setHoveredNode]);

  const onClick = useCallback((node: any) => {
    const n = node as GraphNode;
    setSelectedNode(n.id);
    if (graphRef.current && n.x != null) {
      graphRef.current.cameraPosition(
        { x: (n.x || 0) + 100, y: (n.y || 0) + 50, z: (n.z || 0) + 100 },
        { x: n.x, y: n.y, z: n.z },
        1000
      );
    }
  }, [setSelectedNode]);

  // Tooltip
  const nodeLabel = useCallback((node: any) => {
    const n = node as GraphNode;
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

  // Graph data memo
  const gd = useMemo(() => ({
    nodes: graphData.nodes.map(n => ({ ...n })),
    links: graphData.links.map(l => ({ ...l })),
  }), [graphData]);

  if (!threeLoaded) {
    return (
      <div ref={containerRef} className="graph-container" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
      }}>
        <div className="loader-ring" />
        <span style={{ color: '#5a5a78', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.15em' }}>
          INITIALIZING NEURAL TOPOLOGY
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="graph-container">
      <ForceGraph3D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={gd}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        nodeLabel={nodeLabel}
        nodeVisibility={nodeVis}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkOpacity={1.0}
        linkVisibility={linkVis}
        linkDirectionalParticles={linkParticles}
        linkDirectionalParticleWidth={linkParticleWidth}
        linkDirectionalParticleColor={linkParticleColor}
        linkDirectionalParticleSpeed={0.008}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={0.8}
        linkDirectionalArrowColor={linkColor}
        linkCurvature={0.15}
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.25}
        warmupTicks={100}
        cooldownTicks={120}
        onNodeHover={onHover}
        onNodeClick={onClick}
        onBackgroundClick={() => setSelectedNode(null)}
        enableNodeDrag={true}
        enableNavigationControls={true}
        showNavInfo={false}
        backgroundColor={BG_COLOR}
      />

      {/* Aerospace Viewport Corner Reticles */}
      <div className="hud-corner hud-corner--top-left" />
      <div className="hud-corner hud-corner--top-right" />
      <div className="hud-corner hud-corner--bottom-left" />
      <div className="hud-corner hud-corner--bottom-right" />

      {/* Top-Left Telemetry Tag */}
      <div className="graph-hud--telemetry">
        <div className="hud-telemetry-tag">
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--emerald)',
              boxShadow: '0 0 6px var(--emerald)',
            }}
          />
          TOPOLOGY MATRIX // ZKP MESH
        </div>
        <div className="hud-telemetry-stats">
          {graphData.nodes.length} NODES · {graphData.links.length} EDGES
        </div>
      </div>

      {/* Top-Right Graph Viewport Controls */}
      <div className="graph-hud--controls">
        <button
          className="graph-ctrl-btn"
          onClick={() => setIsOrbiting((prev) => !prev)}
          title="Toggle camera orbital rotation"
        >
          {isOrbiting ? '⏸ Orbit' : '▶ Orbit'}
        </button>
        <button
          className="graph-ctrl-btn"
          onClick={resetCamera}
          title="Reset camera center view"
        >
          ⌖ Center
        </button>
      </div>

      {/* Apple Dynamic Island Style Alert Pill (Center-Top) */}
      {showDetectionAnimation && detectionTimeMs && (
        <div className="graph-hud--detection-island animate-scale-in">
          <div className="detection-island">
            <div className="detection-island__beacon" />
            <div className="detection-island__content">
              <span className="detection-island__tag">RING DETECTED</span>
              <span>·</span>
              <span>{(detectionTimeMs / 1000).toFixed(1)}s</span>
              <span>·</span>
              <span style={{ color: 'var(--text-secondary)' }}>₹15.0L across 3 Banks</span>
            </div>
            <Link href="/investigate?chain=0" className="detection-island__action">
              Investigate →
            </Link>
          </div>
        </div>
      )}

      {/* Chain Focus Bar (Bottom-Center) */}
      {focusedChain && (
        <div className="graph-hud--chain-focus animate-fade-in">
          <div className="chain-focus-pill">
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--crimson)',
                boxShadow: '0 0 6px var(--crimson)',
              }}
            />
            <span>
              Isolating <strong>Chain {focusedChain.chainId.split('-')[1]?.toUpperCase()}</strong>
              &nbsp;·&nbsp;{focusedChain.nodeIds.length} accounts&nbsp;·&nbsp;{focusedChain.edgeIds.length} transfers
            </span>
            <button
              onClick={clearDetection}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                padding: '0 4px',
                fontSize: 12,
              }}
              title="Clear chain focus"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
