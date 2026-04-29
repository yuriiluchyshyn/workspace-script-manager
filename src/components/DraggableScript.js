import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
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
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const infoBtnRef = useRef(null);
  const popupRef = useRef(null);

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
  const handleClickOutside = useCallback((e) => {
    if (
      popupRef.current && !popupRef.current.contains(e.target) &&
      infoBtnRef.current && !infoBtnRef.current.contains(e.target)
    ) {
      setShowInfo(false);
    }
  }, []);

  useEffect(() => {
    if (showInfo) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showInfo, handleClickOutside]);

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

    // Position popup relative to the button
    if (infoBtnRef.current) {
      const rect = infoBtnRef.current.getBoundingClientRect();
      const popupWidth = 380;
      const popupHeight = 300;
      let left = rect.right + 8;
      let top = rect.top;

      // If it would go off the right edge, show on the left side
      if (left + popupWidth > window.innerWidth) {
        left = rect.left - popupWidth - 8;
      }
      // If it would go off the bottom, shift up
      if (top + popupHeight > window.innerHeight) {
        top = window.innerHeight - popupHeight - 10;
      }
      if (top < 10) top = 10;

      setPopupPos({ top, left });
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
      setInfoText(script.description || 'No description available (backend not reachable).');
    }
    setLoadingInfo(false);
  };

  // Render popup via portal so it's always on top
  const infoPopup = showInfo ? ReactDOM.createPortal(
    <div 
      ref={popupRef} 
      className="script-info-popup"
      style={{ top: popupPos.top, left: popupPos.left }}
    >
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
    </div>,
    document.body
  ) : null;

  return (
    <div 
      ref={setNodeRef}
      className={`script-container ${isDragging ? 'dragging' : ''}`}
      style={{ opacity: isDragging ? 0.4 : 1 }}
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
            ref={infoBtnRef}
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

      {infoPopup}
    </div>
  );
}

export default DraggableScript;
