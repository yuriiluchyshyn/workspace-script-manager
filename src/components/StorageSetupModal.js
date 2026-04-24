import React from 'react';

function StorageSetupModal({ onComplete }) {
  return (
    <div className="modal">
      <div className="modal-content" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h3>Welcome to Workspace Script Manager</h3>
        </div>
        
        <p style={{ color: '#555', marginBottom: '16px', lineHeight: '1.5' }}>
          Your workspace configuration will be stored in this browser's local storage.
          Data persists across page refreshes and browser restarts.
        </p>

        <p style={{ color: '#888', fontSize: '12px', marginBottom: '20px' }}>
          You can export/import your configuration from Settings at any time.
        </p>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onComplete}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}

export default StorageSetupModal;
