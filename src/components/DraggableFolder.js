import React, { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import DraggableScript from './DraggableScript';

function DraggableFolder({ 
  packageName,
  packageData,
  parentPath = '',
  fullPath,
  isExpanded,
  onToggleExpanded,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onAddScript,
  // Script handlers
  terminalTabs,
  onScriptSelect,
  selectedScript,
  runningScripts,
  onRunScript,
  onStopScript,
  onEditScript,
  onDeleteScript,
  onAddTerminal,
  onUpdateScript
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newFolderName, setNewFolderName] = useState(packageName);

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ 
    id: `drag-${fullPath}`,
    data: {
      type: 'folder',
      folder: { name: packageName, packagePath: parentPath, fullPath }
    }
  });

  const {
    isOver,
    setNodeRef: setDropRef
  } = useDroppable({
    id: `folder-${fullPath}`,
    data: {
      type: 'folder',
      folder: { name: packageName, packagePath: parentPath, fullPath },
      accepts: ['script', 'folder']
    }
  });

  const hasContent = packageData.scripts.length > 0 || Object.keys(packageData.packages).length > 0;

  const handleStartRename = (e) => {
    e.stopPropagation();
    setIsRenaming(true);
    setNewFolderName(packageName);
  };

  const handleRenameSubmit = () => {
    if (newFolderName.trim() && newFolderName.trim() !== packageName) {
      onRenameFolder && onRenameFolder(fullPath, newFolderName.trim());
    }
    setIsRenaming(false);
  };

  const handleRenameKeyPress = (e) => {
    if (e.key === 'Enter') handleRenameSubmit();
    else if (e.key === 'Escape') { setIsRenaming(false); setNewFolderName(packageName); }
  };

  const isScriptSelected = (script) => selectedScript && selectedScript.id === script.id;
  const isScriptRunning = (script) => runningScripts && runningScripts.has(script.id);

  return (
    <div 
      className={`package-item ${isDragging ? 'dragging' : ''}`}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <div 
        ref={setDropRef}
        className={`package-header ${isOver ? 'drop-target-active' : ''}`}
        onClick={isRenaming ? undefined : () => onToggleExpanded(fullPath)}
      >
        <div className="package-actions">
          <div className="package-add-dropdown">
            <button 
              className="package-add-btn tooltip-container"
              data-tooltip="Add Script or Folder"
            >
              +
            </button>
            <div className="package-add-dropdown-menu">
              <button 
                className="dropdown-item"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onAddScript && onAddScript(fullPath); 
                }}
              >
                📄 Add Script
              </button>
              <button 
                className="dropdown-item"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onCreateFolder && onCreateFolder(fullPath); 
                }}
              >
                📁 Create Folder
              </button>
            </div>
          </div>
          <button className="package-rename-folder-btn tooltip-container"
            data-tooltip="Rename Folder"
            onClick={handleStartRename}>✎</button>
          <button className="package-delete-folder-btn tooltip-container"
            data-tooltip="Delete Folder"
            onClick={(e) => { e.stopPropagation(); onDeleteFolder && onDeleteFolder(fullPath); }}>×</button>
        </div>
        <div 
          ref={setDragRef}
          className="package-title-row"
          title="Drag to move folder"
          {...attributes}
          {...listeners}
        >
          <span className="package-toggle">
            {hasContent ? (isExpanded ? '▾' : '▸') : '·'}
          </span>
          <span className="package-name">
            📁 {isRenaming ? (
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={handleRenameKeyPress}
                onBlur={handleRenameSubmit}
                onFocus={(e) => e.target.select()}
                className="folder-rename-input"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : packageName}
          </span>
        </div>
        {isOver && (
          <div className="drop-indicator-active">
            <div className="drop-indicator-line"></div>
            <div className="drop-indicator-text">Drop here to move into {packageName}</div>
          </div>
        )}
      </div>

      {isExpanded && !hasContent && (
        <div className="package-empty-content">
          <div className="empty-folder-message">Empty folder</div>
        </div>
      )}

      {isExpanded && hasContent && (
        <div className="package-content">
          {packageData.scripts.map(script => (
            <DraggableScript
              key={script.id}
              script={script}
              terminalTabs={terminalTabs}
              isSelected={isScriptSelected(script)}
              isRunning={isScriptRunning(script)}
              onScriptSelect={onScriptSelect}
              onRunScript={onRunScript}
              onStopScript={onStopScript}
              onEditScript={onEditScript}
              onDeleteScript={onDeleteScript}
              onAddTerminal={onAddTerminal}
              onUpdateScript={onUpdateScript}
            />
          ))}
          
          {Object.entries(packageData.packages).map(([name, data]) => (
            <DraggableFolder
              key={`${fullPath}/${name}`}
              packageName={name}
              packageData={data}
              parentPath={fullPath}
              fullPath={`${fullPath}/${name}`}
              isExpanded={isExpanded}
              onToggleExpanded={onToggleExpanded}
              onCreateFolder={onCreateFolder}
              onDeleteFolder={onDeleteFolder}
              onRenameFolder={onRenameFolder}
              onAddScript={onAddScript}
              terminalTabs={terminalTabs}
              onScriptSelect={onScriptSelect}
              selectedScript={selectedScript}
              runningScripts={runningScripts}
              onRunScript={onRunScript}
              onStopScript={onStopScript}
              onEditScript={onEditScript}
              onDeleteScript={onDeleteScript}
              onAddTerminal={onAddTerminal}
              onUpdateScript={onUpdateScript}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default DraggableFolder;
