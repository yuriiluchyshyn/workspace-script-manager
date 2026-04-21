import React, { useState, useEffect, useRef } from 'react';
import EditScriptModal from './EditScriptModal';

function ScriptItem({ script, workspaceId, isRunning, onUpdate, onDelete, onStatusChange, onOpenConsole, isTerminalView = false }) {
  const [logs, setLogs] = useState('');
  const [showLogs, setShowLogs] = useState(isTerminalView); // Auto-show logs in terminal view
  const [showEditModal, setShowEditModal] = useState(false);
  const [logHeight, setLogHeight] = useState(isTerminalView ? 400 : 300);
  const [isResizing, setIsResizing] = useState(false);
  const wsRef = useRef(null);
  const logsEndRef = useRef(null);
  const resizeRef = useRef(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  // Handle mouse resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      const rect = resizeRef.current?.parentElement?.getBoundingClientRect();
      if (rect) {
        const newHeight = Math.max(150, Math.min(800, e.clientY - rect.top - 100));
        setLogHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(`ws://localhost:3001/ws/${workspaceId}/${script.id}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'log') {
        setLogs(prev => prev + data.data);
      } else if (data.type === 'status') {
        onStatusChange(data.running);
      }
    };

    ws.onclose = () => {
      setTimeout(() => {
        if (showLogs) {
          connectWebSocket();
        }
      }, 1000);
    };
  };

  useEffect(() => {
    if (showLogs) {
      connectWebSocket();
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [showLogs]);

  const handleRun = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/script/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          workspaceId,
          scriptId: script.id,
          script
        })
      });
      
      if (response.ok) {
        setShowLogs(true);
      } else {
        console.error(`Failed to start script:`, await response.text());
      }
    } catch (error) {
      console.error('Error running script:', error);
    }
  };

  const handleStop = async () => {
    try {
      await fetch(`http://localhost:3001/api/script/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          workspaceId,
          scriptId: script.id
        })
      });
    } catch (error) {
      console.error('Error stopping script:', error);
    }
  };

  const handleClearLogs = () => {
    setLogs('');
  };

  if (isTerminalView) {
    return (
      <div className="terminal-script-view">
        <div className="script-info-compact">
          <div className="script-details-compact">
            <div className="script-main-info">
              <h4>{script.name}</h4>
              {script.description && <p className="script-description">{script.description}</p>}
            </div>
            <div className="script-meta">
              <span className="script-type-badge">{script.type.toUpperCase()}</span>
              {script.packagePath && (
                <span className="script-package-badge">{script.packagePath}</span>
              )}
            </div>
          </div>
          
          <div className="script-controls-compact">
            <button 
              className={`btn ${script.buttonLabel ? 'btn-primary' : 'btn-success'}`}
              onClick={handleRun}
              disabled={isRunning}
              title={isRunning ? 'Script is currently running' : 'Run this script'}
            >
              {isRunning ? 'Running...' : (script.buttonLabel || 'Run')}
            </button>
            
            <button 
              className="btn btn-danger"
              onClick={handleStop}
              disabled={!isRunning}
              title={!isRunning ? 'Script is not running' : 'Stop this script'}
            >
              Stop
            </button>
            
            <button 
              className="btn btn-secondary"
              onClick={() => setShowEditModal(true)}
            >
              Edit
            </button>
            
            <button 
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this script?')) {
                  onDelete();
                }
              }}
            >
              Delete
            </button>
          </div>
        </div>

        {/* Terminal Logs */}
        <div className="terminal-logs">
          <div className="logs-header">
            <h4>Output</h4>
            <div className="logs-controls">
              <button 
                className="btn btn-secondary btn-small"
                onClick={handleClearLogs}
              >
                Clear
              </button>
            </div>
          </div>
          <div 
            className="logs-container-terminal"
            style={{ height: `${logHeight}px` }}
          >
            <pre className="logs-content">{logs || 'No output yet. Run the script to see output here.'}</pre>
            <div ref={logsEndRef} />
          </div>
          <div 
            ref={resizeRef}
            className="logs-resize-handle"
            onMouseDown={() => setIsResizing(true)}
            title="Drag to resize terminal"
          />
        </div>

        {showEditModal && (
          <EditScriptModal 
            script={script}
            onClose={() => setShowEditModal(false)}
            onUpdate={onUpdate}
          />
        )}
      </div>
    );
  }

  // Original tab view (kept for backward compatibility)
  return (
    <div className="script-item-tab">
      <div className="script-header">
        <div className="script-info">
          <h3>{script.name}</h3>
          <p className="script-description">{script.description}</p>
          <div className="script-details">
            <span className="script-type">Type: {script.type}</span>
            <span className="script-path">File: {script.filePath}</span>
            {script.parameters && (
              <span className="script-parameters">Parameters: {script.parameters}</span>
            )}
            {script.packagePath && (
              <span className="script-package">Package: {script.packagePath}</span>
            )}
            {script.buttonLabel && (
              <span className="script-button-label">Button: {script.buttonLabel}</span>
            )}
          </div>
        </div>
        <div className={`script-status ${isRunning ? 'running' : 'stopped'}`}>
          {isRunning ? 'Running' : 'Stopped'}
        </div>
      </div>

      <div className="script-controls">
        <button 
          className={`btn ${script.buttonLabel ? 'btn-primary' : 'btn-success'}`}
          onClick={handleRun}
          disabled={isRunning}
        >
          {script.buttonLabel || 'Run'}
        </button>
        
        <button 
          className="btn btn-danger"
          onClick={handleStop}
          disabled={!isRunning}
        >
          Stop
        </button>
        
        <button 
          className="btn btn-secondary"
          onClick={() => setShowLogs(!showLogs)}
        >
          {showLogs ? 'Hide Logs' : 'Show Logs'}
        </button>

        <button 
          className="btn btn-info"
          onClick={onOpenConsole}
          title="Open console in script directory"
        >
          Console
        </button>
        
        <button 
          className="btn btn-secondary"
          onClick={() => setShowEditModal(true)}
        >
          Edit
        </button>
        
        <button 
          className="btn btn-danger"
          onClick={() => {
            if (window.confirm('Are you sure you want to delete this script?')) {
              onDelete();
            }
          }}
        >
          Delete
        </button>
      </div>

      {showLogs && (
        <div className="logs-section">
          <div className="logs-header">
            <h4>Logs</h4>
            <div className="logs-controls">
              <button 
                className="btn btn-secondary btn-small"
                onClick={handleClearLogs}
              >
                Clear
              </button>
            </div>
          </div>
          <div 
            className="logs-container-resizable"
            style={{ height: `${logHeight}px` }}
          >
            <pre className="logs-content">{logs}</pre>
            <div ref={logsEndRef} />
          </div>
          <div 
            ref={resizeRef}
            className="logs-resize-handle"
            onMouseDown={() => setIsResizing(true)}
            title="Drag to resize logs"
          />
        </div>
      )}

      {showEditModal && (
        <EditScriptModal 
          script={script}
          onClose={() => setShowEditModal(false)}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

export default ScriptItem;