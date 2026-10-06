/**
 * Command Center — Screen 1
 * 
 * The main demo screen with:
 * - Left: Bank feed cards (Axis, ICICI, HDFC)
 * - Center: Live 3D network graph (the showpiece)
 * - Right: Alert list with scores
 * - Bottom: Privacy proof strip
 * - Top: Header with "Simulate Attack" button
 */

'use client';

import React, { useEffect } from 'react';
import { useGraphStore } from '@/store/graphStore';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import BankFeedPanel from '@/components/dashboard/BankFeedPanel';
import AlertPanel from '@/components/dashboard/AlertPanel';
import PrivacyStrip from '@/components/dashboard/PrivacyStrip';
import NetworkGraph from '@/components/graph/NetworkGraph';

export default function CommandCenter() {
  const { initializeGraph, graphData } = useGraphStore();

  // Initialize graph data on mount
  useEffect(() => {
    if (graphData.nodes.length === 0) {
      initializeGraph();
    }
  }, [initializeGraph, graphData.nodes.length]);

  return (
    <div className="dashboard-grid">
      <DashboardHeader />

      <aside className="dashboard-sidebar-left">
        <BankFeedPanel />
      </aside>

      <main className="dashboard-main">
        <NetworkGraph />
      </main>

      <aside className="dashboard-sidebar-right">
        <AlertPanel />
      </aside>

      <PrivacyStrip />
    </div>
  );
}
