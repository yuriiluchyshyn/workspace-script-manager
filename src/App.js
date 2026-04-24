import React, { useState, useEffect } from 'react';
import WorkspaceDetail from './components/WorkspaceDetail';
import CreateWorkspaceModal from './components/CreateWorkspaceModal';
import SettingsModal from './components/SettingsModal';
import StorageSetupModal from './components/StorageSetupModal';
import { loadWorkspaces, saveWorkspaces, isStorageSetUp, initStorage } from './utils/storage';

function App() {
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStorageSetup, setShowStorageSetup] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [workspacePanelWidth, setWorkspacePanelWidth] = useState(200); // Smaller default width
  const [isResizing, setIsResizing] = useState(false);
  const [processInput, setProcessInput] = useState('');
  const [portInput, setPortInput] = useState('');
  const [workspacesCollapsed, setWorkspacesCollapsed] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!isStorageSetUp()) {
        setShowStorageSetup(true);
        return;
      }
      const savedWorkspaces = await loadWorkspaces();
      setWorkspaces(savedWorkspaces);
      if (savedWorkspaces.length > 0 && !selectedWorkspace) {
        setSelectedWorkspace(savedWorkspaces[0]);
      }
    };
    loadData();
  }, []);

  // Handle panel resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      const newWidth = Math.max(200, Math.min(500, e.clientX - 20)); // Min 200px, Max 500px
      setWorkspacePanelWidth(newWidth);
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

  const handleCreateWorkspace = async (workspaceData) => {
    const newWorkspace = {
      id: Date.now().toString(),
      ...workspaceData,
      scripts: [],
      createdAt: new Date().toISOString()
    };
    
    const updatedWorkspaces = [...workspaces, newWorkspace];
    setWorkspaces(updatedWorkspaces);
    await saveWorkspaces(updatedWorkspaces);
    setShowCreateModal(false);
    setSelectedWorkspace(newWorkspace); // Auto-select new workspace
  };

  const handleUpdateWorkspace = async (updatedWorkspace) => {
    const updatedWorkspaces = workspaces.map(ws => 
      ws.id === updatedWorkspace.id ? updatedWorkspace : ws
    );
    setWorkspaces(updatedWorkspaces);
    await saveWorkspaces(updatedWorkspaces);
    setSelectedWorkspace(updatedWorkspace);
  };

  const handleDeleteWorkspace = async (workspaceId) => {
    const updatedWorkspaces = workspaces.filter(ws => ws.id !== workspaceId);
    setWorkspaces(updatedWorkspaces);
    await saveWorkspaces(updatedWorkspaces);
    if (selectedWorkspace && selectedWorkspace.id === workspaceId) {
      setSelectedWorkspace(updatedWorkspaces.length > 0 ? updatedWorkspaces[0] : null);
    }
  };

  const handleKillAll = async () => {
    if (!window.confirm('Are you sure you want to kill all running scripts? This will stop all processes across all workspaces.')) {
      return;
    }
    
    try {
      const response = await fetch('http://localhost:3001/api/kill-all', {
        method: 'POST'
      });
      const result = await response.json();
      alert(result.message || 'All processes have been killed successfully');
    } catch (error) {
      console.error('Error killing all processes:', error);
      alert('Error killing processes: ' + error.message);
    }
  };

  const handleKillPort = async () => {
    if (!portInput.trim()) {
      alert('Please enter a port number');
      return;
    }
    
    if (!window.confirm(`Are you sure you want to kill all processes running on port ${portInput}?`)) {
      return;
    }
    
    try {
      const response = await fetch('http://localhost:3001/api/kill-port', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port: portInput })
      });
      
      const result = await response.json();
      alert(result.message || `Processes on port ${portInput} have been killed successfully`);
      setPortInput('');
    } catch (error) {
      console.error('Error killing port:', error);
      alert('Error killing port: ' + error.message);
    }
  };

  const handleFindProcess = async () => {
    if (!processInput.trim()) {
      alert('Please enter a process name');
      return;
    }
    
    try {
      const response = await fetch('http://localhost:3001/api/find-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processName: processInput })
      });
      
      const result = await response.json();
      if (result.processes && result.processes.length > 0) {
        const processInfo = result.processes.map(p => `PID: ${p.pid}, Command: ${p.command}`).join('\n');
        alert(`Found ${result.processes.length} process(es) matching "${processInput}":\n\n${processInfo}`);
      } else {
        alert(`No processes found matching "${processInput}"`);
      }
    } catch (error) {
      console.error('Error finding process:', error);
      alert('Error finding process: ' + error.message);
    }
  };

  const handleSettingsSave = (settings) => {
    console.log('Settings saved:', settings);
  };

  return (
    <div className="app">
      <div className="header">
        <div className="header-title-row">
          <h1>Workspace Script Manager</h1>
          <button 
            className="btn-icon btn-settings" 
            onClick={() => setShowSettingsModal(true)}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
        
        {/* Process Management Tools */}
        <div className="process-management">
          <div className="process-tools">
            <div className="tool-group">
              <input
                type="text"
                placeholder="Port number"
                value={portInput}
                onChange={(e) => setPortInput(e.target.value)}
                className="process-input"
                title="Enter port number to kill processes"
              />
              <button 
                className="btn btn-danger btn-small" 
                onClick={handleKillPort}
                title="Kill all processes running on the specified port"
              >
                Kill Port
              </button>
            </div>
            
            <div className="tool-group">
              <input
                type="text"
                placeholder="Process name"
                value={processInput}
                onChange={(e) => setProcessInput(e.target.value)}
                className="process-input"
                title="Enter process name to search for"
              />
              <button 
                className="btn btn-info btn-small" 
                onClick={handleFindProcess}
                title="Find processes by name"
              >
                Find Process
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="app-content">
        {/* Left Panel - Workspaces Tree */}
        <div 
          className={`workspaces-panel ${workspacesCollapsed ? 'collapsed' : ''}`}
          style={{ width: workspacesCollapsed ? '50px' : `${workspacePanelWidth}px` }}
        >
          <div className="panel-header">
            <div className="header-title-row">
              <div className="title-with-counter">
                <div className="collapsible-header" onClick={() => setWorkspacesCollapsed(!workspacesCollapsed)}>
                  <span className="collapse-arrow">{workspacesCollapsed ? '▸' : '▾'}</span>
                  {!workspacesCollapsed && (
                    <>
                      <h3>Workspaces</h3>
                      <span className="workspace-count">({workspaces.length})</span>
                    </>
                  )}
                </div>
              </div>
              {!workspacesCollapsed && (
                <button 
                  className="btn-icon btn-add-workspace" 
                  onClick={() => setShowCreateModal(true)}
                  title="Create Workspace"
                >
                  +
                </button>
              )}
            </div>
          </div>
          
          {!workspacesCollapsed && (
            <>
              {workspaces.length === 0 ? (
                <div className="empty-state">
                  <p>No workspaces created yet</p>
                  <button 
                    className="btn btn-primary btn-small"
                    onClick={() => setShowCreateModal(true)}
                  >
                    Create First Workspace
                  </button>
                </div>
              ) : (
                <div className="workspaces-tree">
                  {workspaces.map(workspace => (
                    <div 
                      key={workspace.id}
                      className={`workspace-item ${selectedWorkspace && selectedWorkspace.id === workspace.id ? 'selected' : ''}`}
                      onClick={() => setSelectedWorkspace(workspace)}
                    >
                      <div className="workspace-info">
                        <span className="workspace-icon">📁</span>
                        <div className="workspace-details">
                          <span className="workspace-name">{workspace.name}</span>
                          <span className="workspace-script-count">({workspace.scripts.length} scripts)</span>
                        </div>
                        <button 
                          className="btn-icon btn-delete-workspace-item" 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete workspace "${workspace.name}"?`)) {
                              handleDeleteWorkspace(workspace.id);
                            }
                          }}
                          title="Delete Workspace"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          
          {/* Collapsed state - show workspace icons only */}
          {workspacesCollapsed && workspaces.length > 0 && (
            <div className="workspaces-collapsed">
              {workspaces.map(workspace => (
                <div 
                  key={workspace.id}
                  className={`workspace-item-collapsed ${selectedWorkspace && selectedWorkspace.id === workspace.id ? 'selected' : ''}`}
                  onClick={() => setSelectedWorkspace(workspace)}
                  onDoubleClick={() => setWorkspacesCollapsed(false)}
                  title={`${workspace.name}${workspace.description ? ` - ${workspace.description}` : ''} (${workspace.scripts.length} script${workspace.scripts.length !== 1 ? 's' : ''}) - Double-click to expand`}
                >
                  <span className="workspace-icon-collapsed">📁</span>
                </div>
              ))}
              <button 
                className="btn-icon-collapsed btn-add-workspace-collapsed" 
                onClick={() => setShowCreateModal(true)}
                title="Create Workspace"
              >
                +
              </button>
            </div>
          )}
        </div>

        {/* Resize Handle */}
        {!workspacesCollapsed && (
          <div 
            className="resize-handle"
            onMouseDown={() => setIsResizing(true)}
            title="Drag to resize workspace panel"
          />
        )}

        {/* Right Panel - Workspace Detail */}
        <div className="workspace-panel">
          {selectedWorkspace ? (
            <WorkspaceDetail 
              workspace={selectedWorkspace}
              onUpdate={handleUpdateWorkspace}
              onDelete={handleDeleteWorkspace}
            />
          ) : (
            <div className="workspace-empty">
              <div className="empty-workspace">
                <h4>No workspace selected</h4>
                <p>Select a workspace from the list on the left to view and manage its scripts.</p>
                {workspaces.length === 0 && (
                  <button 
                    className="btn btn-primary"
                    onClick={() => setShowCreateModal(true)}
                  >
                    Create Your First Workspace
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateWorkspaceModal 
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateWorkspace}
        />
      )}

      {showSettingsModal && (
        <SettingsModal 
          onClose={() => setShowSettingsModal(false)}
          onSave={handleSettingsSave}
          onKillAll={handleKillAll}
        />
      )}

      {showStorageSetup && (
        <StorageSetupModal 
          onComplete={async () => {
            initStorage();
            setShowStorageSetup(false);
            const saved = await loadWorkspaces();
            setWorkspaces(saved);
            if (saved.length > 0) setSelectedWorkspace(saved[0]);
          }}
        />
      )}
    </div>
  );
}

export default App;