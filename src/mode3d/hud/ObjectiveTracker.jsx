import React, { useMemo } from 'react';
import { use3DGameStore } from '../../stores/use3DGameStore';

/**
 * Mission objectives and Redis task progress tracker
 */
export function ObjectiveTracker() {
  const {
    mission: { id: missionId, name: missionName, objectives: missionObjectives },
    terminal: { history: terminalHistory },
  } = use3DGameStore();

  // Active objectives sorted by priority
  const sortedObjectives = useMemo(() => {
    return missionObjectives
      .filter(o => !o.done)
      .sort((a, b) => (a.priority || 0) - (b.priority || 0))
      .slice(0, 5);
  }, [missionObjectives]);

  const completedCount = missionObjectives.filter(o => o.done).length;
  const totalCount = missionObjectives.length;

  const containerStyle = {
    position: 'absolute',
    top: '50px',
    right: '20px',
    width: '300px',
    padding: '15px',
    background: 'rgba(0, 15, 25, 0.7)',
    border: '1px solid rgba(255, 0, 128, 0.3)',
    borderRadius: '4px',
    boxShadow: '0 0 20px rgba(255, 0, 128, 0.1)',
    maxHeight: '40vh',
    overflowY: 'auto',
  };

  const missionHeaderStyle = {
    fontSize: '14px',
    color: '#ff0080',
    fontWeight: 'bold',
    marginBottom: '10px',
    textShadow: '0 0 5px rgba(255, 0, 128, 0.5)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const progressBarStyle = {
    width: '100%',
    height: '4px',
    background: 'rgba(255, 0, 128, 0.2)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '12px',
  };

  const progressFillStyle = {
    width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
    height: '100%',
    background: 'linear-gradient(90deg, #ff0080, #ff0080aa)',
    boxShadow: '0 0 8px #ff0080',
    transition: 'width 0.3s ease-out',
  };

  const objectiveItemStyle = (priority) => ({
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: '8px',
    fontSize: '12px',
    color: priority === 0 ? '#fff' : '#ccc',
    padding: '4px 6px',
    background: priority === 0 ? 'rgba(255, 0, 128, 0.1)' : 'transparent',
    borderRadius: '2px',
    border: priority === 0 ? '1px solid rgba(255, 0, 128, 0.3)' : 'none',
  });

  const checkmarkStyle = (completed) => ({
    color: completed ? '#00ff80' : '#ffb000',
    marginRight: '8px',
    flexShrink: 0,
  });

  return (
    <div style={containerStyle}>
      {missionId && (
        <>
          <div style={missionHeaderStyle}>
            <span>◈ {missionId}</span>
            <span style={{ fontSize: '10px' }}>
              {completedCount}/{totalCount}
            </span>
          </div>
          <div style={{ fontSize: '10px', color: '#999', marginBottom: '8px' }}>
            {missionName}
          </div>
          <div style={progressBarStyle}>
            <div style={progressFillStyle} />
          </div>
        </>
      )}

      {/* Objectives list */}
      {sortedObjectives.map((obj) => (
        <div key={obj.id} style={objectiveItemStyle(obj.priority || 0)}>
          <span style={checkmarkStyle(obj.done)}>
            {obj.done ? '✓' : '○'}
          </span>
          <div>
            <div>{obj.description || obj.text || obj.id}</div>
            {obj.command && (
              <div style={{ 
                fontSize: '10px', 
                color: '#00f0ff', 
                marginTop: '2px',
                fontFamily: 'monospace',
              }}>
                $ redis-cli {obj.command}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Completed objectives */}
      {completedCount > 0 && (
        <div style={{
          marginTop: '10px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(255, 0, 128, 0.2)',
          fontSize: '10px',
          color: '#666',
        }}>
          {completedCount} objectives complete
        </div>
      )}

      {!missionId && (
        <div style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>
          No active mission
        </div>
      )}
    </div>
  );
}

export default ObjectiveTracker;
