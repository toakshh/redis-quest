import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { use3DGameStore } from '../../stores/use3DGameStore';
import { getAudioEngine } from './Audio3DEngine';

const AMBIENCE_ZONES = [
  {
    id: 'server_core',
    name: 'Server Core',
    center: { x: 0, y: 0, z: 0 },
    radius: 25,
    ambience: 'hum',
    volume: 0.5,
    reverb: 0.4,
    crossfadeTime: 3,
  },
  {
    id: 'cooling_tunnels',
    name: 'Cooling Tunnels',
    center: { x: -30, y: -5, z: 20 },
    radius: 15,
    ambience: 'cooling',
    volume: 0.6,
    reverb: 0.6,
    crossfadeTime: 4,
  },
  {
    id: 'network_nexus',
    name: 'Network Nexus',
    center: { x: 25, y: 2, z: -20 },
    radius: 18,
    ambience: 'data_flow',
    volume: 0.4,
    reverb: 0.3,
    crossfadeTime: 2,
  },
  {
    id: 'backup_archive',
    name: 'Backup Archive',
    center: { x: -20, y: 0, z: -30 },
    radius: 12,
    ambience: 'archive',
    volume: 0.3,
    reverb: 0.7,
    crossfadeTime: 5,
  },
  {
    id: 'corrupted_sector',
    name: 'Corrupted Sector',
    center: { x: 0, y: 0, z: 0 },
    radius: 30,
    ambience: 'corruption',
    volume: 0.5,
    reverb: 0.5,
    crossfadeTime: 1,
    conditional: (state) => state.loop.sanityBaseline < 40 || state.phase === 'loopTransition',
  },
  {
    id: 'external',
    name: 'External',
    center: { x: 0, y: 0, z: 0 },
    radius: 1000,
    ambience: 'external',
    volume: 0.2,
    reverb: 0.1,
    crossfadeTime: 5,
  },
];

export function AmbienceZones() {
  const { camera } = useThree();
  const { 
    player: { position: positionArray },
    loop: { sanityBaseline },
    phase,
    mission: { id: currentMission },
    loop: { count: loopCount },
  } = use3DGameStore();
  
  const audioEngine = useRef(null);
  const currentZoneRef = useRef(null);
  const zoneSourcesRef = useRef(new Map());
  const crossfadeTimeoutRef = useRef(null);

  useEffect(() => {
    audioEngine.current = getAudioEngine();
    audioEngine.current.init().catch(console.error);
    
    AMBIENCE_ZONES.forEach(zone => {
      audioEngine.current.loadBuffer(zone.ambience, `/audio/ambience/${zone.ambience}.ogg`);
    });
    
    return () => {
      zoneSourcesRef.current.forEach((sourceId) => {
        audioEngine.current.setSourceVolume(sourceId, 0, 1);
        setTimeout(() => audioEngine.current.stop(sourceId), 1000);
      });
    };
  }, []);

  const getActiveZones = (position) => {
    return AMBIENCE_ZONES.filter(zone => {
      if (zone.conditional && !zone.conditional({ 
        loop: { sanityBaseline }, 
        phase, 
        mission: { id: currentMission }, 
        loop: { count: loopCount } 
      })) {
        return false;
      }
      
      let center = zone.center;
      if (zone.id === 'corrupted_sector' && (sanityBaseline < 40 || phase === 'loopTransition')) {
        center = position;
      }
      
      const dx = position[0] - center.x;
      const dy = position[1] - center.y;
      const dz = position[2] - center.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      return distance <= zone.radius;
    });
  };

  const calculateZoneWeights = (activeZones, position) => {
    if (activeZones.length === 0) return [];
    
    if (activeZones.length === 1) {
      return [{ zone: activeZones[0], weight: 1 }];
    }

    const weights = activeZones.map(zone => {
      let center = zone.center;
      if (zone.id === 'corrupted_sector' && (sanityBaseline < 40 || phase === 'loopTransition')) {
        center = position;
      }
      
      const dx = position[0] - center.x;
      const dy = position[1] - center.y;
      const dz = position[2] - center.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      const weight = Math.max(0, 1 - distance / zone.radius);
      return { zone, weight };
    });

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    if (totalWeight === 0) return weights.map(w => ({ ...w, weight: 0 }));

    return weights.map(w => ({ ...w, weight: w.weight / totalWeight }));
  };

  useEffect(() => {
    if (!audioEngine.current || !positionArray) return;

    const activeZones = getActiveZones({ x: positionArray[0], y: positionArray[1], z: positionArray[2] });
    const weightedZones = calculateZoneWeights(activeZones, { x: positionArray[0], y: positionArray[1], z: positionArray[2] });

    const primaryZone = weightedZones.length > 0 
      ? weightedZones.reduce((a, b) => a.weight > b.weight ? a : b).zone 
      : AMBIENCE_ZONES.find(z => z.id === 'external');

    if (primaryZone && primaryZone.id !== currentZoneRef.current?.id) {
      const prevZone = currentZoneRef.current;
      const fadeTime = primaryZone.crossfadeTime || 2;
      
      if (prevZone) {
        const prevSourceId = zoneSourcesRef.current.get(prevZone.id);
        if (prevSourceId) {
          audioEngine.current.setSourceVolume(prevSourceId, 0, fadeTime);
          crossfadeTimeoutRef.current = setTimeout(() => {
            audioEngine.current.stop(prevSourceId);
            zoneSourcesRef.current.delete(prevZone.id);
          }, fadeTime * 1000);
        }
      }

      const sourceId = `ambience_${primaryZone.id}`;
      
      if (!zoneSourcesRef.current.has(primaryZone.id)) {
        audioEngine.current.createSource(sourceId, {
          bufferId: primaryZone.ambience,
          position: { x: 0, y: 0, z: 0 },
          loop: true,
          volume: 0,
          category: 'ambience',
          spatial: false,
        });
        zoneSourcesRef.current.set(primaryZone.id, sourceId);
      }

      audioEngine.current.play(sourceId);
      audioEngine.current.setSourceVolume(sourceId, primaryZone.volume, fadeTime);

      currentZoneRef.current = primaryZone;
    }

    weightedZones.forEach(({ zone, weight }) => {
      if (zone.id === primaryZone?.id) return;
      
      const sourceId = zoneSourcesRef.current.get(zone.id);
      if (sourceId) {
        audioEngine.current.setSourceVolume(sourceId, zone.volume * weight * 0.5, 1);
      }
    });
  }, [positionArray, sanityBaseline, phase, currentMission, loopCount]);

  return null;
}

export default AmbienceZones;
