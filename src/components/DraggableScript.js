import React, { useState, useRef, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import ScriptParameterManager from './ScriptParameterManager';

function DraggableScript({ 
  script, 
  terminalTabs = [],
  isSelected,
  isRunning,
  onScriptSelect,
  onRunScript,
  onStopScript,
  onEditScript,
  onDeleteScript,
  onAddTerminal,
  onUpdateScript
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [infoText, setInfoText] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const infoRef = useRef(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({ 
    id: script.id,
    data: {
      type: 'script',
      script: script
    }
  });

  // Close info popup on click outside
  useEffect(() => {
    if (!showInfo) return;
    const handleClickOutside = (e) => {
      if (infoRef.current && !infoRef.current.contains(e.target)) {
        setShowInfo(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showInfo]);

  // Hide placeholder scripts
  if (script.isPlaceholder) {
    return null;
  }

  const hasParameters = script.detectedParams && script.detectedParams.length > 0;
  const scriptTerminalCount = terminalTabs.filter(tab => tab.scriptId === script.id).length;

  // Build tooltip with script details
  const tooltipParts = [script.name];
  if (script.description) tooltipParts.push(script.description);
  if (script.filePath) tooltipParts.push(`Path: ${script.filePath}`);
  if (script.type) tooltipParts.push(`Type: .${script.type}`);
  if (script.buttonLabel && script.buttonLabel !== script.name) tooltipParts.push(`Label: ${script.buttonLabel}`);
  const tooltip = tooltipParts.join('\n');

  const handleInfoClick = async (e) => {
    e.stopPropagation();
    if (showInfo) {
      setShowInfo(false);
      return;
    }
    setShowInfo(true);

    // If we already fetched, don't fetch again
    if (infoText !== null) return;

    setLoadingInfo(true);
    try {
      const response = await fetch('http://localhost:3001/api/script-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: script.filePath })
      });
      if (response.ok) {
        const data = await response.json();
        setInfoText(data.fullHeader || data.description || 'No description found in script file.');
      } else {
        setInfoText(script.description || 'No description available.');
      }
    } catch {
      // Fallback to stored description (e.g. on Vercel)
      setInfoText(script.description || 'No description available (backend not reachable).');
    }
    setLoadingInfo(false);
  };

  return (
    <div 
      ref={setNodeRef}
      className={`script-container ${isDragging ? 'dragging' : ''}`}
      style={{ opacity: isDragging ? 0.4 : 1, position: 'relative' }}
      title={tooltip}
    >
      <div className={`tree-script ${isSelected ? 'selected' : ''}`}>
        <div className="script-buttons">
          {isRunning ? (
            <button 
              className="tree-btn tree-btn-stop" 
              onClick={(e) => { e.stopPropagation(); onStopScript(script); }} 
              title="Stop Script"
            >■</button>
          ) : (
            <button 
              className="tree-btn tree-btn-run" 
              onClick={(e) => { e.stopPropagation(); onRunScript(script); }} 
              title="Run Script"
            >▶</button>
          )}
          <button 
            className="tree-btn tree-btn-terminal" 
            onClick={(e) => { e.stopPropagation(); onAddTerminal(script); }} 
            title="Open Terminal"
          >⚡</button>
          {hasParameters && (
            <ScriptParameterManager 
              script={script} 
              onUpdateScript={onUpdateScript}
              isInline={true}
            />
          )}
          <button 
            className="tree-btn tree-btn-info" 
            onClick={handleInfoClick} 
            title="Script Info"
            style={{ color: showInfo ? '#007bff' : undefined }}
          >ℹ</button>
          <button 
            className="tree-btn tree-btn-edit" 
            onClick={(e) => { e.stopPropagation(); onEditScript(script); }} 
            title="Edit Script"
          >✎</button>
          <button 
            className="tree-btn tree-btn-delete" 
            onClick={(e) => { e.stopPropagation(); onDeleteScript(script); }} 
            title="Delete Script"
          >✕</button>
        </div>
        <div 
          className="script-info"
          title="Drag to move script"
          {...attributes}
          {...listeners}
        >
          <span 
            className={`tree-dot ${isRunning ? 'running' : 'stopped'}`}
            onClick={() => onScriptSelect(script)}
          >●</span>
          <span 
            className="tree-script-name"
            onClick={() => onScriptSelect(script)}
            title={tooltip}
          >{script.name}</span>
          {scriptTerminalCount > 0 && (
            <span className="terminal-count" title={`${scriptTerminalCount} terminal${scriptTerminalCount > 1 ? 's' : ''}`}>
              [{scriptTerminalCount}]
            </span>
          )}
        </div>
      </div>

      {/* Info popup */}
      {showInfo && (
        <div ref={infoRef} className="script-info-popup">
          <div className="script-info-popup-header">
            <strong>{script.name}</strong>
            <button 
              className="script-info-popup-close"
              onClick={(e) => { e.stopPropagation(); setShowInfo(false); }}
            >×</button>
          </div>
          <div className="script-info-popup-body">
            {loadingInfo ? (
              <span style={{ color: '#999' }}>Loading...</span>
            ) : (
              <pre className="script-info-popup-text">{infoText}</pre>
            )}
          </div>
          {script.filePath && (
            <div className="script-info-popup-footer">
              <small>{script.filePath}</small>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DraggableScript;
