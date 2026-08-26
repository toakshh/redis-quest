import React from 'react';
import { use3DGameStore } from '../../stores/use3DGameStore';

/**
 * Vital stats bars: Health, Stamina, Weapon Heat, Ammo/Charges
 */
export function HealthStaminaAmmo() {
  const {
    player: { 
      health: playerHealth, 
      maxHealth: playerMaxHealth,
      stamina: playerStamina, 
      maxStamina: playerMaxStamina,
      weapons: { plasma, cyberdeck },
    },
  } = use3DGameStore();

  const healthRatio = playerHealth / playerMaxHealth;
  const staminaRatio = playerStamina / playerMaxStamina;
  const heatRatio = plasma.heat / 100;

  // Health color: green > yellow > red
  const healthColor = healthRatio > 0.6 
    ? '#00ff80' 
    : healthRatio > 0.3 
      ? '#ffb000' 
      : '#ff3030';

  // Stamina color: cyan
  const staminaColor = '#00f0ff';

  // Weapon heat color: blue (cool) -> red (overheated)
  const heatColor = heatRatio < 0.5 
    ? '#0080ff' 
    : heatRatio < 0.8 
      ? '#ffb000' 
      : '#ff3030';

  const containerStyle = {
    position: 'absolute',
    bottom: '20px',
    left: '20px',
    width: '320px',
    padding: '15px',
    background: 'rgba(0, 15, 25, 0.7)',
    border: '1px solid rgba(0, 240, 255, 0.3)',
    borderRadius: '4px',
    boxShadow: '0 0 20px rgba(0, 240, 255, 0.1)',
  };

  const Bar = ({ label, value, max, color, icon, pulse = false }) => {
    const ratio = Math.max(0, Math.min(1, value / max));
    
    return (
      <div style={{ marginBottom: '10px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#aaa',
          marginBottom: '2px',
          textShadow: '0 0 3px rgba(0, 0, 0, 0.8)',
        }}>
          <span>{icon} {label}</span>
          <span style={{ color }}>{Math.round(value)}/{Math.round(max)}</span>
        </div>
        <div style={{
          width: '100%',
          height: '12px',
          background: 'rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(0, 240, 255, 0.2)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${ratio * 100}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${color}, ${color}aa)`,
            boxShadow: `0 0 10px ${color}`,
            transition: 'width 0.2s ease-out',
            animation: pulse ? 'barPulse 1s infinite' : 'none',
          }} />
        </div>
      </div>
    );
  };

  return (
    <div style={containerStyle}>
      <div style={{
        fontSize: '10px',
        color: '#00f0ff',
        marginBottom: '8px',
        letterSpacing: '2px',
        borderBottom: '1px solid rgba(0, 240, 255, 0.2)',
        paddingBottom: '4px',
      }}>
        ◈ NEURAL VITALS
      </div>

      <Bar 
        label="HEALTH" 
        value={playerHealth} 
        max={playerMaxHealth} 
        color={healthColor}
        icon="♥"
        pulse={healthRatio < 0.25}
      />
      
      <Bar 
        label="STAMINA" 
        value={playerStamina} 
        max={playerMaxStamina} 
        color={staminaColor}
        icon="⚡"
      />
      
      <Bar 
        label="WEAPON HEAT" 
        value={plasma.heat} 
        max={100} 
        color={heatColor}
        icon="🔥"
        pulse={heatRatio > 0.8}
      />

      {/* Ammo / Charges display */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '12px',
        padding: '8px',
        background: 'rgba(0, 0, 0, 0.4)',
        borderRadius: '2px',
        border: '1px solid rgba(0, 240, 255, 0.15)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#00f0ff' }}>
            {plasma.ammo}
          </div>
          <div style={{ fontSize: '9px', color: '#aaa' }}>PLASMA</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ff0080' }}>
            {cyberdeck.charges}
          </div>
          <div style={{ fontSize: '9px', color: '#aaa' }}>CYBERDECK</div>
        </div>
      </div>

      <style>{`
        @keyframes barPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

export default HealthStaminaAmmo;
