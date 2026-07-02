import React from 'react';

const KEYFRAMES = `
  @keyframes db-enter {
    from { opacity: 0; transform: scale(0.68); }
    to   { opacity: 1; transform: scale(1);    }
  }
  @keyframes db-shimmer {
    from { transform: translateX(-130%) skewX(-15deg); }
    to   { transform: translateX(280%)  skewX(-15deg); }
  }
  @keyframes db-bar {
    0%        { left: -40%; width: 40%; }
    60%, 100% { left: 110%; width: 40%; }
  }
`;

/**
 * Unified app loader.
 *
 *   variant="full"  — Netflix-style: logo scales in from nothing, a single
 *                     diagonal shimmer sweeps across once, then holds steady.
 *                     Used for boot / init delay only.
 *
 *   variant="bar"   — Thin animated teal progress bar at top of screen.
 *                     Used for Suspense fallback and PrivateRoute auth check.
 */
export default function AppLoader({ variant = 'full' }) {
  return (
    <>
      <style>{KEYFRAMES}</style>

      {variant === 'bar' ? (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 3,
          background: 'rgba(255,255,255,0.07)', zIndex: 1400, overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, height: '100%',
            background: '#14b8a6',
            animation: 'db-bar 1.4s cubic-bezier(0.4,0,0.2,1) infinite',
          }} />
        </div>
      ) : (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1300,
          background: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Wrapper clips the shimmer to the logo's circular boundary */}
          <div style={{
            position: 'relative', width: 96, height: 96,
            borderRadius: '50%', overflow: 'hidden',
            animation: 'db-enter 0.55s cubic-bezier(0.22,1,0.36,1) forwards',
          }}>
            <img
              src="/favicon.png"
              alt="DB World"
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
            {/* Diagonal shimmer — sweeps once after logo appears, then gone */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(105deg, transparent 25%, rgba(255,255,255,.55) 50%, transparent 75%)',
              transform: 'translateX(-130%) skewX(-15deg)',
              animation: 'db-shimmer 0.75s cubic-bezier(0.4,0,0.2,1) 0.45s forwards',
            }} />
          </div>
        </div>
      )}
    </>
  );
}
