/**
 * SATARK Graph Store — Zustand state management
 * Manages all graph data, alerts, simulation state, and UI interactions.
 */

import { create } from 'zustand';
import type {
  GraphNode,
  GraphEdge,
  GraphData,
  Alert,
  BankId,
  BankStats,
  SimulationConfig,
  AdversaryComparison,
} from '@/lib/types';
import { generateMockGraphData, generateLiveTransaction } from '@/lib/mockData';

// ============================================
// Store Types
// ============================================

interface FocusedChain {
  chainId: string;
  nodeIds: string[];
  edgeIds: string[];
}

interface GraphStore {
  // Data
  graphData: GraphData;
  alerts: Alert[];
  bankStats: BankStats[];

  // UI State
  focusedChain: FocusedChain | null;
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  selectedAlertId: string | null;
  is3DMode: boolean;
  showDetectionAnimation: boolean;
  detectionTimeMs: number | null;

  // Simulation
  simulationConfig: SimulationConfig;
  isSimulating: boolean;
  simulationInterval: ReturnType<typeof setInterval> | null;
  adversaryMode: boolean;
  adversaryComparison: AdversaryComparison | null;

  // Actions
  initializeGraph: () => void;
  addTransaction: (node: GraphNode | undefined, edge: GraphEdge) => void;
  setFocusedChain: (chain: FocusedChain | null) => void;
  setHoveredNode: (nodeId: string | null) => void;
  setSelectedNode: (nodeId: string | null) => void;
  selectAlert: (alertId: string | null) => void;
  toggle3DMode: () => void;
  triggerDetection: (chainId: string, timeMs: number) => void;
  clearDetection: () => void;
  startSimulation: () => void;
  stopSimulation: () => void;
  triggerAttack: (params?: {
    adversary_mode?: boolean;
    mules?: number;
    amount?: number;
    micro_amount?: number;
    collapsed_view?: boolean;
  }) => Promise<void>;
  setAdversaryMode: (enabled: boolean) => void;
  clearAdversaryComparison: () => void;
}

// ============================================
// Store Implementation
// ============================================

export const useGraphStore = create<GraphStore>((set, get) => ({
  // Initial data
  graphData: { nodes: [], links: [] },
  alerts: [],
  bankStats: [],

  // UI State
  focusedChain: null,
  hoveredNodeId: null,
  selectedNodeId: null,
  selectedAlertId: null,
  is3DMode: true,
  showDetectionAnimation: false,
  detectionTimeMs: null,

  // Simulation
  simulationConfig: {
    normalTrafficRate: 2,
    attackEnabled: false,
    attackPattern: 'fan-out-fan-in',
    attackHops: 5,
    attackBanks: ['axis', 'icici', 'hdfc', 'sbi'],
    attackAmount: 1500000,
    falsePositiveTest: false,
    speedMultiplier: 1,
  },
  isSimulating: false,
  simulationInterval: null,
  adversaryMode: false,
  adversaryComparison: null,

  setAdversaryMode: (enabled: boolean) => set({ adversaryMode: enabled }),
  clearAdversaryComparison: () => set({ adversaryComparison: null }),

  // Actions
  initializeGraph: () => {
    const { graphData, alerts, bankStats } = generateMockGraphData({
      backgroundNodeCount: 220,
      backgroundEdgeCount: 450,
      includeChain: true,
    });
    set({ graphData, alerts, bankStats });
  },

  addTransaction: (node, edge) => {
    set((state) => {
      const newNodes = node
        ? [...state.graphData.nodes, node]
        : state.graphData.nodes;
      const newLinks = [...state.graphData.links, edge];
      return {
        graphData: { nodes: newNodes, links: newLinks },
      };
    });
  },

  setFocusedChain: (chain) => {
    set({ focusedChain: chain });
  },

  setHoveredNode: (nodeId) => {
    set({ hoveredNodeId: nodeId });
  },

  setSelectedNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  selectAlert: (alertId) => {
    const state = get();
    if (!alertId) {
      set({ selectedAlertId: null, focusedChain: null });
      return;
    }

    const alert = state.alerts.find((a) => a.id === alertId);
    if (alert) {
      set({
        selectedAlertId: alertId,
        focusedChain: {
          chainId: alert.chainId,
          nodeIds: alert.chainNodeIds,
          edgeIds: alert.chainEdgeIds,
        },
      });
    }
  },

  toggle3DMode: () => {
    set((state) => ({ is3DMode: !state.is3DMode }));
  },

  triggerDetection: (chainId, timeMs) => {
    set({
      showDetectionAnimation: true,
      detectionTimeMs: timeMs,
    });

    // Auto-clear after 10 seconds
    setTimeout(() => {
      set({ showDetectionAnimation: false });
    }, 10000);
  },

  clearDetection: () => {
    set({
      showDetectionAnimation: false,
      detectionTimeMs: null,
      focusedChain: null,
      selectedAlertId: null,
      adversaryComparison: null,
    });
  },

  startSimulation: () => {
    const state = get();
    if (state.isSimulating) return;

    const interval = setInterval(() => {
      const currentState = get();
      const { node, edge } = generateLiveTransaction(
        currentState.graphData.nodes
      );
      currentState.addTransaction(node, edge);

      // Update bank stats
      const bankCounts: Record<BankId, number> = { axis: 0, icici: 0, hdfc: 0, sbi: 0 };
      const allEdges = [...currentState.graphData.links, edge];
      allEdges.forEach((e) => {
        bankCounts[e.sourceBank]++;
      });

      set((s) => ({
        bankStats: s.bankStats.map((bs) => ({
          ...bs,
          totalTransactions: bankCounts[bs.bank] || bs.totalTransactions,
        })),
      }));
    }, 1000 / state.simulationConfig.normalTrafficRate / state.simulationConfig.speedMultiplier);

    set({ isSimulating: true, simulationInterval: interval });
  },

  stopSimulation: () => {
    const state = get();
    if (state.simulationInterval) {
      clearInterval(state.simulationInterval);
    }
    set({ isSimulating: false, simulationInterval: null });
  },

  triggerAttack: async (params) => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const state = get();
    const isAdv = params?.adversary_mode !== undefined ? params.adversary_mode : state.adversaryMode;

    try {
      const res = await fetch('http://localhost:8001/api/attack/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: state.simulationConfig.attackPattern,
          hops: state.simulationConfig.attackHops,
          amount: params?.amount ?? state.simulationConfig.attackAmount,
          banks: state.simulationConfig.attackBanks,
          adversary_mode: isAdv,
          mules: params?.mules ?? (isAdv ? 32 : undefined),
          micro_amount: params?.micro_amount ?? 100,
          collapsed_view: params?.collapsed_view ?? true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.alert) {
          const currentNodes = get().graphData.nodes;
          const currentLinks = get().graphData.links;
          const incomingNodes = (data.graphData.nodes || []) as GraphNode[];
          const incomingLinks = (data.graphData.links || []) as GraphEdge[];

          if (data.comparison) {
            set({ adversaryComparison: data.comparison });
          } else {
            set({ adversaryComparison: null });
          }

          // 1. INJECT GRAPH DATA EXACTLY ONCE (Zero simulation resets during animation)
          const existingNodeIds = new Set(currentNodes.map((n) => n.id));
          const newNodes = incomingNodes.filter((n) => !existingNodeIds.has(n.id));
          const allNodes = [...currentNodes, ...newNodes];
          const allLinks = [...currentLinks, ...incomingLinks];

          const allChainNodeIds = data.alert.chainNodeIds || incomingNodes.map((n) => n.id);
          const allChainEdgeIds = data.alert.chainEdgeIds || incomingLinks.map((l) => l.id);

          // Set complete graph data once with initial empty edge chain
          set({
            graphData: { nodes: allNodes, links: allLinks },
            focusedChain: {
              chainId: data.alert.chainId,
              nodeIds: allChainNodeIds,
              edgeIds: [],
            },
          });

          // Brief pause for camera to glide and frame the chain smoothly
          await sleep(250);

          // 2. PROGRESSIVELY ILLUMINATE HOPS
          if (isAdv) {
            // High-density swarm: 3 fast synchronized burst waves
            const fanoutEdges = allChainEdgeIds.filter((e) => e.includes('fanout'));
            const faninEdges = allChainEdgeIds.filter((e) => e.includes('fanin'));
            const sinkEdges = allChainEdgeIds.filter((e) => !e.includes('fanout') && !e.includes('fanin'));

            // Wave 1: Fan-out burst to all 16 mules
            set({
              focusedChain: {
                chainId: data.alert.chainId,
                nodeIds: allChainNodeIds,
                edgeIds: fanoutEdges,
              },
            });
            await sleep(350);

            // Wave 2: Fan-in burst from mules to collector
            set({
              focusedChain: {
                chainId: data.alert.chainId,
                nodeIds: allChainNodeIds,
                edgeIds: [...fanoutEdges, ...faninEdges],
              },
            });
            await sleep(350);

            // Wave 3: Final exit hop to sink
            set({
              focusedChain: {
                chainId: data.alert.chainId,
                nodeIds: allChainNodeIds,
                edgeIds: allChainEdgeIds,
              },
            });
            await sleep(300);
          } else {
            // Standard chain: hop-by-hop progression
            const activeEdges: string[] = [];
            for (let i = 0; i < allChainEdgeIds.length; i++) {
              activeEdges.push(allChainEdgeIds[i]);
              set({
                focusedChain: {
                  chainId: data.alert.chainId,
                  nodeIds: allChainNodeIds,
                  edgeIds: [...activeEdges],
                },
              });
              await sleep(220); // Snappy, 60fps hop progression
            }
          }

          // 3. FINALIZE ALERT & DETECTION CELEBRATION
          set({
            alerts: [data.alert, ...get().alerts],
            selectedAlertId: data.alert.id,
            focusedChain: {
              chainId: data.alert.chainId,
              nodeIds: allChainNodeIds,
              edgeIds: allChainEdgeIds,
            },
          });
          get().triggerDetection(data.alert.chainId, data.detectionTimeMs || 143);
          return;
        }
      }
    } catch (err) {
      console.warn('Backend attack simulation unavailable, falling back:', err);
    }

    // Fallback if backend is not reachable
    const criticalAlert = state.alerts.find((a) => a.severity === 'critical');
    if (criticalAlert) {
      const edges = criticalAlert.chainEdgeIds || [];
      const nodes = criticalAlert.chainNodeIds || [];
      const activeEdges: string[] = [];
      for (let i = 0; i < edges.length; i++) {
        activeEdges.push(edges[i]);
        set({
          focusedChain: {
            chainId: criticalAlert.chainId,
            nodeIds: nodes,
            edgeIds: [...activeEdges],
          },
        });
        await sleep(220);
      }
      state.selectAlert(criticalAlert.id);
      state.triggerDetection(criticalAlert.chainId, 4200);
    }
  },
}));
