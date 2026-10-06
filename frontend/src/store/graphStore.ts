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
  triggerAttack: () => void;
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
    attackBanks: ['axis', 'icici', 'hdfc'],
    attackAmount: 1500000,
    falsePositiveTest: false,
    speedMultiplier: 1,
  },
  isSimulating: false,
  simulationInterval: null,

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
      const bankCounts: Record<BankId, number> = { axis: 0, icici: 0, hdfc: 0 };
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

  triggerAttack: () => {
    // This will be implemented with the backend.
    // For now, we can simulate by highlighting the existing chain.
    const state = get();
    const criticalAlert = state.alerts.find((a) => a.severity === 'critical');
    if (criticalAlert) {
      state.selectAlert(criticalAlert.id);
      state.triggerDetection(criticalAlert.chainId, 4200);
    }
  },
}));
