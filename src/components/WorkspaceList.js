import React from 'react';

function WorkspaceList({ workspaces, onSelectWorkspace }) {
  return (
    <div className="workspace-list">
      {workspaces.map(workspace => (
        <div 
          key={workspace.id} 
          className="workspace-card"
          onClick={() => onSelectWorkspace(workspace)}
        >
          <h3>{workspace.name}</h3>
          <p>{workspace.description}</p>
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
            Scripts: {workspace.scripts.length}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            Created: {new Date(workspace.createdAt).toLocaleDateString()}
          </div>
        </div>
      ))}
      
      {workspaces.length === 0 && (
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
          <p>No workspaces created yet. Click "Create Workspace" to get started.</p>
        </div>
      )}
    </div>
  );
}

export default WorkspaceList;