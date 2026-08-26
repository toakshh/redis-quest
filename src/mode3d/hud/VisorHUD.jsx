import React, { useMemo } from 'react';
import { use3DGameStore } from '../../stores/use3DGameStore';
import HealthStaminaAmmo from './HealthStaminaAmmo';
import ObjectiveTracker from './ObjectiveTracker';
import SanityMeter from './SanityMeter';
import EmbeddedTerminal from './EmbeddedTerminal';
import RadarMinimap from './RadarMinimap';

/**
 * Main HUD overlay with cyberpunk visor frame
 * Wraps all HUD elements and provides the cyberpunk visor aesthetic
 */
export function VisorHUD() {
  const {
    player: { health: playerHealth, maxHealth: playerMaxHealth },
    loop: { count: loopCount, sanityBaseline },
    mission: { pressure, id: missionId, name: missionName, objectives: missionObjectives },
    phase,
    terminal: { open: showTerminal },
  } = use3DGameStore();

  const sanityRatio = sanityBaseline / 100;
  const isInLoop = phase === 'loopTransition';

  // Dynamic CSS variables for glitch effects
  const hudStyle = useMemo(() => {
    const glitchIntensity = Math.max(0, (1 - sanityRatio) * 100);
    
    return {
      '--glitch-opacity': Math.min(glitchIntensity / 100, 0.8),
      '--hud-cyan': '#00f0ff',
      '--hud-magenta': '#ff0080',
      '--hud-amber': '#ffb000',
      '--hud-red': '#ff3030',
      '--hud-dim': 'rgba(0, 240, 255, 0.4)',
    };
  }, [sanityRatio]);

  // Root container - fullscreen overlay
  const containerStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 100,
    fontFamily: "'Share Tech Mono', 'Courier New', monospace",
    userSelect: 'none',
    overflow: 'hidden',
    ...hudStyle,
  };

  // Visor frame styling
  const visorFrameStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    border: '2px solid rgba(0, 240, 255, 0.3)',
    boxShadow: 'inset 0 0 100px rgba(0, 10, 20, 0.4)',
    background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0, 10, 20, 0.4) 100%)',
    pointerEvents: 'none',
  };

  // Top status bar
  const topBarStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 20px',
    background: 'linear-gradient(180deg, rgba(0, 20, 30, 0.8), transparent)',
    borderBottom: '1px solid rgba(0, 240, 255, 0.2)',
    fontSize: '12px',
    color: hudStyle['--hud-cyan'],
    textShadow: '0 0 5px rgba(0, 240, 255, 0.5)',
  };

  // Corner brackets
  const cornerStyle = (position) => ({
    position: 'absolute',
    width: '30px',
    height: '30px',
    borderColor: 'rgba(0, 240, 255, 0.6)',
    ...position,
  });

  // Loop indicator
  const loopIndicator = isInLoop ? (
    <div style={{
      position: 'absolute',
      top: '50px',
      left: '50%',
      transform: 'translateX(-50%)',
      color: '#ff0080',
      fontSize: '18px',
      fontWeight: 'bold',
      textShadow: '0 0 10px rgba(255, 0, 128, 0.8)',
      letterSpacing: '3px',
      animation: 'loopPulse 2s infinite',
    }}>
      ⟲ LOOP ACTIVE — CYCLE {loopCount} ⟲
    </div>
  ) : null;

  // Game state overlay
  const gameStateOverlay = phase === 'defeat' ? (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(20, 0, 0, 0.7)',
      color: hudStyle['--hud-red'],
      fontSize: '48px',
      fontWeight: 'bold',
      textShadow: '0 0 20px rgba(255, 30, 30, 0.8)',
      pointerEvents: 'auto',
    }}>
      <div>SANITY BREACH</div>
      <div style={{ fontSize: '16px', marginTop: '20px', color: '#aaa' }}>
        Neural connection terminated. Press R to reboot.
      </div>
    </div>
  ) : phase === 'victory' ? (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 20, 0, 0.7)',
      color: '#00ff80',
      fontSize: '48px',
      fontWeight: 'bold',
      textShadow: '0 0 20px rgba(0, 255, 128, 0.8)',
      pointerEvents: 'auto',
    }}>
      <div>MISSION COMPLETE</div>
      <div style={{ fontSize: '16px', marginTop: '20px', color: '#aaa' }}>
        Redis cluster stabilized. Press R to restart.
      </div>
    </div>
  ) : null;

  return (
    <div style={containerStyle} className="visor-hud">
      {/* Visor frame */}
      <div style={visorFrameStyle} />
      
      {/* Corner brackets */}
      <div style={cornerStyle({ top: 8, left: 8, borderTop: '2px solid', borderLeft: '2px solid' })} />
      <div style={cornerStyle({ top: 8, right: 8, borderTop: '2px solid', borderRight: '2px solid' })} />
      <div style={cornerStyle({ bottom: 8, left: 8, borderBottom: '2px solid', borderLeft: '2px solid' })} />
      <div style={cornerStyle({ bottom: 8, right: 8, borderBottom: '2px solid', borderRight: '2px solid' })} />

      {/* Top status bar */}
      <div style={topBarStyle}>
        <span>NETRUNNER://REDIS-QUEST v3.0</span>
        <span>{missionId ? `MISSION: ${missionId}` : 'NO MISSION LOADED'}</span>
        <span>{new Date().toLocaleTimeString()}</span>
      </div>

      {/* Loop indicator */}
      {loopIndicator}

      {/* Vital stats - bottom left */}
      <HealthStaminaAmmo />

      {/* Sanity meter - bottom center */}
      <SanityMeter />

      {/* Objective tracker - top right */}
      <ObjectiveTracker />

      {/* Radar minimap - bottom right */}
      <RadarMinimap />

      {/* Embedded terminal - center/modal */}
      {showTerminal && <EmbeddedTerminal />}

      {/* Game state overlay */}
      {gameStateOverlay}

      {/* CSS animations */}
      <style>{`
        @keyframes loopPulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; transform: translateX(-50%) scale(1.05); }
        }
      `}</style>
    </div>
  );
}

export default VisorHUD;
