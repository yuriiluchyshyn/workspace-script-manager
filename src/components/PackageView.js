import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import DragDropProvider from './DragDropProvider';
import DraggableScript from './DraggableScript';
import DraggableFolder from './DraggableFolder';

function PackageView({ 
  scripts, 
  terminalTabs = [],
  onScriptSelect, 
  selectedScript, 
  runningScripts, 
  onRunScript, 
  onStopScript, 
  onEditScript, 
  onDeleteScript, 
  onAddTerminal,
  onUpdateScript,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onAddScript,
  onMoveScript
}) {
  const [expandedPackages, setExpandedPackages] = useState(new Set(['root']));
  const [activeItem, setActiveItem] = useState(null);

  const organizeScripts = () => {
    const packages = {};
    const rootScripts = [];

    scripts.forEach(script => {
      const packagePath = script.packagePath || '';
      if (!packagePath) { rootScripts.push(script); return; }

      const parts = packagePath.split('/').filter(p => p.trim());
      let current = packages;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!current[part]) current[part] = { scripts: [], packages: {} };
        if (i === parts.length - 1) current[part].scripts.push(script);
        else current = current[part].packages;
      }
    });
    return { packages, rootScripts };
  };

  const togglePackage = (packagePath) => {
    const newExpanded = new Set(expandedPackages);
    if (newExpanded.has(packagePath)) newExpanded.delete(packagePath);
    else newExpanded.add(packagePath);
    setExpandedPackages(newExpanded);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    console.log('Drag end:', { activeId: active.id, overId: over.id, activeType: activeData?.type, overType: overData?.type });

    if (activeData?.type === 'script') {
      const script = activeData.script;
      let targetPath = null;

      if (overData?.type === 'folder') {
        targetPath = overData.folder.fullPath;
      } else if (overData?.type === 'script') {
        targetPath = overData.script.packagePath || '';
      } else if (over.id === 'root-drop-zone' || overData?.type === 'root') {
        targetPath = '';
      }

      if (targetPath !== null && targetPath !== (script.packagePath || '')) {
        console.log('Moving script:', script.name, 'to:', targetPath || 'root');
        onMoveScript && onMoveScript(script.id, targetPath);
      }
    } else if (activeData?.type === 'folder') {
      const folder = activeData.folder;
      let targetPath = null;

      if (overData?.type === 'folder') {
        targetPath = overData.folder.fullPath;
      } else if (over.id === 'root-drop-zone' || overData?.type === 'root') {
        targetPath = '';
      }

      if (targetPath !== null) {
        const folderPath = folder.fullPath;
        if (targetPath.startsWith(folderPath + '/') || targetPath === folderPath) {
          console.log('Prevented dropping folder into itself');
          return;
        }
        if (targetPath !== (folder.packagePath || '')) {
          console.log('Moving folder:', folder.name, 'to:', targetPath || 'root');
          onMoveScript && onMoveScript(folder, targetPath, 'folder');
        }
      }
    }
  };

  const handleDragStart = (event) => {
    const activeData = event.active.data.current;
    if (activeData?.type === 'script') {
      setActiveItem({ ...activeData.script, isFolder: false });
    } else if (activeData?.type === 'folder') {
      setActiveItem({ ...activeData.folder, isFolder: true });
    }
  };

  const isSelected = (script) => selectedScript && selectedScript.id === script.id;
  const isRunning = (script) => runningScripts && runningScripts.has(script.id);

  const RootDropZone = ({ children, isEmpty = false }) => {
    const { isOver, setNodeRef } = useDroppable({
      id: 'root-drop-zone',
      data: { type: 'root', accepts: ['script', 'folder'] }
    });

    return (
      <div 
        ref={setNodeRef}
        className={`${isEmpty ? 'empty-drop-zone' : 'root-scripts'} ${isOver ? 'drop-target-active' : ''}`}
        style={{ minHeight: isEmpty ? '80px' : 'auto' }}
      >
        {children}
        {isOver && (
          <div className="drop-indicator-active">
            <div className="drop-indicator-line"></div>
            <div className="drop-indicator-text">Drop here to move to root</div>
          </div>
        )}
      </div>
    );
  };

  const { packages, rootScripts } = organizeScripts();

  return (
    <DragDropProvider 
      onDragEnd={handleDragEnd} 
      onDragStart={handleDragStart} 
      activeItem={activeItem}
    >
      <div className="package-view">
        {rootScripts.length > 0 ? (
          <RootDropZone>
            <div className="root-scripts-header">
              <span>Root Scripts</span>
              <div className="root-scripts-actions">
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
                        onAddScript && onAddScript(''); 
                      }}
                    >
                      📄 Add Script
                    </button>
                    <button 
                      className="dropdown-item"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        onCreateFolder && onCreateFolder(''); 
                      }}
                    >
                      📁 Create Folder
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {rootScripts.map(script => (
              <DraggableScript
                key={script.id}
                script={script}
                terminalTabs={terminalTabs}
                isSelected={isSelected(script)}
                isRunning={isRunning(script)}
                onScriptSelect={onScriptSelect}
                onRunScript={onRunScript}
                onStopScript={onStopScript}
                onEditScript={onEditScript}
                onDeleteScript={onDeleteScript}
                onUpdateScript={onUpdateScript}
              />
            ))}
          </RootDropZone>
        ) : (
          <RootDropZone isEmpty={true}>
            <div className="empty-folder-message">
              Drop scripts here to move to root
            </div>
          </RootDropZone>
        )}
        
        {Object.entries(packages).map(([name, data]) => (
          <DraggableFolder
            key={name}
            packageName={name}
            packageData={data}
            parentPath=""
            fullPath={name}
            isExpanded={expandedPackages.has(name)}
            onToggleExpanded={togglePackage}
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
    </DragDropProvider>
  );
}

export default PackageView;
