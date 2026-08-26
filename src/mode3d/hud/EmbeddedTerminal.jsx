import React, { useState, useRef, useEffect } from 'react';
import { use3DGameStore } from '../../stores/use3DGameStore';

/**
 * In-visor netrunner terminal for Redis CLI commands
 * Simulates a hacker terminal with command history, autocomplete, and output
 */
export function EmbeddedTerminal() {
  const {
    terminal: { open: showTerminal, history: terminalHistory, input: terminalInput },
    toggleTerminal,
    pushTerminalLine,
    setTerminalInput,
    mission: { id: missionId, name: missionName, objectives: missionObjectives },
  } = use3DGameStore();

  const [localHistory, setLocalHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef(null);
  const contentRef = useRef(null);

  const commandHistory = useRef([]);
  
  const availableCommands = [
    'help', 'clear', 'status', 'scan', 'connect', 'disconnect',
    'get', 'set', 'del', 'exists', 'expire', 'ttl', 'keys',
    'info', 'memory', 'config', 'slowlog', 'monitor', 'debug',
    'ping', 'echo', 'select', 'flushdb', 'flushall',
    'lpush', 'rpush', 'lpop', 'rpop', 'lrange', 'llen',
    'sadd', 'srem', 'smembers', 'scard', 'sismember',
    'hset', 'hget', 'hgetall', 'hdel', 'hexists', 'hlen',
    'zadd', 'zrem', 'zrange', 'zcard', 'zscore',
    'xadd', 'xread', 'xrange', 'xlen', 'xdel',
    'pfadd', 'pfcount', 'pfmerge',
    'geoadd', 'georadius', 'geodist',
    'subscribe', 'publish', 'psubscribe',
    'eval', 'script',
  ];

  useEffect(() => {
    if (showTerminal && inputRef.current) {
      inputRef.current.focus();
      setHistoryIndex(-1);
    }
  }, [showTerminal]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [terminalHistory, localHistory]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      toggleTerminal();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(terminalInput.trim());
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.current.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setTerminalInput(commandHistory.current[commandHistory.current.length - 1 - newIndex]);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setTerminalInput(commandHistory.current[commandHistory.current.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setTerminalInput('');
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const matches = availableCommands.filter(c => c.startsWith(terminalInput.toLowerCase()));
      if (matches.length === 1) {
        setTerminalInput(matches[0]);
      } else if (matches.length > 1) {
        pushTerminalLine(`> ${terminalInput}`, matches.map(m => `  ${m}`).join('\n'));
      }
      return;
    }
  };

  const handleInputChange = (e) => {
    setTerminalInput(e.target.value);
  };

  const executeCommand = (cmd) => {
    if (!cmd) return;

    commandHistory.current.push(cmd);
    if (commandHistory.current.length > 50) commandHistory.current.shift();
    setHistoryIndex(-1);

    const result = handleBuiltin(cmd);
    if (result) {
      pushTerminalLine(`> ${cmd}`, result.output ? result.output.join('\n') : '');
      return;
    }

    // Default: echo command
    pushTerminalLine(`> ${cmd}`, `(simulated) Command executed: ${cmd}`);
  };

  const handleBuiltin = (cmd) => {
    const parts = cmd.split(' ');
    const baseCmd = parts[0].toLowerCase();

    switch (baseCmd) {
      case 'help':
        return {
          output: [
            'Available commands:',
            '  help         - Show this help',
            '  clear        - Clear terminal',
            '  status       - Show system status',
            '  scan         - Scan for Redis keys',
            '  connect      - Connect to Redis instance',
            '  get/set/del  - Key operations',
            '  info/memory  - Server info',
            '  ...and all standard Redis commands',
            '',
            'Mission-specific:',
            '  analyze      - Analyze current anomaly',
            '  fix          - Apply fix to anomaly',
            '  override     - Force override (costs sanity)',
          ],
        };
      case 'clear':
        use3DGameStore.setState({ terminal: { ...use3DGameStore.getState().terminal, history: [] } });
        return null;
      case 'status':
        const s = use3DGameStore.getState();
        return {
          output: [
            `Health: ${s.player.health}/${s.player.maxHealth}`,
            `Stamina: ${s.player.stamina}/${s.player.maxStamina}`,
            `Sanity Baseline: ${s.loop.sanityBaseline}`,
            `Loop: ${s.loop.count}`,
            `Pressure: ${s.mission.pressure}`,
            `Mission: ${s.mission.id || 'None'}`,
          ],
        };
      case 'analyze':
        if (!missionId) return { output: ['No active mission to analyze'], error: true };
        return {
          output: [
            `Analyzing ${missionId}...`,
            `Name: ${missionName}`,
            `Objectives: ${missionObjectives.length}`,
            'Recommendation: Run diagnostic commands to identify root cause',
          ],
        };
      case 'override':
        use3DGameStore.setState((state) => ({
          loop: { ...state.loop, sanityBaseline: Math.max(0, state.loop.sanityBaseline - 15) },
        }));
        return { output: ['OVERRIDE EXECUTED - Sanity reduced by 15'], warning: true };
      default:
        return null;
    }
  };

  if (!showTerminal) return null;

  const overlayStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0, 0, 0, 0.85)',
    zIndex: 200,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Share Tech Mono', 'Courier New', monospace",
  };

  const terminalStyle = {
    flex: 1,
    width: '90%',
    maxWidth: '900px',
    maxHeight: '80vh',
    margin: 'auto',
    background: 'rgba(0, 10, 5, 0.95)',
    border: '2px solid #00ff80',
    borderRadius: '4px',
    boxShadow: '0 0 40px rgba(0, 255, 128, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const headerStyle = {
    padding: '8px 12px',
    background: 'rgba(0, 255, 128, 0.1)',
    borderBottom: '1px solid #00ff80',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    color: '#00ff80',
  };

  const contentStyle = {
    flex: 1,
    padding: '12px',
    overflowY: 'auto',
    fontSize: '13px',
    lineHeight: '1.5',
    color: '#00ff80',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };

  const inputContainerStyle = {
    padding: '10px 12px',
    background: 'rgba(0, 0, 0, 0.5)',
    borderTop: '1px solid #00ff80',
    display: 'flex',
    alignItems: 'center',
  };

  const promptStyle = {
    color: '#00ff80',
    marginRight: '8px',
    fontSize: '13px',
  };

  const inputStyle = {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#00ff80',
    fontSize: '13px',
    fontFamily: 'inherit',
    caretColor: '#00ff80',
  };

  const renderHistory = () => {
    return terminalHistory.map((entry) => (
      <div
        key={entry.ts}
        style={{
          color: entry.reply && entry.reply.includes('Error') ? '#ff3030' : 
                 entry.reply && entry.reply.includes('WARNING') ? '#ffb000' : '#00ff80',
        }}
      >
        <span style={{ opacity: 0.7 }}>$ {entry.line}</span>
        {entry.reply && (
          <div style={{ paddingLeft: '10px' }}>{entry.reply}</div>
        )}
      </div>
    ));
  };

  return (
    <div style={overlayStyle} onClick={() => toggleTerminal()}>
      <div 
        style={terminalStyle} 
        onClick={(e) => e.stopPropagation()}
      >
        <div style={headerStyle}>
          <span>NETRUNNER_TERMINAL v2.4.1 [MISSION: {missionId || 'NONE'}]</span>
          <span style={{ fontSize: '10px', opacity: 0.7 }}>
            [ESC] Close  [TAB] Complete  [↑↓] History
          </span>
        </div>
        <div ref={contentRef} style={contentStyle}>
          {renderHistory()}
        </div>
        <div style={inputContainerStyle}>
          <span style={promptStyle}>root@redis-cluster:~#</span>
          <input
            ref={inputRef}
            style={inputStyle}
            value={terminalInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            autoFocus
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}

export default EmbeddedTerminal;
