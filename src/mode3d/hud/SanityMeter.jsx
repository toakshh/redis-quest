import React, { useMemo, useRef, useEffect } from 'react';
import { use3DGameStore } from '../../stores/use3DGameStore';

/**
 * Glitching sanity indicator with distortion level
 * Visualizes player mental stability; triggers visual glitches at low sanity
 */
export function SanityMeter() {
  const { 
    loop: { sanityBaseline }, 
    mission: { pressure }, 
  } = use3DGameStore();
  
  const sanityRatio = Math.max(0, sanityBaseline / 100);
  const ref = useRef(null);

  // Compute distortion level based on sanity and pressure
  const distortionLevel = useMemo(() => {
    const sanityFactor = sanityRatio < 0.2 ? 1.0 : sanityRatio < 0.4 ? 0.6 : sanityRatio < 0.6 ? 0.3 : sanityRatio < 0.8 ? 0.1 : 0.0;
    const pressureFactor = (pressure / 100) * 0.5;
    return Math.min(1, sanityFactor + pressureFactor);
  }, [sanityRatio, pressure]);

  // Color based on sanity level
  const sanityColor = useMemo(() => {
    if (sanityRatio < 0.2) return '#ff3030';
    if (sanityRatio < 0.4) return '#ff0080';
    if (sanityRatio < 0.6) return '#ffb000';
    if (sanityRatio < 0.8) return '#00f0ff';
    return '#00ff80';
  }, [sanityRatio]);

  // Glitch animation
  useEffect(() => {
    if (!ref.current) return;
    
    let frame;
    const animate = () => {
      if (ref.current && distortionLevel > 0) {
        const glitchX = (Math.random() - 0.5) * distortionLevel * 10;
        const glitchY = (Math.random() - 0.5) * distortionLevel * 6;
        const skewY = (Math.random() - 0.5) * distortionLevel * 4;
        
        ref.current.style.transform = `translate(${glitchX}px, ${glitchY}px) skewY(${skewY}deg)`;
        
        if (Math.random() < distortionLevel * 0.05) {
          ref.current.style.filter = 'invert(1) hue-rotate(90deg)';
        } else {
          ref.current.style.filter = 'none';
        }
      } else if (ref.current) {
        ref.current.style.transform = 'none';
        ref.current.style.filter = 'none';
      }
      frame = requestAnimationFrame(animate);
    };
    
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [distortionLevel]);

  // Container
  const containerStyle = {
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '400px',
    padding: '12px 20px',
    background: 'rgba(0, 10, 20, 0.8)',
    border: '1px solid rgba(0, 240, 255, 0.2)',
    borderRadius: '4px',
    boxShadow: '0 0 20px rgba(0, 240, 255, 0.1)',
  };

  const meterWrapperStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  const labelStyle = {
    fontSize: '11px',
    color: sanityColor,
    letterSpacing: '3px',
    marginBottom: '6px',
    textShadow: `0 0 5px ${sanityColor}`,
  };

  const barContainerStyle = {
    width: '100%',
    height: '16px',
    background: 'rgba(0, 0, 0, 0.6)',
    border: '1px solid rgba(0, 240, 255, 0.3)',
    borderRadius: '2px',
    overflow: 'hidden',
    position: 'relative',
  };

  const barFillStyle = {
    width: `${sanityRatio * 100}%`,
    height: '100%',
    background: `linear-gradient(90deg, ${sanityColor}, ${sanityColor}88)`,
    boxShadow: `0 0 15px ${sanityColor}`,
    transition: 'width 0.3s ease-out',
    position: 'relative',
  };

  const scanLineStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '2px',
    height: '100%',
    background: '#fff',
    boxShadow: '0 0 10px #fff',
    opacity: 0.5,
    animation: 'scanMove 2s linear infinite',
  };

  const segmentLines = Array.from({ length: 20 }, (_, i) => (
    <div
      key={i}
      style={{
        position: 'absolute',
        left: `${(i + 1) * 5}%`,
        top: 0,
        width: '1px',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.4)',
      }}
    />
  ));

  const statusText = useMemo(() => {
    if (sanityRatio < 0.2) return 'CRITICAL - MIND FRACTURE IMMINENT';
    if (sanityRatio < 0.4) return 'WARNING - HALLUCINATIONS DETECTED';
    if (sanityRatio < 0.6) return 'UNSTABLE - REALITY DISTORTION';
    if (sanityRatio < 0.8) return 'NOMINAL - MINOR NOISE';
    return 'STABLE - SYNCED';
  }, [sanityRatio]);

  return (
    <div style={containerStyle}>
      <div ref={ref} style={meterWrapperStyle}>
        <div style={labelStyle}>◈ NEURAL SANITY SYNCH</div>
        <div style={barContainerStyle}>
          <div style={barFillStyle} />
          {segmentLines}
          <div style={scanLineStyle} />
        </div>
        <div style={{
          fontSize: '10px',
          color: sanityColor,
          marginTop: '4px',
          opacity: 0.8,
        }}>
          {statusText} [{Math.round(sanityRatio * 100)}%]
        </div>
        {distortionLevel > 0 && (
          <div style={{
            fontSize: '9px',
            color: '#ff3030',
            marginTop: '2px',
          }}>
            ▲ DISTORTION: {(distortionLevel * 100).toFixed(0)}%
          </div>
        )}
      </div>

      <style>{`
        @keyframes scanMove {
          0% { transform: translateX(0); }
          100% { transform: translateX(380px); }
        }
      `}</style>
    </div>
  );
}

export default SanityMeter;
