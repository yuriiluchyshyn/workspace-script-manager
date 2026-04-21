import React from 'react';
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

  // Hide placeholder scripts
  if (script.isPlaceholder) {
    return null;
  }

  const hasParameters = script.detectedParams && script.detectedParams.length > 0;
  const scriptTerminalCount = terminalTabs.filter(tab => tab.scriptId === script.id).length;

  return (
    <div 
      ref={setNodeRef}
      className={`script-container ${isDragging ? 'dragging' : ''}`}
      style={{ opacity: isDragging ? 0.4 : 1 }}
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
          >{script.name}</span>
          {scriptTerminalCount > 0 && (
            <span className="terminal-count" title={`${scriptTerminalCount} terminal${scriptTerminalCount > 1 ? 's' : ''}`}>
              [{scriptTerminalCount}]
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default DraggableScript;
