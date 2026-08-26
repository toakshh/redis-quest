import React, { useRef, useEffect } from 'react';
import { use3DGameStore } from '../../stores/use3DGameStore';

/**
 * 2D circular radar tracking player, objectives, threats
 * Cyberpunk-style minimap with blips for entities
 */
export function RadarMinimap() {
  const {
    player: { position: positionArray, rotationYaw },
    enemies: { active: enemies },
    mission: { objectives: missionObjectives },
  } = use3DGameStore();

  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  const playerPosition = useRef({ x: positionArray[0], y: positionArray[1], z: positionArray[2] });
  const playerRotation = useRef({ x: 0, y: rotationYaw, z: 0 });

  const RADAR_RADIUS = 100;
  const RADAR_RANGE = 50;

  const drawRadar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Update positions
    playerPosition.current = { x: positionArray[0], y: positionArray[1], z: positionArray[2] };
    playerRotation.current.y = rotationYaw;

    const { width, height } = canvas;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, RADAR_RADIUS);
    gradient.addColorStop(0, 'rgba(0, 20, 30, 0.8)');
    gradient.addColorStop(1, 'rgba(0, 10, 20, 0.9)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, RADAR_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const r = RADAR_RADIUS * (i / 4);
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(centerX, centerY - RADAR_RADIUS);
    ctx.lineTo(centerX, centerY + RADAR_RADIUS);
    ctx.moveTo(centerX - RADAR_RADIUS, centerY);
    ctx.lineTo(centerX + RADAR_RADIUS, centerY);
    ctx.stroke();

    const sweepAngle = (Date.now() / 1000) * Math.PI * 0.5;
    const sweepGradient = ctx.createLinearGradient(
      centerX, centerY,
      centerX + Math.cos(sweepAngle) * RADAR_RADIUS,
      centerY + Math.sin(sweepAngle) * RADAR_RADIUS
    );
    sweepGradient.addColorStop(0, 'rgba(0, 240, 255, 0.6)');
    sweepGradient.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.strokeStyle = sweepGradient;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(sweepAngle) * RADAR_RADIUS,
      centerY + Math.sin(sweepAngle) * RADAR_RADIUS
    );
    ctx.stroke();

    const worldToRadar = (worldPos) => {
      const dx = worldPos.x - playerPosition.current.x;
      const dz = worldPos.z - playerPosition.current.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      if (distance > RADAR_RANGE) return null;

      const angle = Math.atan2(dx, dz) - playerRotation.current.y;
      const radarDist = (distance / RADAR_RANGE) * RADAR_RADIUS;
      
      return {
        x: centerX + Math.sin(angle) * radarDist,
        y: centerY - Math.cos(angle) * radarDist,
        distance,
      };
    };

    // Draw enemies
    enemies.forEach(entity => {
      if (!entity.position) return;
      const pos = worldToRadar({ x: entity.position[0], y: entity.position[1], z: entity.position[2] });
      if (!pos) return;

      const isHostile = entity.state !== 'friendly';
      const isBoss = entity.type === 'boss';

      let color = isHostile ? '#ff3030' : '#00f0ff';
      if (isBoss) color = '#ff0080';

      let size = isBoss ? 10 : (isHostile ? 7 : 5);

      if (isHostile) {
        const pulse = (Math.sin(Date.now() / 200) + 1) * 0.5;
        size += pulse * 3;
      }

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (pos.distance > RADAR_RANGE * 0.9) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // Draw objectives
    missionObjectives.filter(o => !o.done && o.position).forEach(obj => {
      const pos = worldToRadar({ x: obj.position[0], y: obj.position[1], z: obj.position[2] });
      if (!pos) return;

      ctx.fillStyle = '#ffb000';
      ctx.shadowColor = '#ffb000';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y - 8);
      ctx.lineTo(pos.x + 6, pos.y);
      ctx.lineTo(pos.x, pos.y + 8);
      ctx.lineTo(pos.x - 6, pos.y);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      const pulse = (Math.sin(Date.now() / 300 + (obj.id || '').length * 10) + 1) * 0.5;
      ctx.strokeStyle = `rgba(255, 176, 0, ${0.5 + pulse * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y - 12);
      ctx.lineTo(pos.x + 9, pos.y);
      ctx.lineTo(pos.x, pos.y + 12);
      ctx.lineTo(pos.x - 9, pos.y);
      ctx.closePath();
      ctx.stroke();
    });

    // Draw player (center)
    ctx.fillStyle = '#00ff80';
    ctx.shadowColor = '#00ff80';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 6);
    ctx.lineTo(centerX + 4, centerY + 4);
    ctx.lineTo(centerX - 4, centerY + 4);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#00ff80';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.sin(-playerRotation.current.y) * 9,
      centerY - Math.cos(-playerRotation.current.y) * 9
    );
    ctx.stroke();

    for (let i = 1; i <= 3; i++) {
      const r = RADAR_RADIUS * (i / 4);
      const dist = Math.round(RADAR_RANGE * (i / 4));
      ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${dist}m`, centerX + r + 12, centerY + 3);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 220;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.getContext('2d').scale(dpr, dpr);

    const animate = () => {
      drawRadar();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [positionArray, rotationYaw, enemies, missionObjectives]);

  const containerStyle = {
    position: 'absolute',
    bottom: '20px',
    right: '20px',
    width: '220px',
    height: '220px',
    background: 'rgba(0, 10, 20, 0.7)',
    border: '1px solid rgba(0, 240, 255, 0.3)',
    borderRadius: '50%',
    boxShadow: '0 0 20px rgba(0, 240, 255, 0.1)',
    overflow: 'hidden',
  };

  const labelStyle = {
    position: 'absolute',
    top: '6px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '10px',
    color: '#00f0ff',
    letterSpacing: '2px',
    textShadow: '0 0 5px rgba(0, 240, 255, 0.5)',
    zIndex: 10,
  };

  const coordsStyle = {
    position: 'absolute',
    bottom: '6px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '9px',
    color: 'rgba(0, 240, 255, 0.6)',
    fontFamily: 'monospace',
    zIndex: 10,
  };

  return (
    <div style={containerStyle}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      <div style={labelStyle}>◈ TACTICAL RADAR ◈</div>
      <div style={coordsStyle}>
        X: {Math.round(positionArray[0])} Z: {Math.round(positionArray[2])}
      </div>
    </div>
  );
}

export default RadarMinimap;
