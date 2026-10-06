/**
 * ForceGraph3DWrapper — Dynamic import wrapper for react-force-graph-3d
 * Required because the library accesses `window` which isn't available during SSR.
 */

'use client';

import dynamic from 'next/dynamic';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#050508',
      color: '#5a5a78',
      fontFamily: 'var(--font-mono)',
      fontSize: '14px',
      letterSpacing: '0.1em',
    }}>
      INITIALIZING NEURAL TOPOLOGY...
    </div>
  ),
});

export default ForceGraph3D;
