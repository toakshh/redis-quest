import React, { useEffect, useRef, useCallback } from 'react';
import { use3DGameStore } from '../../stores/use3DGameStore';
import { getMission, MISSIONS } from './MissionsData';

/**
 * Active mission coordinator, objective checks, Redis bridges
 */
export function MissionManager({ 
  autoStart = true,
  onMissionComplete,
  onMissionFail,
}) {
  const {
    currentMission,
    mission: { objectives: missionObjectives, pressure, pressureThreshold },
    loop: { count: loopCount, sanityBaseline },
    phase,
    player: { position: playerPosition },
    addPressure,
    reducePressure,
    completeObjective: completeObjectiveAction,
    failMission,
    completeMission,
    setPhase,
    setMission,
  } = use3DGameStore();

  const missionTimerRef = useRef(null);
  const checkIntervalRef = useRef(null);
  const loopTransitionRef = useRef(false);

  const initializeMission = useCallback((missionId = 1) => {
    const mission = getMission(missionId);
    if (!mission) return false;

    // Convert mission definition to store format
    const storeMission = {
      id: mission.id,
      name: mission.name,
      subtitle: mission.briefing,
      objectives: mission.objectives.map((obj, i) => ({
        ...obj,
        id: obj.id || `obj_${i}`,
        done: false,
        priority: obj.priority || i,
      })),
      timer: mission.timeLimit || 0,
      timerMax: mission.timeLimit || 0,
      pressure: 0,
      pressureThreshold: mission.pressureThreshold || 75,
      failed: false,
      completed: false,
      startedAt: Date.now(),
      timeTookMs: 0,
    };

    setMission(storeMission);
    setPhase('playing');
    
    if (mission.timeLimit) {
      startMissionTimer(mission.timeLimit);
    }

    startObjectiveChecks();

    return true;
  }, [setMission, setPhase]);

  const startMissionTimer = (timeLimit) => {
    if (missionTimerRef.current) clearTimeout(missionTimerRef.current);
    
    missionTimerRef.current = setTimeout(() => {
      handleMissionFail('TIME_EXPIRED');
    }, timeLimit * 1000);
  };

  const startObjectiveChecks = () => {
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    
    checkIntervalRef.current = setInterval(() => {
      checkObjectives();
      checkEnvironmentalHazards();
      checkLoopConditions();
    }, 1000);
  };

  const checkObjectives = () => {
    if (!currentMission || phase !== 'playing') return;

    missionObjectives.forEach(obj => {
      if (obj.done) return;

      // Position-based objectives
      if (obj.position && playerPosition) {
        const dx = playerPosition[0] - obj.position[0];
        const dz = playerPosition[2] - obj.position[2];
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < 3) {
          completeObjective(obj.id);
        }
      }
    });

    const allComplete = missionObjectives.length > 0 && missionObjectives.every(o => o.done);
    if (allComplete) {
      handleMissionComplete();
    }
  };

  const completeObjective = (objectiveId) => {
    completeObjectiveAction(objectiveId);
    
    if (currentMission) {
      // Sanity reward via loop sanityBaseline
      const reward = (currentMission.sanityReward || 10) / currentMission.objectives.length;
      use3DGameStore.setState((state) => ({
        loop: { ...state.loop, sanityBaseline: Math.min(100, state.loop.sanityBaseline + reward) },
      }));
    }
  };

  const checkEnvironmentalHazards = () => {
    if (!currentMission || phase !== 'playing') return;

    currentMission.environmentalHazards?.forEach(hazard => {
      switch (hazard) {
        case 'thermal_throttling':
          if (playerPosition && Math.abs(playerPosition[0]) > 35 && Math.abs(playerPosition[2]) > 25) {
            addPressure(0.5);
          }
          break;
        case 'network_jitter':
          if (Math.random() < 0.01) {
            addPressure(2);
          }
          break;
        case 'memory_pressure':
          addPressure(0.2);
          break;
        case 'reality_tears':
          if (Math.random() < 0.005) {
            use3DGameStore.setState((state) => ({
              environment: { ...state.environment, lighting: { ...state.environment.lighting, flicker: 0.3 } },
            }));
          }
          break;
        case 'corruption_aura':
          if (playerPosition && playerPosition[2] < -35) {
            addPressure(1);
          }
          break;
        case 'sanity_drain':
          addPressure(0.5);
          break;
      }
    });
  };

  const checkLoopConditions = () => {
    if (!currentMission || phase !== 'playing') return;

    if (sanityBaseline < 15 && phase !== 'loopTransition' && !loopTransitionRef.current) {
      enterLoop();
    }

    if (phase === 'loopTransition' && missionObjectives.some(o => o.done && o.loopCompleted)) {
      exitLoop();
    }
  };

  const enterLoop = () => {
    loopTransitionRef.current = true;
    setPhase('loopTransition');
    
    // Apply loop modifiers
    if (currentMission?.loopModifiers) {
      // Modifiers would be applied in game systems
    }

    // Reset some objectives for loop replay
    // (In real implementation, this would modify mission objectives)

    // Sanity penalty for loop entry
    const penalty = currentMission?.sanityPenalty || 10;
    use3DGameStore.setState((state) => ({
      loop: { ...state.loop, sanityBaseline: Math.max(0, state.loop.sanityBaseline - penalty) },
    }));

    loopTransitionRef.current = false;
  };

  const exitLoop = () => {
    setPhase('playing');
    // Mark loop objectives as truly completed
  };

  const handleMissionComplete = () => {
    if (missionTimerRef.current) clearTimeout(missionTimerRef.current);
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    
    completeMission();
    
    if (onMissionComplete) {
      onMissionComplete(currentMission);
    }
  };

  const handleMissionFail = (reason) => {
    if (missionTimerRef.current) clearTimeout(missionTimerRef.current);
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    
    failMission();
    
    if (onMissionFail) {
      onMissionFail(currentMission, reason);
    }
  };

  useEffect(() => {
    if (autoStart && !currentMission) {
      initializeMission(1);
    }
    
    return () => {
      if (missionTimerRef.current) clearTimeout(missionTimerRef.current);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [autoStart, currentMission, initializeMission]);

  return null;
}

export default MissionManager;
